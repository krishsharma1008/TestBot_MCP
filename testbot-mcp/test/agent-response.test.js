'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildAgentResponse,
  AUTO_APPLY_CONFIDENCE_FLOOR,
} = require('../src/failure-triage/agent-response');

// ---------------------------------------------------------------------------
// AUTO_APPLY_CONFIDENCE_FLOOR constant
// ---------------------------------------------------------------------------

test('AUTO_APPLY_CONFIDENCE_FLOOR is 0.85', () => {
  assert.equal(AUTO_APPLY_CONFIDENCE_FLOOR, 0.85);
});

// ---------------------------------------------------------------------------
// buildAgentResponse — empty / minimal report
// ---------------------------------------------------------------------------

test('buildAgentResponse returns all empty buckets for empty report', () => {
  const resp = buildAgentResponse({ report: {} });
  assert.equal(resp.verdicts.auto_apply.length, 0);
  assert.equal(resp.verdicts.surface_for_approval.length, 0);
  assert.equal(resp.verdicts.app_regressions.length, 0);
  assert.equal(resp.verdicts.environment_issues.length, 0);
});

test('buildAgentResponse summary stats default to zero', () => {
  const resp = buildAgentResponse({ report: {} });
  assert.equal(resp.summary.total, 0);
  assert.equal(resp.summary.passed, 0);
  assert.equal(resp.summary.failed, 0);
  assert.equal(resp.summary.skipped, 0);
});

test('buildAgentResponse parses report stats correctly', () => {
  const resp = buildAgentResponse({
    report: { stats: { total: 10, passed: 7, failed: 2, skipped: 1, flaky: 0 } },
  });
  assert.equal(resp.summary.total, 10);
  assert.equal(resp.summary.passed, 7);
  assert.equal(resp.summary.failed, 2);
  assert.equal(resp.summary.skipped, 1);
});

// ---------------------------------------------------------------------------
// buildAgentResponse — app_is_wrong verdict
// ---------------------------------------------------------------------------

test('buildAgentResponse routes app_is_wrong to app_regressions', () => {
  const bundle = {
    testName: 'checkout should complete',
    file: 'tests/generated/checkout.spec.ts',
    tier: 'tierA',
    classifierVerdict: { verdict: 'app_is_wrong', confidence: 0.88, reason: 'server_error_500' },
    trace: { failedAction: { url: 'http://localhost/api/checkout' } },
  };
  const resp = buildAgentResponse({
    report: { failures: [bundle], classifierVerdicts: [] },
  });
  assert.equal(resp.verdicts.app_regressions.length, 1);
  assert.equal(resp.verdicts.app_regressions[0].testName, 'checkout should complete');
  assert.equal(resp.verdicts.auto_apply.length, 0);
});

// ---------------------------------------------------------------------------
// buildAgentResponse — environment verdict
// ---------------------------------------------------------------------------

test('buildAgentResponse routes environment to environment_issues', () => {
  const bundle = {
    testName: 'login should succeed',
    file: 'tests/generated/auth.spec.ts',
    classifierVerdict: { verdict: 'environment', confidence: 0.80, reason: 'auth_context_missing' },
  };
  const resp = buildAgentResponse({
    report: { failures: [bundle] },
  });
  assert.equal(resp.verdicts.environment_issues.length, 1);
  assert.equal(resp.verdicts.environment_issues[0].testName, 'login should succeed');
  assert.equal(resp.verdicts.environment_issues[0].reason, 'auth_context_missing');
});

// ---------------------------------------------------------------------------
// buildAgentResponse — ambiguous verdict
// ---------------------------------------------------------------------------

test('buildAgentResponse routes ambiguous to surface_for_approval', () => {
  const bundle = {
    testName: 'profile edit should save',
    file: 'tests/generated/profile.spec.ts',
    classifierVerdict: { verdict: 'ambiguous', confidence: 0, reason: 'no_rule_matched' },
  };
  const resp = buildAgentResponse({
    report: { failures: [bundle] },
  });
  assert.equal(resp.verdicts.surface_for_approval.length, 1);
  assert.equal(resp.verdicts.surface_for_approval[0].verdict, 'ambiguous');
});

