const assert = require('node:assert/strict');
const test = require('node:test');

const { mergeGapFillArtifact } = require('../src/exploration-phase');
const { synthesizeExplorationArtifactFromContext } = require('../src/pipeline-worker');

test('mergeGapFillArtifact keeps all primary routes and adds only net-new gap-fill routes', () => {
  const primary = {
    routes: [
      { path: '/', requiresAuth: false, elements: [{ name: 'Home' }] },
      { path: '/admindashboard', requiresAuth: true, requiredRole: 'admin' },
    ],
    forms: [],
    keyFlows: [],
    observedErrors: ['primary-err'],
    authFlow: { loginUrl: '/login' },
  };
  const gapFill = {
    routes: [
      { path: '/admindashboard', requiresAuth: true },          // duplicate — must not overwrite
      { path: '/admindashboard/settings', requiresAuth: true }, // net-new
    ],
    forms: [],
    keyFlows: [],
    observedErrors: ['gapfill-err'],
    authFlow: null,
  };

  const merged = mergeGapFillArtifact(primary, gapFill);
  const paths = merged.routes.map((r) => r.path);

  assert.deepEqual(paths, ['/', '/admindashboard', '/admindashboard/settings']);
  // Duplicate route kept the primary's data (still has requiredRole).
  assert.equal(merged.routes.find((r) => r.path === '/admindashboard').requiredRole, 'admin');
  // Net-new route tagged as gap-fill sourced.
  assert.equal(merged.routes.find((r) => r.path === '/admindashboard/settings').source, 'browser-use-gapfill');
});

test('mergeGapFillArtifact unions forms and keyFlows without duplicating', () => {
  const primary = {
    routes: [],
    forms: [{ route: '/login', fields: ['email', 'password'] }],
    keyFlows: [{ name: 'login' }],
    observedErrors: [],
  };
  const gapFill = {
    routes: [],
    forms: [
      { route: '/login', fields: ['email', 'password'] }, // duplicate
      { route: '/profile', fields: ['name'] },             // net-new
    ],
    keyFlows: [
      { name: 'login' },                 // duplicate
      { name: 'update-profile' },        // net-new
    ],
    observedErrors: [],
  };

  const merged = mergeGapFillArtifact(primary, gapFill);
  assert.equal(merged.forms.length, 2);
  assert.deepEqual(merged.keyFlows.map((k) => k.name), ['login', 'update-profile']);
});

test('mergeGapFillArtifact dedups observedErrors and prefers the primary authFlow', () => {
  const primary = {
    routes: [], forms: [], keyFlows: [],
    observedErrors: ['shared', 'p-only'],
    authFlow: { loginUrl: '/login', credentialFields: { username: '#u', password: '#p' } },
  };
  const gapFill = {
    routes: [], forms: [], keyFlows: [],
    observedErrors: ['shared', 'g-only'],
    authFlow: { loginUrl: '/signin' },
  };

  const merged = mergeGapFillArtifact(primary, gapFill);
  assert.deepEqual(merged.observedErrors.sort(), ['g-only', 'p-only', 'shared']);
  // chooseBetterAuthFlow prefers the more complete primary flow.
  assert.equal(merged.authFlow.loginUrl, '/login');
});

test('mergeGapFillArtifact is safe with empty/missing gap-fill', () => {
  const primary = { routes: [{ path: '/' }], forms: [], keyFlows: [], observedErrors: [] };
  const merged = mergeGapFillArtifact(primary, {});
  assert.deepEqual(merged.routes.map((r) => r.path), ['/']);
});

// ── Fix B: OR-merge auth flags on duplicate routes ────────────────────────────

