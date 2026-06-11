'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  VERDICTS,
  classifyFailures,
  classifyOne,
  clusterVerdicts,
  normalizeSelector,
  explorationKnowsSelector,
  inferFailingSelector,
} = require('../src/failure-triage/classifier');

// ---------------------------------------------------------------------------
// normalizeSelector
// ---------------------------------------------------------------------------

test('normalizeSelector strips quotes and lowercases', () => {
  assert.equal(normalizeSelector('button[name=\'Buy\']'), 'button[name=buy]');
  assert.equal(normalizeSelector('input[type="email"]'), 'input[type=email]');
  assert.equal(normalizeSelector('  BUTTON  '), 'button');
});

test('normalizeSelector returns empty string for non-string input', () => {
  assert.equal(normalizeSelector(null), '');
  assert.equal(normalizeSelector(undefined), '');
  assert.equal(normalizeSelector(42), '');
});

test('normalizeSelector collapses whitespace', () => {
  assert.equal(normalizeSelector('button  [name =  buy]'), 'button [name = buy]');
});

// ---------------------------------------------------------------------------
// explorationKnowsSelector
// ---------------------------------------------------------------------------

test('explorationKnowsSelector returns false for missing route', () => {
  assert.equal(explorationKnowsSelector(null, 'button'), false);
  assert.equal(explorationKnowsSelector(undefined, 'button'), false);
});

test('explorationKnowsSelector returns false when selector is empty', () => {
  const route = { selectors: ['button', 'input[name=email]'] };
  assert.equal(explorationKnowsSelector(route, ''), false);
  assert.equal(explorationKnowsSelector(route, null), false);
});

test('explorationKnowsSelector matches exact selector', () => {
  const route = { selectors: ['button[name="Submit"]', 'input[name="email"]'] };
  assert.equal(explorationKnowsSelector(route, 'button[name="Submit"]'), true);
});

test('explorationKnowsSelector uses substring matching', () => {
  const route = { selectors: ['button[data-testid="submit-btn"]'] };
  assert.equal(explorationKnowsSelector(route, 'submit-btn'), true);
  assert.equal(explorationKnowsSelector(route, 'button[data-testid="submit-btn"]'), true);
});

test('explorationKnowsSelector returns false for unknown selector', () => {
  const route = { selectors: ['button[name="Submit"]'] };
  assert.equal(explorationKnowsSelector(route, 'input[name="username"]'), false);
});

test('explorationKnowsSelector handles missing selectors array', () => {
  assert.equal(explorationKnowsSelector({}, 'button'), false);
  assert.equal(explorationKnowsSelector({ selectors: null }, 'button'), false);
});

// ---------------------------------------------------------------------------
// inferFailingSelector
// ---------------------------------------------------------------------------

test('inferFailingSelector prefers trace.failedAction.selector', () => {
  const bundle = {
    trace: { failedAction: { selector: 'button[name="Buy"]' } },
  };
  assert.equal(inferFailingSelector(bundle), 'button[name="Buy"]');
});

test('inferFailingSelector parses locator() from error message', () => {
  // Regex stops at quotes inside attribute values, so use a selector without embedded quotes
  const bundle = {
    error: { message: "locator('input.email-input').click: Timeout 30000ms" },
  };
  const sel = inferFailingSelector(bundle);
  assert.ok(sel && sel.includes('email'), `got: ${sel}`);
});

test('inferFailingSelector parses getByRole from error message', () => {
  const bundle = {
    error: { message: "getByRole('button', { name: 'Submit' }): element not found" },
  };
  const sel = inferFailingSelector(bundle);
  assert.ok(sel && sel.includes('Submit'), `got: ${sel}`);
});

test('inferFailingSelector parses getByText from error message', () => {
  const bundle = {
    error: { message: "getByText('Welcome back'): not visible" },
  };
  const sel = inferFailingSelector(bundle);
  assert.ok(sel && sel.includes('Welcome back'), `got: ${sel}`);
});