// ---------------------------------------------------------------------------
// buildAgentResponse — test_is_wrong: auto_apply path
// ---------------------------------------------------------------------------

test('buildAgentResponse auto_apply when conf >= 0.85 and patch passes guardrails', () => {
  const testSource = "test('buy item', async ({ page }) => {\n  // [REQ:shop.001]\n  await expect(page.locator('button')).toBeVisible();\n  await page.click('button[name=\"OldBuy\"]');\n});";

  const bundle = {
    testName: 'buy item',
    file: 'tests/generated/shop.spec.ts',
    tier: 'tierA',
    testSource,
    classifierVerdict: { verdict: 'test_is_wrong', confidence: 0.90, reason: 'hallucinated_selector' },
  };

  const aiAnalysis = [{
    testName: 'buy item',
    verdict: 'test_is_wrong',
    verdictConfidence: 0.92,
    reason: 'hallucinated_selector',
    suggestedPatch: {
      lineStart: 4,
      lineEnd: 4,
      oldCode: 'button[name="OldBuy"]',
      newCode: 'button[name="Buy"]',
    },
  }];

  const resp = buildAgentResponse({
    report: { failures: [bundle] },
    aiAnalysis,
  });

  assert.equal(resp.verdicts.auto_apply.length, 1);
  assert.equal(resp.verdicts.auto_apply[0].testName, 'buy item');
  assert.ok(resp.verdicts.auto_apply[0].patch.newCode.includes('Buy'));
});

// ---------------------------------------------------------------------------
// buildAgentResponse — test_is_wrong: surface_for_approval paths
// ---------------------------------------------------------------------------

test('buildAgentResponse surface_for_approval when confidence below floor', () => {
  const testSource = "test('x', async ({page}) => {\n  // [REQ:x.001]\n  await expect(page.locator('a')).toBeVisible();\n});";
  const bundle = {
    testName: 'x should work',
    file: 'tests/generated/x.spec.ts',
    testSource,
    classifierVerdict: { verdict: 'test_is_wrong', confidence: 0.70, reason: 'hallucinated_selector' },
  };

  const aiAnalysis = [{
    testName: 'x should work',
    verdict: 'test_is_wrong',
    verdictConfidence: 0.70,
    reason: 'hallucinated_selector',
    suggestedPatch: { oldCode: 'old-sel', newCode: 'new-sel' },
  }];

  const resp = buildAgentResponse({
    report: { failures: [bundle] },
    aiAnalysis,
  });

  assert.equal(resp.verdicts.surface_for_approval.length, 1);
  assert.equal(resp.verdicts.surface_for_approval[0].downgradeReason, 'confidence_below_floor');
});

test('buildAgentResponse surface_for_approval when patch oldCode not in source', () => {
  const testSource = "test('y', async ({page}) => {\n  // [REQ:y.001]\n  await expect(page.locator('span')).toBeVisible();\n});";
  const bundle = {
    testName: 'y test',
    file: 'tests/generated/y.spec.ts',
    testSource,
    classifierVerdict: { verdict: 'test_is_wrong', confidence: 0.92, reason: 'hallucinated_selector' },
  };

  const aiAnalysis = [{
    testName: 'y test',
    verdict: 'test_is_wrong',
    verdictConfidence: 0.92,
    reason: 'hallucinated_selector',
    suggestedPatch: {
      oldCode: 'this text does not exist in the source',
      newCode: 'replacement code',
    },
  }];

  const resp = buildAgentResponse({
    report: { failures: [bundle] },
    aiAnalysis,
  });

  assert.equal(resp.verdicts.surface_for_approval.length, 1);
  assert.equal(resp.verdicts.surface_for_approval[0].downgradeReason, 'oldCode_not_in_source');
});

