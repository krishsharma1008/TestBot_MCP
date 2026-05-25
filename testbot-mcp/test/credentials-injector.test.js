const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildLoginCandidates,
  buildSuccessLocators,
  normalizeRoleLabel,
  shouldAcceptLoginVerification,
  stateFileFor,
  summarizeAuthStateEvidence,
  fillFirstVisible,
  DEFAULT_USERNAME_SELECTORS,
} = require('../src/credentials-injector');

// Minimal Playwright page/locator double for fillFirstVisible.
//
// `dom` maps a CSS selector → element descriptor. A descriptor with `count: 0`
// (or omitted from `dom`) simulates "selector does not match anything". A
// descriptor with `visibleAfterMs` simulates a late-hydrating field that
// becomes visible after a delay, so we can prove that deferred selectors are
// re-checked on the second pass.
function makeFakePage(dom = {}) {
  const calls = { count: [], waitFor: [], fill: [] };
  const page = {
    calls,
    locator(selector) {
      const entry = dom[selector];
      return {
        first() {
          return {
            async count() {
              calls.count.push(selector);
              return entry?.count ?? 0;
            },
            async waitFor({ timeout } = {}) {
              calls.waitFor.push({ selector, timeout });
              if (!entry) throw new Error(`no element for ${selector}`);
              const delay = entry.visibleAfterMs ?? 0;
              if (delay > 0 && delay > (timeout ?? 0)) {
                throw new Error(`Timeout ${timeout}ms waiting for ${selector}`);
              }
              if (delay > 0) await new Promise((r) => setTimeout(r, delay));
            },
            async fill(value) {
              calls.fill.push({ selector, value });
            },
          };
        },
      };
    },
  };
  return page;
}

test('fillFirstVisible fast-fails selectors with zero DOM matches', async () => {
  const page = makeFakePage({
    'input[type="text"]': { count: 1 },
  });
  const selectors = [
    'input[type="email"]',
    'input[name="username"]',
    'input[type="text"]',
  ];
  const result = await fillFirstVisible(page, selectors, 'admin', 10_000);

  assert.equal(result.ok, true);
  assert.equal(result.selector, 'input[type="text"]');
  // All three selectors should have been probed via count().
  assert.deepEqual(page.calls.count, [
    'input[type="email"]',
    'input[name="username"]',
    'input[type="text"]',
  ]);
  // waitFor must only be invoked for selectors that actually exist (count>0).
  // The whole point of the fix: non-matching selectors do NOT burn the budget.
  assert.deepEqual(page.calls.waitFor.map((c) => c.selector), [
    'input[type="text"]',
  ]);
  assert.deepEqual(page.calls.fill, [{ selector: 'input[type="text"]', value: 'admin' }]);
});

test('fillFirstVisible fills the first matching selector and stops', async () => {
  const page = makeFakePage({
    'input[name="username"]': { count: 1 },
    'input[type="text"]': { count: 1 },
  });
  const selectors = ['input[name="username"]', 'input[type="text"]'];
  const result = await fillFirstVisible(page, selectors, 'admin', 10_000);

  assert.equal(result.ok, true);
  assert.equal(result.selector, 'input[name="username"]');
  assert.equal(page.calls.fill.length, 1, 'should fill exactly one field');
  assert.equal(page.calls.fill[0].selector, 'input[name="username"]');
});