test('inferFailingSelector returns null for empty bundle', () => {
  assert.equal(inferFailingSelector({}), null);
  assert.equal(inferFailingSelector(null), null);
});

// ---------------------------------------------------------------------------
// classifyOne — Rule 3: server unreachable (fires first)
// ---------------------------------------------------------------------------

test('classifyOne Rule 3: net error → environment/server_unreachable', () => {
  const verdict = classifyOne({
    error: { message: 'net::ERR_CONNECTION_REFUSED' },
  });
  assert.equal(verdict.verdict, VERDICTS.ENVIRONMENT);
  assert.equal(verdict.reason, 'server_unreachable');
  assert.equal(verdict.ruleId, 3);
  assert.ok(verdict.confidence >= 0.9);
});

test('classifyOne Rule 3: ECONNREFUSED → environment', () => {
  const verdict = classifyOne({
    error: { message: 'connect ECONNREFUSED 127.0.0.1:3000' },
  });
  assert.equal(verdict.verdict, VERDICTS.ENVIRONMENT);
  assert.equal(verdict.ruleId, 3);
});

test('classifyOne Rule 3: page.goto Timeout → environment', () => {
  const verdict = classifyOne({
    error: { message: 'page.goto: Timeout 30000ms exceeded' },
  });
  assert.equal(verdict.verdict, VERDICTS.ENVIRONMENT);
  assert.equal(verdict.ruleId, 3);
});

// ---------------------------------------------------------------------------
// classifyOne — Rule 2: 5xx in network trail
// ---------------------------------------------------------------------------

test('classifyOne Rule 2: 500 in network → app_is_wrong', () => {
  const verdict = classifyOne({
    error: { message: 'Expected text "Success" but got "Error"' },
    trace: {
      networkAtFailure: [
        { url: 'http://localhost/api/checkout', method: 'POST', status: 500 },
      ],
    },
  });
  assert.equal(verdict.verdict, VERDICTS.APP_WRONG);
  assert.equal(verdict.ruleId, 2);
  assert.ok(verdict.confidence >= 0.85);
});

test('classifyOne Rule 2: 503 in network → app_is_wrong', () => {
  const verdict = classifyOne({
    trace: {
      networkAtFailure: [
        { url: 'http://localhost/api/users', method: 'GET', status: 503 },
      ],
    },
  });
  assert.equal(verdict.verdict, VERDICTS.APP_WRONG);
  assert.equal(verdict.ruleId, 2);
});

test('classifyOne Rule 2: 200 responses do not trigger server_error rule', () => {
  const verdict = classifyOne({
    error: { message: 'strict mode violation: resolved to 0 elements' },
    trace: {
      networkAtFailure: [
        { url: 'http://localhost/api/data', method: 'GET', status: 200 },
      ],
    },
  });
  assert.notEqual(verdict.ruleId, 2);
});

// ---------------------------------------------------------------------------
// classifyOne — Rule 1: selector not found
// ---------------------------------------------------------------------------

test('classifyOne Rule 1: hallucinated selector (unknown to exploration)', () => {
  const verdict = classifyOne({
    error: { message: "strict mode violation: locator('button[name=\"BuyNow\"]') resolved to 0 elements" },
    trace: { failedAction: { selector: 'button[name="BuyNow"]' } },
    explorationRoute: { selectors: ['button[name="AddToCart"]', 'input[name="qty"]'] },
  });
  assert.equal(verdict.verdict, VERDICTS.TEST_WRONG);
  assert.equal(verdict.reason, 'hallucinated_selector');
  assert.equal(verdict.ruleId, 1);
  assert.ok(verdict.confidence >= 0.85);
});

