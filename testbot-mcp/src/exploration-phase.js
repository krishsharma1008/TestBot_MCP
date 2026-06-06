'use strict';

/**
 * Exploration-phase orchestrator.
 *
 *   1. If `skipExploration` is set, or `browser-use` isn't available, return a
 *      minimal artifact so the downstream generator can still run in PRD-only
 *      mode. This is important: exploration MUST NOT be a blocker for the
 *      happy path on a fresh install.
 *   2. Otherwise invoke `browser-use-driver.driveExploration` against the
 *      already-running app (the multi-service starter + Playwright's
 *      startServer have brought it up) and write `exploration-artifact.json`
 *      into the run's status dir.
 *
 * The artifact shape matches `ExplorationArtifact` in
 * `webapp/src/lib/test-generation/types.ts` so the webapp's generator prompt
 * can read it without a schema adapter.
 */

const fs = require('fs');
const path = require('path');
const Logger = require('./logger');
const { driveExploration } = require('./browser-use-driver');
const { exploreWithPlaywright, enrichRoutesWithDOM, enrichAllRoutesWithDOM } = require('./playwright-explorer');
const { injectCredentials, normalizeRoleLabel } = require('./credentials-injector');
const { isUnsafeAuthFlow, sanitizeAuthFlow, chooseBetterAuthFlow } = require('./auth-flow-utils');

const EMPTY_ARTIFACT = Object.freeze({
  routes: [],
  forms: [],
  authFlow: null,
  keyFlows: [],
  observedErrors: [],
});

async function _applyDOMEnrichment(artifact, { baseURL, preAuthRoles }) {
  if (!artifact.routes || artifact.routes.length === 0) return artifact;
  Logger.info('ExplorationPhase', 'Running Playwright DOM enrichment pass', {
    routeCount: artifact.routes.length,
  });
  try {
    const { enrichments, errorProbe } = await enrichRoutesWithDOM({
      baseURL,
      routes: artifact.routes,
      storageStatePaths: preAuthRoles || [],
      onHeartbeat: () => {},
    });
    const enrichedRoutes = artifact.routes.map((r) => ({
      ...r,
      ...(enrichments[r.path] || {}),
    }));
    return { ...artifact, routes: enrichedRoutes, errorProbe: errorProbe || null };
  } catch (err) {
    Logger.warn('ExplorationPhase', 'DOM enrichment pass failed (non-fatal)', { reason: err.message });
    return artifact;
  }
}

/**
 * Merge a secondary (browser-use gap-fill) artifact into the primary
 * (Playwright) artifact. The primary is authoritative: gap-fill only contributes
 * routes/forms/keyFlows the primary crawl did not already find. New routes are
 * tagged so downstream consumers can see they came from the LLM gap-fill pass.
 */
function mergeGapFillArtifact(primary = {}, gapFill = {}) {
  const routes = Array.isArray(primary?.routes) ? [...primary.routes] : [];
  const seenRoutes = new Set(routes.map((r) => r?.path).filter(Boolean));
  for (const r of Array.isArray(gapFill?.routes) ? gapFill.routes : []) {
    if (r?.path && !seenRoutes.has(r.path)) {
      seenRoutes.add(r.path);
      routes.push({ ...r, source: r.source || 'browser-use-gapfill' });
    }
  }

  const forms = Array.isArray(primary?.forms) ? [...primary.forms] : [];
  const formKeys = new Set(forms.map((f) => `${f?.route}::${(f?.fields || []).join(',')}`));
  for (const f of Array.isArray(gapFill?.forms) ? gapFill.forms : []) {
    const key = `${f?.route}::${(f?.fields || []).join(',')}`;
    if (!formKeys.has(key)) { formKeys.add(key); forms.push(f); }
  }

  const keyFlows = Array.isArray(primary?.keyFlows) ? [...primary.keyFlows] : [];
  const flowNames = new Set(keyFlows.map((k) => k?.name).filter(Boolean));
  for (const kf of Array.isArray(gapFill?.keyFlows) ? gapFill.keyFlows : []) {
    if (kf?.name && !flowNames.has(kf.name)) { flowNames.add(kf.name); keyFlows.push(kf); }
  }

  const observedErrors = [...new Set([
    ...(Array.isArray(primary?.observedErrors) ? primary.observedErrors : []),
    ...(Array.isArray(gapFill?.observedErrors) ? gapFill.observedErrors : []),
  ])];

  return {
    ...primary,
    routes,
    forms,
    keyFlows,
    observedErrors,
    authFlow: chooseBetterAuthFlow(primary?.authFlow || null, gapFill?.authFlow || null),
  };
}