test('fillFirstVisible re-checks deferred selectors on a second pass for late hydration', async () => {
  // Selector that doesn't exist on first count() but is added before the
  // deferred re-check. We simulate this by tracking how many times count()
  // has been called for that selector.
  let countCalls = 0;
  const page = {
    calls: { waitFor: [], fill: [] },
    locator(selector) {
      return {
        first() {
          return {
            async count() {
              if (selector === 'input[name="username"]') {
                countCalls += 1;
                // First-pass: not yet in DOM. Second-pass (deferred): present.
                return countCalls >= 2 ? 1 : 0;
              }
              return 0;
            },
            async waitFor({ timeout } = {}) {
              page.calls.waitFor.push({ selector, timeout });
              if (selector !== 'input[name="username"]') {
                throw new Error(`no element for ${selector}`);
              }
            },
            async fill(value) {
              page.calls.fill.push({ selector, value });
            },
          };
        },
      };
    },
  };

  const result = await fillFirstVisible(
    page,
    ['input[type="email"]', 'input[name="username"]'],
    'admin',
    10_000,
  );

  assert.equal(result.ok, true);
  assert.equal(result.selector, 'input[name="username"]');
  // The deferred second pass must use a shorter waitFor timeout (<= 2000ms)
  // so a late-hydrating field doesn't monopolise the whole budget.
  const usernameWait = page.calls.waitFor.find((c) => c.selector === 'input[name="username"]');
  assert.ok(usernameWait, 'username selector should have been retried in deferred pass');
  assert.ok(usernameWait.timeout <= 2_000, `deferred wait should be <=2000ms, got ${usernameWait.timeout}`);
});

test('fillFirstVisible returns ok:false when no selector matches in either pass', async () => {
  const page = makeFakePage({}); // nothing in the DOM
  const result = await fillFirstVisible(
    page,
    ['input[type="email"]', 'input[name="username"]'],
    'admin',
    1_500,
  );

  assert.equal(result.ok, false);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0, `expected a non-empty reason, got: ${result.reason}`);
  // No fill should have happened.
  assert.equal(page.calls.fill.length, 0);
});

test('fillFirstVisible respects the overall deadline and bails out early', async () => {
  // Every selector exists but every visibility wait stalls past the budget.
  const dom = {};
  const selectors = ['input[type="email"]', 'input[name="username"]', 'input[type="text"]'];
  for (const s of selectors) dom[s] = { count: 1, visibleAfterMs: 10_000 };
  const page = makeFakePage(dom);

  const started = Date.now();
  const result = await fillFirstVisible(page, selectors, 'admin', 800);
  const elapsed = Date.now() - started;

  assert.equal(result.ok, false);
  // Hard upper bound — 800ms budget plus a generous slack for CI scheduling.
  assert.ok(elapsed < 4_000, `should bail near deadline, took ${elapsed}ms`);
});

test('DEFAULT_USERNAME_SELECTORS includes form-positional fallbacks for name-less React inputs', () => {
  // Regression guard: the DevAPI Hub demo (and similar React forms) bind via
  // value/onChange and ship inputs with no name attribute. Without these
  // fallbacks the injector cannot locate the username field.
  assert.ok(
    DEFAULT_USERNAME_SELECTORS.includes('form:has(input[type="password"]) input[type="text"]'),
    'expected form-with-password positional selector for text inputs',
  );
  assert.ok(
    DEFAULT_USERNAME_SELECTORS.includes('form:has(input[type="password"]) input:not([type])'),
    'expected form-with-password positional selector for type-less inputs',
  );
  assert.ok(
    DEFAULT_USERNAME_SELECTORS.some((s) => /placeholder\*="user"/i.test(s)),
    'expected a placeholder-based fallback for username',
  );
  assert.ok(
    DEFAULT_USERNAME_SELECTORS.some((s) => /placeholder\*="email"/i.test(s)),
    'expected a placeholder-based fallback for email',
  );
  // input[type="text"] must remain as the final catch-all.
  assert.equal(DEFAULT_USERNAME_SELECTORS[DEFAULT_USERNAME_SELECTORS.length - 1], 'input[type="text"]');
});

test('credential injector probes common login routes when authFlow is unknown', () => {
  assert.deepEqual(
    buildLoginCandidates('http://localhost:3001'),
    [
      'http://localhost:3001/',
      'http://localhost:3001/login',
      'http://localhost:3001/signin',
      'http://localhost:3001/sign-in',
      'http://localhost:3001/auth/login',
      'http://localhost:3001/auth/signin',
      'http://localhost:3001/auth/sign-in',
      'http://localhost:3001/users/sign_in',
      'http://localhost:3001/account/login',
    ],
  );
});