test('classifyOne Rule 1: known selector removed → app_is_wrong', () => {
  const verdict = classifyOne({
    error: { message: "locator.click: Timeout waiting for 'button[name=\"BuyNow\"]'" },
    trace: { failedAction: { selector: 'button[name="BuyNow"]' } },
    explorationRoute: { selectors: ['button[name="BuyNow"]', 'input[name="qty"]'] },
  });
  assert.equal(verdict.verdict, VERDICTS.APP_WRONG);
  assert.equal(verdict.reason, 'selector_removed_since_exploration');
  assert.equal(verdict.ruleId, 1);
});

test('classifyOne Rule 1: waiting for locator pattern', () => {
  const verdict = classifyOne({
    error: { message: 'waiting for locator("input[name=\'email\']") to be visible' },
    trace: { failedAction: { selector: "input[name='email']" } },
    explorationRoute: null,
  });
  assert.equal(verdict.verdict, VERDICTS.TEST_WRONG);
  assert.equal(verdict.reason, 'hallucinated_selector');
});

// ---------------------------------------------------------------------------
// classifyOne — Rule 4: tier-B auth failure
// ---------------------------------------------------------------------------

test('classifyOne Rule 4: tier-B auth → environment/auth_context_missing', () => {
  const verdict = classifyOne({
    tier: 'TierB-admin',
    error: { message: 'Unauthorized 401: authentication required' },
    trace: { failedAction: { url: 'http://localhost/dashboard' } },
  });
  assert.equal(verdict.verdict, VERDICTS.ENVIRONMENT);
  assert.equal(verdict.reason, 'auth_context_missing');
  assert.equal(verdict.ruleId, 4);
});

test('classifyOne Rule 4: tier-B redirected to /login URL → environment', () => {
  const verdict = classifyOne({
    tier: 'tierb-editor',
    error: { message: 'Timeout waiting for navigation' },
    trace: { failedAction: { url: 'http://localhost/login?redirect=/dashboard' } },
  });
  assert.equal(verdict.verdict, VERDICTS.ENVIRONMENT);
  assert.equal(verdict.reason, 'auth_context_missing');
  assert.equal(verdict.ruleId, 4);
});

test('classifyOne Rule 4: tier-A auth error does NOT trigger rule 4', () => {
  const verdict = classifyOne({
    tier: 'tierA-public',
    error: { message: 'Unauthorized 401' },
    trace: { failedAction: {} },
  });
  assert.notEqual(verdict.reason, 'auth_context_missing');
});

// ---------------------------------------------------------------------------
// classifyOne — Rule 5: assertion mismatch
// ---------------------------------------------------------------------------

test('classifyOne Rule 5: assertion failure with resolved selector → app_is_wrong', () => {
  const verdict = classifyOne({
    error: { message: 'expect(received).toHaveText(expected)\n  expected: "Welcome"\n  received: "Error"' },
    trace: {
      failedAction: {
        name: 'expect.toHaveText',
        selector: 'h1',
      },
    },
  });
  assert.equal(verdict.verdict, VERDICTS.APP_WRONG);
  assert.equal(verdict.reason, 'assertion_mismatch');
  assert.equal(verdict.ruleId, 5);
});

test('classifyOne Rule 5: toContainText assertion → app_is_wrong', () => {
  const verdict = classifyOne({
    error: { message: 'toContainText expected value not found' },
    trace: {
      failedAction: {
        name: 'expect.toContainText',
        selector: 'div.message',
      },
    },
  });
  assert.equal(verdict.verdict, VERDICTS.APP_WRONG);
  assert.equal(verdict.ruleId, 5);
});

// ---------------------------------------------------------------------------
// classifyOne — Rule 6: ambiguous fallback
// ---------------------------------------------------------------------------

test('classifyOne Rule 6: no matching rule → ambiguous', () => {
  const verdict = classifyOne({
    error: { message: 'Some unknown error occurred' },
    trace: { failedAction: {} },
  });
  assert.equal(verdict.verdict, VERDICTS.AMBIGUOUS);
  assert.equal(verdict.confidence, 0);
  assert.equal(verdict.ruleId, 6);
});

