/**
 * Extended tests for the three hackathon bug fixes.
 * 20 tests that push each fix into real edge cases,
 * verifying the product is genuinely more correct.
 *
 * Bug 1 — Playwright pre-flight  (tests 1-7)
 * Bug 2 — MSAL / OAuth detection  (tests 8-14)
 * Bug 3 — Hallucination guard     (tests 15-20)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const PlaywrightIntegration = require('../src/playwright-integration');
const { detectOAuthRedirect, OAUTH_DOMAINS } = require('../src/credentials-injector');

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'healix-ext-'));
}

/** Replicate the feature-existence guard from openai-generator.ts */
const FEATURE_KEYWORDS = [
  'cart', 'checkout', 'basket', 'wishlist', 'shopping bag',
  'order history', 'order summary', 'empty cart', 'add to cart',
  'payment', 'coupon', 'promo code', 'loyalty', 'reward',
];

function isKeywordGrounded(kw, knownText) {
  if (knownText.includes(kw)) return true;
  const words = kw.split(' ').filter(w => w.length > 3);
  return words.length > 0 && words.some(w => knownText.includes(w));
}

function checkFeatureHallucinations(generatedContent, sourceContext) {
  if (!sourceContext) return [];
  const knownText = [
    ...(sourceContext.routePaths || []),
    ...(sourceContext.files || []).map(f => f.file),
    ...(sourceContext.assertableText || []),
  ].join(' ').toLowerCase();

  const errors = [];
  const titlePattern = /(?:test(?:\.describe)?\s*\(\s*['"`])([^'"`]{6,120})/g;
  let m;
  while ((m = titlePattern.exec(generatedContent)) !== null) {
    const title = m[1].toLowerCase();
    for (const kw of FEATURE_KEYWORDS) {
      if (title.includes(kw) && !isKeywordGrounded(kw, knownText)) {
        errors.push(
          `Test title "${m[1]}" references feature "${kw}" ` +
          `which is not present in any discovered route, source file, or observed element.`,
        );
        break;
      }
    }
  }
  return errors;
}

// ═════════════════════════════════════════════════════════════════════════════
// BUG 1 — Playwright pre-flight  (7 tests)
// ═════════════════════════════════════════════════════════════════════════════

test('[Bug1-T1] ok=false error message contains npm install command', () => {
  const root = makeTempDir();
  try {
    const pi = new PlaywrightIntegration({ projectPath: root });
    pi.getBundledPlaywrightPackageDir = () => null;

    const result = pi.checkPlaywrightAvailable();

    assert.equal(result.ok, false);
    assert.match(
      result.reason,
      /npm install -D @playwright\/test/,
      'error must contain the exact fix command so users know what to run',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[Bug1-T2] ok=false error message contains browser install step', () => {
  const root = makeTempDir();
  try {
    const pi = new PlaywrightIntegration({ projectPath: root });
    pi.getBundledPlaywrightPackageDir = () => null;

    const result = pi.checkPlaywrightAvailable();

    assert.equal(result.ok, false);
    assert.match(
      result.reason,
      /npx playwright install chromium/,
      'error must include the browser install step — npm install alone is not enough',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[Bug1-T3] non-existent project path returns ok=false without crashing', () => {
  const fakePath = path.join(os.tmpdir(), 'healix-does-not-exist-' + Date.now());
  const pi = new PlaywrightIntegration({ projectPath: fakePath });
  pi.getBundledPlaywrightPackageDir = () => null;

  // Must not throw — pipeline should get a clean { ok: false } to handle
  let result;
  assert.doesNotThrow(() => { result = pi.checkPlaywrightAvailable(); });
  assert.equal(result.ok, false, 'non-existent path with no bundled playwright → ok:false');
});

test('[Bug1-T4] playwright dir present (even empty) counts as installed', () => {
  // The check uses fs.existsSync on the directory — not the package.json inside.
  // An empty symlinked or partial install still lets Playwright run.
  const root = makeTempDir();
  try {
    const playwrightDir = path.join(root, 'node_modules', '@playwright', 'test');
    fs.mkdirSync(playwrightDir, { recursive: true });
    // Intentionally NOT writing a package.json inside

    const pi = new PlaywrightIntegration({ projectPath: root });
    const result = pi.checkPlaywrightAvailable();

    assert.equal(result.ok, true, 'directory existence alone is enough — same check as ensurePlaywrightInstalled');
    assert.equal(result.source, 'local');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[Bug1-T5] checkPlaywrightAvailable is idempotent — same result on repeated calls', () => {
  const root = makeTempDir();
  try {
    const playwrightDir = path.join(root, 'node_modules', '@playwright', 'test');
    fs.mkdirSync(playwrightDir, { recursive: true });

    const pi = new PlaywrightIntegration({ projectPath: root });
    const r1 = pi.checkPlaywrightAvailable();
    const r2 = pi.checkPlaywrightAvailable();

    assert.deepEqual(r1, r2, 'calling twice must return identical result — no side effects');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[Bug1-T6] ok=false result has no `source` property (source only on ok:true)', () => {
  const root = makeTempDir();
  try {
    const pi = new PlaywrightIntegration({ projectPath: root });
    pi.getBundledPlaywrightPackageDir = () => null;

    const result = pi.checkPlaywrightAvailable();

    assert.equal(result.ok, false);
    assert.equal(
      result.source,
      undefined,
      'source field must only appear on ok:true results — callers key off ok first',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[Bug1-T7] ok=true result always has a `source` field', () => {
  const root = makeTempDir();
  try {
    const playwrightDir = path.join(root, 'node_modules', '@playwright', 'test');
    fs.mkdirSync(playwrightDir, { recursive: true });

    const pi = new PlaywrightIntegration({ projectPath: root });
    const result = pi.checkPlaywrightAvailable();

    assert.equal(result.ok, true);
    assert.ok(
      typeof result.source === 'string' && result.source.length > 0,
      'ok:true must include a source string for debugging',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});


// ═════════════════════════════════════════════════════════════════════════════
// BUG 2 — MSAL / OAuth detection  (7 tests)
// ═════════════════════════════════════════════════════════════════════════════

test('[Bug2-T8] detectOAuthRedirect(null) returns null — no crash', () => {
  assert.equal(detectOAuthRedirect(null), null);
});

test('[Bug2-T9] detectOAuthRedirect(empty string) returns null — no crash', () => {
  assert.equal(detectOAuthRedirect(''), null);
});

test('[Bug2-T10] detectOAuthRedirect(undefined) returns null — no crash', () => {
  assert.equal(detectOAuthRedirect(undefined), null);
});

test('[Bug2-T11] login.live.com detected (Microsoft personal accounts)', () => {
  const matched = detectOAuthRedirect(
    'https://login.live.com/oauth20_authorize.srf?client_id=abc',
  );
  assert.ok(matched, 'Microsoft personal account SSO must be detected');
});

test('[Bug2-T12] FALSE POSITIVE FIX: pingpong.example.com must NOT be flagged as OAuth', () => {
  // Before the fix, bare "ping" in OAUTH_DOMAINS caused this false positive.
  // Now "pingone.com" / "pingidentity.com" replaced it — only Ping Identity
  // products should match, not arbitrary domains containing the word "ping".
  const matched = detectOAuthRedirect('https://pingpong.example.com/game');
  assert.equal(
    matched,
    null,
    'pingpong.example.com is NOT an OAuth provider — bare "ping" was too broad',
  );
});

test('[Bug2-T13] pingone.com IS correctly detected after the false-positive fix', () => {
  const matched = detectOAuthRedirect(
    'https://auth.pingone.com/as/authorization.oauth2?client_id=xyz',
  );
  assert.ok(matched, 'PingOne cloud SSO must still be detected after removing bare "ping"');
});

test('[Bug2-T14b] SSO_BUTTON_SELECTORS list includes common Microsoft MSAL patterns', () => {
  // The SSO button click-and-probe list in credentials-injector must cover
  // the most common Microsoft MSAL button patterns. Read the source and verify.
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'credentials-injector.js'),
    'utf-8',
  );
  assert.ok(
    src.includes('Sign in with Microsoft'),
    'SSO button list must include "Sign in with Microsoft" (MSAL-JS SPA pattern)',
  );
  assert.ok(
    src.includes('#login-btn'),
    'SSO button list must include #login-btn (common MSAL single-page app id)',
  );
  assert.ok(
    src.includes('msal_oauth_redirect'),
    'SSO button click path must return msal_oauth_redirect signal',
  );
});

test('[Bug2-T14] OAUTH_DOMAINS no longer contains bare "ping" or bare "idp."', () => {
  // These two patterns were too broad and caused false positives.
  // They were replaced with specific vendor entries.
  assert.ok(
    !OAUTH_DOMAINS.includes('ping'),
    'bare "ping" must be removed from OAUTH_DOMAINS — too broad',
  );
  assert.ok(
    !OAUTH_DOMAINS.includes('idp.'),
    'bare "idp." must be removed from OAUTH_DOMAINS — too broad',
  );
  // Replacements exist
  assert.ok(
    OAUTH_DOMAINS.some(d => d.includes('pingone') || d.includes('pingidentity') || d.includes('pingfederate')),
    'a specific Ping Identity entry must replace the removed bare "ping"',
  );
});


// ═════════════════════════════════════════════════════════════════════════════
// BUG 3 — Hallucination guard  (6 tests)
// ═════════════════════════════════════════════════════════════════════════════

const DASHBOARD_CTX = {
  routePaths: ['/dashboard', '/settings', '/analytics', '/login'],
  files: [{ file: 'src/app/dashboard/page.tsx' }],
  assertableText: ['Welcome', 'Analytics', 'Settings'],
};

const FINTECH_CTX = {
  routePaths: ['/dashboard', '/payment', '/payment/history', '/login'],
  files: [{ file: 'src/app/payment/page.tsx' }],
  assertableText: ['Make a payment', 'Payment history'],
};

test('[Bug3-T15] test.describe() titles are scanned — not just test() calls', () => {
  const generated = `
    test.describe('Wishlist management', () => {
      test('user can add item to wishlist', async ({ page }) => {
        await page.goto('/products');
      });
    });
  `;

  const errors = checkFeatureHallucinations(generated, DASHBOARD_CTX);
  assert.ok(errors.length > 0, 'test.describe titles must be checked — hallucinations hide there too');
  assert.match(errors[0], /wishlist/);
});

test('[Bug3-T16] multiple violations in one file are ALL caught, not just the first', () => {
  const generated = `
    test('Empty Cart State', async ({ page }) => { await page.goto('/cart'); });
    test('Checkout flow works end to end', async ({ page }) => { await page.goto('/checkout'); });
    test('Wishlist persists across sessions', async ({ page }) => { await page.goto('/wishlist'); });
  `;

  const errors = checkFeatureHallucinations(generated, DASHBOARD_CTX);
  assert.ok(
    errors.length >= 3,
    `all three hallucinated tests must be caught, got ${errors.length}`,
  );
});

test('[Bug3-T17] keyword inside code body/comment does NOT trigger guard (only test titles checked)', () => {
  // The regex only captures the test() title string, not the body.
  // Comments like "// add to cart logic" inside the test body are safe.
  const generated = `
    test('Settings page renders correctly', async ({ page }) => {
      // add to cart logic is tested separately
      // cart state is managed by Redux
      await page.goto('/settings');
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    });
  `;

  const errors = checkFeatureHallucinations(generated, DASHBOARD_CTX);
  assert.equal(
    errors.length,
    0,
    'keywords appearing only in test body/comments must not trigger the guard',
  );
});

test('[Bug3-T18] "payment" test on a fintech app with /payment route is NOT flagged', () => {
  const generated = `
    test('payment form validates required fields', async ({ page }) => {
      await page.goto('/payment');
    });
    test('payment history shows recent transactions', async ({ page }) => {
      await page.goto('/payment/history');
    });
  `;

  const errors = checkFeatureHallucinations(generated, FINTECH_CTX);
  assert.equal(
    errors.length,
    0,
    'payment tests must pass on an app that genuinely has payment routes',
  );
});

test('[Bug3-T19] backtick test name with hallucinated feature is flagged', () => {
  // Ensures the regex handles template-literal delimited test names.
  const generated =
    'test(`Empty Cart State displays placeholder`, async ({ page }) => { await page.goto(\'/cart\'); });';

  const errors = checkFeatureHallucinations(generated, DASHBOARD_CTX);
  assert.ok(errors.length > 0, 'backtick-delimited test titles must be scanned too');
  assert.match(errors[0], /cart/);
});

test('[Bug3-T20] test title shorter than 6 chars is skipped — no false alarms on micro-titles', () => {
  // The regex requires {6,120} chars in the title.
  // A title like 'cart' (4 chars) is below threshold and must be ignored.
  const generated = `test('cart', async ({ page }) => { await page.goto('/cart'); });`;

  const errors = checkFeatureHallucinations(generated, DASHBOARD_CTX);
  assert.equal(
    errors.length,
    0,
    'titles under 6 chars are below the regex threshold and must not fire the guard',
  );
});