function primaryCredential(credentials) {
  if (!credentials) return null;
  if (Array.isArray(credentials)) {
    return credentials.find((c) => c?.username && c?.password) || null;
  }
  if (credentials.username && credentials.password) return credentials;
  return null;
}

function normalizeExplorationArtifact(rawArtifact = {}, source = 'unknown') {
  const rawAuthFlow = rawArtifact?.authFlow || null;
  const authFlow = sanitizeAuthFlow(rawAuthFlow);
  const authFlowRejected = !!rawAuthFlow && !authFlow;
  const observedErrors = Array.isArray(rawArtifact?.observedErrors) ? [...rawArtifact.observedErrors] : [];
  if (authFlowRejected) {
    const reason = isUnsafeAuthFlow(rawAuthFlow)
      ? `Rejected non-login authFlow from ${source}: ${rawAuthFlow.loginUrl}`
      : `Rejected low-confidence authFlow from ${source}: ${rawAuthFlow.loginUrl || 'unknown'}`;
    observedErrors.push(reason);
  }
  return {
    routes: Array.isArray(rawArtifact?.routes) ? rawArtifact.routes : [],
    forms: Array.isArray(rawArtifact?.forms) ? rawArtifact.forms : [],
    authFlow,
    keyFlows: Array.isArray(rawArtifact?.keyFlows) ? rawArtifact.keyFlows : [],
    observedErrors,
    errorProbe: rawArtifact?.errorProbe || null,
    authFlowRejected: authFlowRejected
      ? {
          loginUrl: rawAuthFlow.loginUrl || null,
          reason: isUnsafeAuthFlow(rawAuthFlow) ? 'registration_or_signup_flow' : 'low_confidence_login_flow',
          source,
        }
      : null,
  };
}