test('classifyOne returns ambiguous for null/missing bundle', () => {
  const v1 = classifyOne(null);
  assert.equal(v1.verdict, VERDICTS.AMBIGUOUS);
  assert.equal(v1.ruleId, 0);

  const v2 = classifyOne(undefined);
  assert.equal(v2.verdict, VERDICTS.AMBIGUOUS);

  const v3 = classifyOne('not-an-object');
  assert.equal(v3.verdict, VERDICTS.AMBIGUOUS);
});

// ---------------------------------------------------------------------------
// classifyFailures — batch classification
// ---------------------------------------------------------------------------

test('classifyFailures returns verdicts array and aiEligibleIndexes', () => {
  const bundles = [
    { error: { message: 'net::ERR_CONNECTION_REFUSED' } },
    { error: { message: 'Some unknown error' }, trace: { failedAction: {} } },
  ];
  const result = classifyFailures(bundles);

  assert.equal(result.verdicts.length, 2);
  assert.equal(result.verdicts[0].verdict, VERDICTS.ENVIRONMENT);
  assert.equal(result.verdicts[1].verdict, VERDICTS.AMBIGUOUS);

  // Rule 3 (server_unreachable, conf=0.92) → above threshold → not AI-eligible
  assert.ok(!result.aiEligibleIndexes.includes(0));
  // Rule 6 (ambiguous, conf=0) → AI-eligible
  assert.ok(result.aiEligibleIndexes.includes(1));
});

test('classifyFailures handles empty array', () => {
  const result = classifyFailures([]);
  assert.equal(result.verdicts.length, 0);
  assert.equal(result.clusters.length, 0);
  assert.equal(result.aiEligibleIndexes.length, 0);
});

test('classifyFailures handles non-array input gracefully', () => {
  const result = classifyFailures(null);
  assert.equal(result.verdicts.length, 0);
});

test('classifyFailures AI_SKIP_THRESHOLD excludes high-confidence verdicts', () => {
  const bundles = [
    { error: { message: 'net::ERR_CONNECTION_REFUSED' } }, // conf=0.92 → skip AI
    {
      error: { message: 'strict mode violation' },
      trace: { failedAction: { selector: 'button' } },
      explorationRoute: null,
    }, // conf=0.90 → skip AI
    {
      error: { message: 'Some unknown' },
      trace: { failedAction: {} },
    }, // conf=0 → needs AI
  ];
  const result = classifyFailures(bundles);
  assert.ok(!result.aiEligibleIndexes.includes(0));
  assert.ok(!result.aiEligibleIndexes.includes(1));
  assert.ok(result.aiEligibleIndexes.includes(2));
});

// ---------------------------------------------------------------------------
// clusterVerdicts
// ---------------------------------------------------------------------------

test('clusterVerdicts groups 3+ identical reason+selectorKey into a cluster', () => {
  const bundles = [
    { tier: 'tierA' },
    { tier: 'tierA' },
    { tier: 'tierA' },
  ];
  const verdicts = [
    { verdict: VERDICTS.TEST_WRONG, confidence: 0.90, reason: 'hallucinated_selector', ruleId: 1, selectorKey: 'button[name=buy]' },
    { verdict: VERDICTS.TEST_WRONG, confidence: 0.90, reason: 'hallucinated_selector', ruleId: 1, selectorKey: 'button[name=buy]' },
    { verdict: VERDICTS.TEST_WRONG, confidence: 0.90, reason: 'hallucinated_selector', ruleId: 1, selectorKey: 'button[name=buy]' },
  ];

  const clusters = clusterVerdicts(bundles, verdicts);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].size, 3);
  assert.ok(verdicts[0].clusterId);
  assert.ok(verdicts[1].clusterId);
  assert.ok(verdicts[2].clusterId);
});