test('buildAgentResponse surface_for_approval when patch removes REQ tag', () => {
  const testSource = "test('z', async ({page}) => {\n  // [REQ:z.001]\n  await page.click('button');\n  await expect(page.locator('div')).toBeVisible();\n});";
  const bundle = {
    testName: 'z test',
    file: 'tests/generated/z.spec.ts',
    testSource,
    classifierVerdict: { verdict: 'test_is_wrong', confidence: 0.95, reason: 'hallucinated_selector' },
  };

  const aiAnalysis = [{
    testName: 'z test',
    verdict: 'test_is_wrong',
    verdictConfidence: 0.95,
    reason: 'hallucinated_selector',
    suggestedPatch: {
      oldCode: '// [REQ:z.001]',
      newCode: '// no req tag here',
    },
  }];

  const resp = buildAgentResponse({
    report: { failures: [bundle] },
    aiAnalysis,
  });

  assert.equal(resp.verdicts.surface_for_approval.length, 1);
  assert.equal(resp.verdicts.surface_for_approval[0].downgradeReason, 'requirement_tag_removed');
});

// ---------------------------------------------------------------------------
// buildAgentResponse — pipeline error
// ---------------------------------------------------------------------------

test('buildAgentResponse includes pipeline_error when report has pipelineError', () => {
  const resp = buildAgentResponse({
    report: {
      pipelineError: {
        stage: 'generation',
        reason: 'timeout',
        errorCode: 'AGENTS_RETURNED_ZERO_TESTS',
        stderr: 'Error output here',
        userFacingMessage: 'All agents returned 0 tests',
      },
    },
  });

  assert.ok(resp.verdicts.pipeline_error);
  assert.equal(resp.verdicts.pipeline_error.stage, 'generation');
  assert.equal(resp.verdicts.pipeline_error.errorCode, 'AGENTS_RETURNED_ZERO_TESTS');
  assert.ok(resp.verdicts.pipeline_error.remediationBlock);
  assert.ok(resp.summary.pipelineError);
});

// ---------------------------------------------------------------------------
// buildAgentResponse — dashboard URL construction
// ---------------------------------------------------------------------------

test('buildAgentResponse sets dashboardUrl when both url and runId provided', () => {
  const resp = buildAgentResponse({
    report: {},
    dashboardUrl: 'https://app.healix.dev',
    testRunId: 'run-abc123',
  });
  assert.ok(resp.dashboardUrl);
  assert.ok(resp.dashboardUrl.includes('run-abc123'));
  assert.ok(resp.dashboardUrl.includes('healix.dev'));
});

test('buildAgentResponse dashboardUrl is null when runId is missing', () => {
  const resp = buildAgentResponse({
    report: {},
    dashboardUrl: 'https://app.healix.dev',
  });
  assert.equal(resp.dashboardUrl, null);
});

test('buildAgentResponse strips trailing slash from dashboardUrl', () => {
  const resp = buildAgentResponse({
    report: {},
    dashboardUrl: 'https://app.healix.dev/',
    testRunId: 'run-xyz',
  });
  assert.ok(!resp.dashboardUrl.includes('//test-run'));
});

// ---------------------------------------------------------------------------
// buildAgentResponse — evidenceUrl deep links
// ---------------------------------------------------------------------------

test('buildAgentResponse includes evidenceUrl in app_regressions when both url and runId set', () => {
  const bundle = {
    testName: 'checkout fails',
    file: 'tests/checkout.spec.ts',
    classifierVerdict: { verdict: 'app_is_wrong', confidence: 0.88, reason: 'server_error_500' },
    trace: { failedAction: {} },
  };
  const resp = buildAgentResponse({
    report: { failures: [bundle] },
    dashboardUrl: 'https://app.healix.dev',
    testRunId: 'run-001',
  });
  assert.ok(resp.verdicts.app_regressions[0].evidenceUrl);
  assert.ok(resp.verdicts.app_regressions[0].evidenceUrl.includes('run-001'));
});

// ---------------------------------------------------------------------------
// buildAgentResponse — actionPlan format
// ---------------------------------------------------------------------------

test('buildAgentResponse always includes actionPlan string', () => {
  const resp = buildAgentResponse({ report: {} });
  assert.ok(typeof resp.actionPlan === 'string');
  assert.ok(resp.actionPlan.includes('ACTION PLAN'));
});