function artifactHasUsefulContext(artifact = {}) {
  if (!artifact || typeof artifact !== 'object') return false;
  const routes = Array.isArray(artifact.routes) ? artifact.routes : [];
  const usefulRouteCount = routes.filter((route) => {
    const pathValue = String(route?.path || route?.url || '').toLowerCase();
    return (
      pathValue &&
      pathValue !== '/' &&
      pathValue !== '/#' &&
      !/(^|\/|#)(login|sign-in|signin|auth|register|signup|sign-up)(\/|$|\?)/.test(pathValue)
    );
  }).length;
  const formCount = Array.isArray(artifact.forms) ? artifact.forms.length : 0;
  const keyFlowCount = Array.isArray(artifact.keyFlows) ? artifact.keyFlows.length : 0;
  // An authFlow, login-only route, or homepage-only route is not enough; that
  // is exactly the failure mode where browser-use stalled before mapping the app.
  return Boolean(usefulRouteCount > 0 || formCount > 0 || keyFlowCount > 0);
}

async function runPlaywrightFallback({ baseURL, credsForAgent, preAuthRoles, seedRoutes = [] }) {
  const fallback = await exploreWithPlaywright({
    baseURL,
    credentials: credsForAgent,
    storageStatePaths: preAuthRoles,
    seedRoutes,
    onHeartbeat: () => { /* noop */ },
  });
  if (!fallback.available) return fallback;
  return {
    ...fallback,
    artifact: await _applyDOMEnrichment(fallback.artifact, { baseURL, preAuthRoles }),
  };
}

async function runExplorationPhase({
  statusDir,
  baseURL,
  credentials,
  projectPath,
  skipExploration = false,
  totalTimeoutMs = 120_000,
  knownRoutes = [],
  prdFeatures = [],
}) {
  if (skipExploration) {
    Logger.info('ExplorationPhase', 'skipExploration=true — using empty artifact');
    return { artifact: { ...EMPTY_ARTIFACT }, source: 'skipped', reason: 'user opt-out' };
  }

  if (!baseURL) {
    return { artifact: { ...EMPTY_ARTIFACT }, source: 'unavailable', reason: 'no baseURL' };
  }

  const cred = primaryCredential(credentials);

  // Pre-authenticate ALL roles before exploration so every role's protected
  // routes are reachable. We use fallback selectors (no authFlow yet) for a
  // best-effort login. The resulting storageState files are passed to the
  // Playwright heuristic explorer which runs one walk per role and merges the
  // results. browser-use handles its own login via the improved task prompt.
  let preAuthRoles = [];
  let preAuthFailedRoles = [];
  if (cred && projectPath) {
    try {
      const allCreds = Array.isArray(credentials) ? credentials : [cred];
      const injected = await injectCredentials({
        projectPath,
        baseURL,
        credentials: allCreds,
        authFlow: null,
      });
      preAuthRoles = injected.filter((r) => r.loginVerified && r.storageStatePath);
      preAuthFailedRoles = injected.filter((r) => !r.loginVerified);
      if (preAuthRoles.length > 0) {
        Logger.info('ExplorationPhase', `Pre-auth login succeeded for ${preAuthRoles.length} role(s) — explorer will start authenticated`, {
          roles: preAuthRoles.map((r) => r.role),
        });
      } else {
        const allNoLoginForm = injected.length > 0 && injected.every((r) => r.noLoginForm);
        if (allNoLoginForm) {
          Logger.warn('ExplorationPhase', 'Pre-auth skipped — sign-in route not found for any role. Check HEALIX_LOGIN_URL config or verify the app\'s login path');
        } else {
          Logger.info('ExplorationPhase', 'Pre-auth login could not be verified for any role — exploring as unauthenticated');
        }
      }
    } catch (preAuthErr) {
      Logger.warn('ExplorationPhase', 'Pre-auth attempt failed (best-effort)', { reason: preAuthErr.message });
    }
  }

  // Phase A: Parallel Playwright enrichment over all known static routes.
  // Runs before browser-use so the LLM agent can focus on gap-filling only.
  let phaseAEnrichments = new Map();
  const parallelEnrichmentEnabled = process.env.HEALIX_PARALLEL_ENRICHMENT !== '0';
  if (parallelEnrichmentEnabled && Array.isArray(knownRoutes) && knownRoutes.length > 0) {
    Logger.info('ExplorationPhase', 'Phase A: parallel Playwright enrichment over static routes', {
      routeCount: knownRoutes.length,
    });
    try {
      const concurrency = Math.max(1, parseInt(process.env.HEALIX_ENRICHMENT_CONCURRENCY || '3', 10));
      const timeBudgetMs = Math.max(10_000, parseInt(process.env.HEALIX_ENRICHMENT_BUDGET_MS || '90000', 10));
      // Derive priority paths by keyword-matching PRD feature names against known
      // route paths. Features have { name } shape; routes have { path } shape.
      const prdPaths = (() => {
        if (!Array.isArray(prdFeatures) || !prdFeatures.length) return [];
        const routePaths = knownRoutes.map((r) => (typeof r === 'string' ? r : r?.path || ''));
        const matched = new Set();
        for (const f of prdFeatures) {
          const name = (typeof f === 'string' ? f : f?.name || '').toLowerCase();
          const keywords = name.split(/[\s\-_/]+/).filter((w) => w.length >= 4);
          for (const rp of routePaths) {
            if (keywords.some((kw) => rp.toLowerCase().includes(kw))) matched.add(rp);
          }
        }
        return Array.from(matched);
      })();
      const phaseA = await enrichAllRoutesWithDOM({
        routes: knownRoutes.map((r) => (typeof r === 'string' ? { path: r } : r)),
        baseURL,
        storageStatePaths: preAuthRoles,
        concurrency,
        timeBudgetMs,
        priorityPaths: prdPaths,
        onHeartbeat: () => {},
      });
      phaseAEnrichments = phaseA.enrichments;
      if (phaseA.timedOut) {
        Logger.warn('ExplorationPhase', 'Phase A enrichment hit time budget before completing all routes', {
          enriched: phaseAEnrichments.size,
          total: knownRoutes.length,
        });
      } else {
        Logger.info('ExplorationPhase', 'Phase A enrichment complete', { enriched: phaseAEnrichments.size });
      }
    } catch (phaseAErr) {
      Logger.warn('ExplorationPhase', 'Phase A enrichment failed (non-fatal)', { reason: phaseAErr.message });
    }
  }

  // Only withhold credentials for roles that successfully pre-authed.
  // If admin pre-authed but user failed, still pass the user credential to
  // browser-use so it can attempt login for that role's routes.
  const allCreds = Array.isArray(credentials) ? credentials : (cred ? [cred] : []);
  const preAuthRoleKeys = new Set(preAuthRoles.map((r) => normalizeRoleLabel(r.role || r.name || 'user')));
  const failedCreds = allCreds.filter((c) => !preAuthRoleKeys.has(normalizeRoleLabel(c.role || c.name || 'user')));
  const browserUseCred = failedCreds.length > 0 ? { username: failedCreds[0].username, password: failedCreds[0].password } : undefined;

  // -------------------------------------------------------
  // PRIMARY explorer: the deterministic Playwright crawl. It is seeded with the
  // statically-known routes (Step 1/2) and runs one authenticated walk per role,
  // so it always produces the base artifact — regardless of whether browser-use
  // is installed. This is the workhorse that should reach ~60-80% coverage.
  // -------------------------------------------------------
  const playwright = await runPlaywrightFallback({
    baseURL,
    credsForAgent: browserUseCred,
    preAuthRoles,
    seedRoutes: knownRoutes,
  });

  let result;
  let source;
  if (playwright.available) {
    result = playwright;
    source = 'playwright-primary';
  } else {
    result = { available: true, artifact: { ...EMPTY_ARTIFACT, observedErrors: [`playwright primary unavailable: ${playwright.reason || 'unknown'}`] } };
    source = 'playwright-unavailable';
  }

  // -------------------------------------------------------
  // SECONDARY explorer: browser-use surgical gap-fill. It is fed the union of
  // statically-known routes and everything the primary crawl already discovered,
  // so its prompt's "ALREADY MAPPED" set is accurate and it spends its LLM steps
  // only on genuine gaps (dynamic nav, role-gated menus, multi-step flows).
  // Optional: degrades silently when browser-use is not installed.
  // -------------------------------------------------------
  const alreadyMapped = [...new Set([
    ...(Array.isArray(knownRoutes) ? knownRoutes.map((r) => (typeof r === 'string' ? r : r?.path)) : []),
    ...((result.artifact?.routes || []).map((r) => r?.path)),
  ].filter(Boolean))].map((p) => ({ path: p }));

  let gapFill;
  try {
    gapFill = await driveExploration({
      targetUrl: baseURL,
      credentials: browserUseCred,
      allCredentials: allCreds,
      preAuthRoleCount: preAuthRoles.length,
      preAuthRoles,
      totalTimeoutMs,
      knownRoutes: alreadyMapped,
      prdFeatures: Array.isArray(prdFeatures) ? prdFeatures : [],
      onHeartbeat: () => { /* noop — heartbeats could be surfaced to status later */ },
    });
  } catch (buErr) {
    gapFill = { available: false, reason: buErr.message };
  }

  if (gapFill?.available && artifactHasUsefulContext(gapFill.artifact)) {
    const before = (result.artifact?.routes || []).length;
    const merged = mergeGapFillArtifact(result.artifact || { ...EMPTY_ARTIFACT }, gapFill.artifact);
    const added = (merged.routes || []).length - before;
    result = { ...result, artifact: merged };
    // Enrich any net-new routes the gap-fill discovered.
    if (added > 0) {
      result = { ...result, artifact: await _applyDOMEnrichment(result.artifact, { baseURL, preAuthRoles }) };
    }
    source = playwright.available ? 'playwright-primary+browser-use-gapfill' : 'browser-use';
    Logger.info('ExplorationPhase', `browser-use gap-fill added ${added} route(s) beyond the primary crawl`, {
      primaryRoutes: before,
      gapFillRoutes: (gapFill.artifact?.routes || []).length,
    });
  } else if (!playwright.available) {
    // Neither the primary crawl nor browser-use produced anything usable.
    Logger.warn('ExplorationPhase', 'No exploration available — primary crawl and browser-use both failed', {
      playwrightReason: playwright.reason,
      gapFillReason: gapFill?.reason,
    });
    return {
      artifact: {
        ...EMPTY_ARTIFACT,
        observedErrors: [`exploration unavailable: ${playwright.reason || gapFill?.reason || 'unknown'}`],
      },
      source: 'unavailable',
      reason: playwright.reason || gapFill?.reason || 'exploration unavailable',
      preAuthRoles,
    };
  } else if (gapFill && !gapFill.available) {
    Logger.info('ExplorationPhase', 'browser-use gap-fill unavailable — using Playwright primary crawl only', {
      reason: gapFill.reason,
    });
  }

  // Merge Phase A enrichments into the live artifact. Live browser data wins on
  // conflict — Phase A data only fills gaps where the live pass has no DOM data.
  let mergedArtifact = result.artifact || {};
  if (phaseAEnrichments.size > 0) {
    const liveRoutes = Array.isArray(mergedArtifact.routes) ? mergedArtifact.routes : [];
    const livePathSet = new Set(liveRoutes.map((r) => r.path));
    // Enrich existing live routes that lack DOM data
    const enrichedLive = liveRoutes.map((r) => {
      if (phaseAEnrichments.has(r.path) && !r.labels && !r.buttons) {
        return { ...phaseAEnrichments.get(r.path), ...r };
      }
      return r;
    });
    // Add Phase A routes not found by the live browser pass
    const extraRoutes = [];
    for (const [routePath, dom] of phaseAEnrichments) {
      if (!livePathSet.has(routePath)) {
        extraRoutes.push({ path: routePath, requiresAuth: false, source: 'phase_a_enrichment', ...dom });
      }
    }
    mergedArtifact = { ...mergedArtifact, routes: [...enrichedLive, ...extraRoutes] };
  }

  const artifact = normalizeExplorationArtifact(mergedArtifact, source);

  if (statusDir) {
    try {
      fs.writeFileSync(
        path.join(statusDir, 'exploration-artifact.json'),
        JSON.stringify(artifact, null, 2),
        'utf-8'
      );
    } catch (err) {
      Logger.warn('ExplorationPhase', 'Failed to cache exploration-artifact.json', { reason: err.message });
    }
  }

  return { artifact, source, preAuthRoles, preAuthFailedRoles };
}

module.exports = {
  runExplorationPhase,
  EMPTY_ARTIFACT,
  normalizeExplorationArtifact,
  artifactHasUsefulContext,
  mergeGapFillArtifact,
};