test('clusterVerdicts does NOT cluster groups of 2', () => {
  const bundles = [{ tier: 'tierA' }, { tier: 'tierA' }];
  const verdicts = [
    { verdict: VERDICTS.TEST_WRONG, confidence: 0.9, reason: 'hallucinated_selector', ruleId: 1, selectorKey: 'btn' },
    { verdict: VERDICTS.TEST_WRONG, confidence: 0.9, reason: 'hallucinated_selector', ruleId: 1, selectorKey: 'btn' },
  ];
  const clusters = clusterVerdicts(bundles, verdicts);
  assert.equal(clusters.length, 0);
});

test('clusterVerdicts tier-wide flag penalizes confidence by 0.2', () => {
  const bundles = [
    { tier: 'tierA' },
    { tier: 'tierA' },
    { tier: 'tierA' },
  ];
  const verdicts = [
    { verdict: VERDICTS.ENVIRONMENT, confidence: 0.80, reason: 'server_unreachable', ruleId: 3, selectorKey: null },
    { verdict: VERDICTS.ENVIRONMENT, confidence: 0.80, reason: 'server_unreachable', ruleId: 3, selectorKey: null },
    { verdict: VERDICTS.ENVIRONMENT, confidence: 0.80, reason: 'server_unreachable', ruleId: 3, selectorKey: null },
  ];

  const clusters = clusterVerdicts(bundles, verdicts);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].tierWide, true);
  // Confidence should be penalized
  assert.ok(verdicts[0].confidence < 0.80);
  assert.ok(verdicts[1].confidence < 0.80);
});

test('clusterVerdicts tier-wide false when mixed tiers', () => {
  const bundles = [{ tier: 'tierA' }, { tier: 'tierA' }, { tier: 'tierB' }];
  const verdicts = [
    { verdict: VERDICTS.TEST_WRONG, confidence: 0.9, reason: 'hallucinated_selector', ruleId: 1, selectorKey: 'btn' },
    { verdict: VERDICTS.TEST_WRONG, confidence: 0.9, reason: 'hallucinated_selector', ruleId: 1, selectorKey: 'btn' },
    { verdict: VERDICTS.TEST_WRONG, confidence: 0.9, reason: 'hallucinated_selector', ruleId: 1, selectorKey: 'btn' },
  ];

  const clusters = clusterVerdicts(bundles, verdicts);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].tierWide, false);
  // Confidence should NOT be penalized (no tier-wide)
  assert.equal(verdicts[0].confidence, 0.9);
});

test('clusterVerdicts assigns unique cluster IDs when multiple clusters exist', () => {
  const bundles = Array.from({ length: 6 }, (_, i) => ({ tier: i < 3 ? 'tierA' : 'tierB' }));
  const verdicts = [
    ...Array.from({ length: 3 }, () => ({ verdict: VERDICTS.TEST_WRONG, confidence: 0.9, reason: 'hallucinated_selector', ruleId: 1, selectorKey: 'btn-a' })),
    ...Array.from({ length: 3 }, () => ({ verdict: VERDICTS.TEST_WRONG, confidence: 0.9, reason: 'hallucinated_selector', ruleId: 1, selectorKey: 'btn-b' })),
  ];
  const clusters = clusterVerdicts(bundles, verdicts);
  assert.equal(clusters.length, 2);
  assert.notEqual(clusters[0].clusterId, clusters[1].clusterId);
});

// ---------------------------------------------------------------------------
// VERDICTS constant is frozen
// ---------------------------------------------------------------------------

test('VERDICTS object is frozen and has expected keys', () => {
  assert.ok(Object.isFrozen(VERDICTS));
  assert.equal(VERDICTS.TEST_WRONG, 'test_is_wrong');
  assert.equal(VERDICTS.APP_WRONG, 'app_is_wrong');
  assert.equal(VERDICTS.ENVIRONMENT, 'environment');
  assert.equal(VERDICTS.AMBIGUOUS, 'ambiguous');
});