test('credential injector honors explicit authFlow loginUrl before fallbacks', () => {
  assert.deepEqual(
    buildLoginCandidates('http://localhost:3001', { loginUrl: '/admin/login' }),
    ['http://localhost:3001/admin/login'],
  );
});

test('credential injector does not trust register pages as login authFlow', () => {
  assert.deepEqual(
    buildLoginCandidates('http://localhost:3001', {
      loginUrl: '/register',
      intent: 'register',
      credentialFields: { username: 'input[name="email"]', password: 'input[type="password"]' },
    }),
    [
      'http://localhost:3001/',
      'http://localhost:3001/login',
      'http://localhost:3001/signin',
      'http://localhost:3001/sign-in',
      'http://localhost:3001/auth/login',
      'http://localhost:3001/auth/signin',
      'http://localhost:3001/auth/sign-in',
      'http://localhost:3001/users/sign_in',
      'http://localhost:3001/account/login',
    ],
  );
});

test('credential injector normalizes role aliases for storageState names', () => {
  assert.equal(normalizeRoleLabel('Administrator'), 'admin');
  assert.equal(normalizeRoleLabel('super_admin'), 'admin');
  assert.equal(normalizeRoleLabel('Authenticated'), 'user');
  assert.equal(normalizeRoleLabel('QA Admin'), 'qa_admin');
  assert.match(stateFileFor('/tmp/app', 'Administrator'), /auth-state-admin\.json$/);
});

test('credential injector recognizes common auth storage evidence', () => {
  assert.deepEqual(
    summarizeAuthStateEvidence({
      cookies: [{ name: '__Secure-next-auth.session-token', value: 'abc' }],
      storageKeys: [],
    }),
    {
      hasAuthState: true,
      cookieName: '__Secure-next-auth.session-token',
      storageKey: null,
    },
  );

  assert.deepEqual(
    summarizeAuthStateEvidence({
      cookies: [{ name: '_ga', value: 'analytics' }],
      storageKeys: ['sb-otanlyuasavknmdnvzxz-auth-token'],
    }),
    {
      hasAuthState: true,
      cookieName: null,
      storageKey: 'sb-otanlyuasavknmdnvzxz-auth-token',
    },
  );

  assert.deepEqual(
    summarizeAuthStateEvidence({
      cookies: [{ name: 'connect.sid', value: 'signed-session' }],
      storageKeys: [],
    }),
    {
      hasAuthState: true,
      cookieName: 'connect.sid',
      storageKey: null,
    },
  );

  assert.deepEqual(
    summarizeAuthStateEvidence({
      cookies: [{ name: 'csrf_token', value: 'csrf' }],
      storageKeys: ['currentUser'],
    }),
    {
      hasAuthState: true,
      cookieName: null,
      storageKey: 'currentUser',
    },
  );
});

test('credential injector treats discovered successIndicator as advisory', () => {
  assert.equal(shouldAcceptLoginVerification({
    urlChanged: true,
    successIndicatorVisible: false,
    authStateEvidence: { hasAuthState: false },
    failureVisible: false,
  }), true);

  assert.equal(shouldAcceptLoginVerification({
    urlChanged: false,
    successIndicatorVisible: false,
    authStateEvidence: { hasAuthState: true, storageKey: 'sb-app-auth-token' },
    failureVisible: false,
  }), true);

  assert.equal(shouldAcceptLoginVerification({
    urlChanged: true,
    successIndicatorVisible: true,
    authStateEvidence: { hasAuthState: true },
    failureVisible: true,
  }), false);
});

test('credential injector checks durable logged-in markers and username text', () => {
  const locators = buildSuccessLocators(
    { successIndicator: 'nav >> text=Signed in' },
    { username: 'customer@example.test' },
  );

  assert.ok(locators.includes('nav >> text=Signed in'));
  assert.ok(locators.includes('text=/log\\s*out/i'));
  assert.ok(locators.includes('text=\"customer@example.test\"'));
});