test('buildAgentResponse actionPlan lists app regressions section', () => {
  const bundle = {
    testName: 'api fails',
    file: 'tests/api.spec.ts',
    classifierVerdict: { verdict: 'app_is_wrong', confidence: 0.88, reason: 'server_error_500' },
    trace: { failedAction: {} },
  };
  const resp = buildAgentResponse({
    report: { failures: [bundle] },
  });
  assert.ok(resp.actionPlan.includes('App regressions'));
});

test('buildAgentResponse actionPlan environment issues section', () => {
  const bundle = {
    testName: 'auth flaky',
    file: 'tests/auth.spec.ts',
    classifierVerdict: { verdict: 'environment', confidence: 0.80, reason: 'auth_context_missing' },
  };
  const resp = buildAgentResponse({ report: { failures: [bundle] } });
  assert.ok(resp.actionPlan.includes('Environment issues'));
});

// ---------------------------------------------------------------------------
// buildAgentResponse — AI analysis merging
// ---------------------------------------------------------------------------

test('buildAgentResponse AI verdict overrides classifier verdict', () => {
  const bundle = {
    testName: 'nav test',
    file: 'tests/nav.spec.ts',
    classifierVerdict: { verdict: 'ambiguous', confidence: 0, reason: 'no_rule_matched' },
  };
  const aiAnalysis = [{
    testName: 'nav test',
    verdict: 'app_is_wrong',
    verdictConfidence: 0.82,
    reason: 'assertion_mismatch',
    suggestedPatch: null,
  }];
  const resp = buildAgentResponse({
    report: { failures: [bundle] },
    aiAnalysis,
  });
  assert.equal(resp.verdicts.app_regressions.length, 1);
  assert.equal(resp.verdicts.surface_for_approval.length, 0);
});

test('buildAgentResponse no aiAnalysis match leaves classifier verdict intact', () => {
  const bundle = {
    testName: 'nav test',
    file: 'tests/nav.spec.ts',
    classifierVerdict: { verdict: 'environment', confidence: 0.80, reason: 'server_unreachable' },
  };
  const aiAnalysis = [{ testName: 'some other test', verdict: 'ambiguous', verdictConfidence: 0 }];
  const resp = buildAgentResponse({
    report: { failures: [bundle] },
    aiAnalysis,
  });
  assert.equal(resp.verdicts.environment_issues.length, 1);
});

// ---------------------------------------------------------------------------
// buildAgentResponse — kill switch
// ---------------------------------------------------------------------------

test('buildAgentResponse HEALIX_AUTO_APPLY_TEST_PATCHES=false forces surface_for_approval', () => {
  const original = process.env.HEALIX_AUTO_APPLY_TEST_PATCHES;
  process.env.HEALIX_AUTO_APPLY_TEST_PATCHES = 'false';

  try {
    const testSource = "test('kill', async ({page}) => {\n  // [REQ:k.001]\n  await expect(page.locator('span')).toBeVisible();\n});";
    const bundle = {
      testName: 'kill switch test',
      file: 'tests/kill.spec.ts',
      testSource,
      classifierVerdict: { verdict: 'test_is_wrong', confidence: 0.99, reason: 'hallucinated_selector' },
    };
    const aiAnalysis = [{
      testName: 'kill switch test',
      verdict: 'test_is_wrong',
      verdictConfidence: 0.99,
      reason: 'hallucinated_selector',
      suggestedPatch: { oldCode: "locator('span')", newCode: "locator('button')" },
    }];
    const resp = buildAgentResponse({
      report: { failures: [bundle] },
      aiAnalysis,
    });

    assert.equal(resp.verdicts.auto_apply.length, 0);
    assert.equal(resp.verdicts.surface_for_approval.length, 1);
    assert.equal(resp.verdicts.surface_for_approval[0].downgradeReason, 'kill_switch');
  } finally {
    if (original === undefined) delete process.env.HEALIX_AUTO_APPLY_TEST_PATCHES;
    else process.env.HEALIX_AUTO_APPLY_TEST_PATCHES = original;
  }
});