test('mergeGapFillArtifact OR-merges requiresAuth:true from gap-fill onto primary requiresAuth:false', () => {
  // Playwright primary defaults to false because it navigates with a pre-auth
  // storageState. The gap-fill source (seeded from knownRoutes) carries the
  // correct static-analysis signal. The merge must preserve the truthy value.
  const primary = {
    routes: [
      { path: '/userdashboard', requiresAuth: false, source: 'playwright-primary' },
      { path: '/admindashboard', requiresAuth: false, source: 'playwright-primary' },
    ],
    forms: [], keyFlows: [], observedErrors: [],
  };
  const gapFill = {
    routes: [
      { path: '/userdashboard', requiresAuth: true, requiredRole: 'user' },
      { path: '/admindashboard', requiresAuth: true, requiredRole: 'admin' },
    ],
    forms: [], keyFlows: [], observedErrors: [],
  };

  const merged = mergeGapFillArtifact(primary, gapFill);

  assert.equal(merged.routes.length, 2, 'no duplicate routes added');
  const user = merged.routes.find((r) => r.path === '/userdashboard');
  const admin = merged.routes.find((r) => r.path === '/admindashboard');
  assert.equal(user.requiresAuth, true, '/userdashboard requiresAuth preserved');
  assert.equal(user.requiredRole, 'user', '/userdashboard requiredRole preserved');
  assert.equal(admin.requiresAuth, true, '/admindashboard requiresAuth preserved');
  assert.equal(admin.requiredRole, 'admin', '/admindashboard requiredRole preserved');
  // Primary source tag must not be overwritten.
  assert.equal(user.source, 'playwright-primary');
});

test('mergeGapFillArtifact primary requiredRole wins when both sources specify a role', () => {
  // Primary already has a correct role from a prior static-analysis pass; the
  // gap-fill role must not clobber it (OR logic: existing.requiredRole || r.requiredRole).
  const primary = {
    routes: [{ path: '/settings', requiresAuth: true, requiredRole: 'admin' }],
    forms: [], keyFlows: [], observedErrors: [],
  };
  const gapFill = {
    routes: [{ path: '/settings', requiresAuth: true, requiredRole: 'user' }],
    forms: [], keyFlows: [], observedErrors: [],
  };

  const merged = mergeGapFillArtifact(primary, gapFill);
  assert.equal(merged.routes[0].requiredRole, 'admin', 'primary requiredRole wins');
});

test('synthesizeExplorationArtifactFromContext preserves static requiresAuth:true when Playwright already has the route as false', () => {
  // The Playwright explorer pushes routes with requiresAuth:false (it sees all
  // content through a pre-auth storageState). Static analysis from context.pages
  // has the authoritative auth signal. synthesize must OR-merge, not skip.
  const playwrightArtifact = {
    routes: [
      { path: '/userdashboard', requiresAuth: false, source: 'playwright-primary' },
      { path: '/', requiresAuth: false, source: 'playwright-primary' },
    ],
    forms: [], keyFlows: [], observedErrors: [], authFlow: null,
  };
  const codebaseContext = {
    pages: [
      { path: '/userdashboard', requiresAuth: true, requiredRole: 'user' },
      { path: '/admindashboard', requiresAuth: true, requiredRole: 'admin' }, // not yet in artifact
      { path: '/', requiresAuth: false },
    ],
  };

  const result = synthesizeExplorationArtifactFromContext(codebaseContext, playwrightArtifact);
  const userDash = result.routes.find((r) => r.path === '/userdashboard');
  const adminDash = result.routes.find((r) => r.path === '/admindashboard');
  const home = result.routes.find((r) => r.path === '/');

  assert.ok(userDash, '/userdashboard present in result');
  assert.equal(userDash.requiresAuth, true, 'static requiresAuth:true preserved over Playwright false');
  assert.equal(userDash.requiredRole, 'user', 'requiredRole populated from static context');

  assert.ok(adminDash, '/admindashboard added from static context');
  assert.equal(adminDash.requiresAuth, true);
  assert.equal(adminDash.requiredRole, 'admin');

  assert.equal(home.requiresAuth, false, 'public route stays public');
});
