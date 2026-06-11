'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  REMEDIATIONS,
  getRemediationForErrorCode,
  buildRemediationBlock,
  formatRemediationBlock,
} = require('../src/failure-triage/error-remediations');

// ---------------------------------------------------------------------------
// getRemediationForErrorCode
// ---------------------------------------------------------------------------

test('getRemediationForErrorCode returns null for null/undefined/empty input', () => {
  assert.equal(getRemediationForErrorCode(null), null);
  assert.equal(getRemediationForErrorCode(undefined), null);
  assert.equal(getRemediationForErrorCode(''), null);
  assert.equal(getRemediationForErrorCode(123), null);
});

test('getRemediationForErrorCode returns null for unknown error code', () => {
  assert.equal(getRemediationForErrorCode('TOTALLY_UNKNOWN_CODE'), null);
  assert.equal(getRemediationForErrorCode('RANDOM_ERROR'), null);
});

test('getRemediationForErrorCode returns WEBAPP_UNREACHABLE entry', () => {
  const entry = getRemediationForErrorCode('WEBAPP_UNREACHABLE');
  assert.ok(entry !== null);
  assert.equal(entry.fixable, true);
  assert.ok(typeof entry.headline === 'string');
  assert.ok(Array.isArray(entry.remediationSteps));
  assert.ok(entry.remediationSteps.length > 0);
});

test('getRemediationForErrorCode returns PLAYWRIGHT_DEPENDENCY_MISSING entry', () => {
  const entry = getRemediationForErrorCode('PLAYWRIGHT_DEPENDENCY_MISSING');
  assert.ok(entry !== null);
  assert.equal(entry.fixable, true);
});

test('getRemediationForErrorCode returns SERVER_START_TIMEOUT as non-fixable', () => {
  const entry = getRemediationForErrorCode('SERVER_START_TIMEOUT');
  assert.ok(entry !== null);
  assert.equal(entry.fixable, false);
});

test('getRemediationForErrorCode returns PIPELINE_FAILED entry', () => {
  const entry = getRemediationForErrorCode('PIPELINE_FAILED');
  assert.ok(entry !== null);
  assert.equal(entry.fixable, false);
  assert.ok(entry.retry);
  assert.equal(entry.retry.reuseRunId, true);
});

test('all REMEDIATIONS entries have required fields', () => {
  for (const [code, entry] of Object.entries(REMEDIATIONS)) {
    assert.ok(typeof entry.fixable === 'boolean', `${code}.fixable must be boolean`);
    assert.ok(typeof entry.headline === 'string', `${code}.headline must be string`);
    assert.ok(typeof entry.agentInstruction === 'string', `${code}.agentInstruction must be string`);
    assert.ok(Array.isArray(entry.remediationSteps), `${code}.remediationSteps must be array`);
    assert.ok(entry.retry, `${code}.retry must be present`);
    assert.ok(typeof entry.retry.tool === 'string', `${code}.retry.tool must be string`);
    assert.ok(typeof entry.retry.reuseRunId === 'boolean', `${code}.retry.reuseRunId must be boolean`);
  }
});

// ---------------------------------------------------------------------------
// buildRemediationBlock
// ---------------------------------------------------------------------------

test('buildRemediationBlock returns structured block for known errorCode', () => {
  const block = buildRemediationBlock({ errorCode: 'WEBAPP_UNREACHABLE' });
  assert.equal(block.errorCode, 'WEBAPP_UNREACHABLE');
  assert.equal(block.fixable, true);
  assert.ok(typeof block.headline === 'string');
  assert.ok(typeof block.agentInstruction === 'string');
  assert.ok(Array.isArray(block.diagnosticCommands));
  assert.ok(Array.isArray(block.remediationSteps));
  assert.ok(block.retry);
});

test('buildRemediationBlock fallback for unknown code', () => {
  const block = buildRemediationBlock({ errorCode: 'UNKNOWN_CUSTOM_CODE', fallbackMessage: 'Something went wrong' });
  assert.equal(block.errorCode, 'UNKNOWN_CUSTOM_CODE');
  assert.equal(block.fixable, false);
  assert.equal(block.fallbackMessage, 'Something went wrong');
  assert.ok(block.agentInstruction.includes('errorCode'));
});

test('buildRemediationBlock with no arguments returns generic block', () => {
  const block = buildRemediationBlock();
  assert.equal(block.errorCode, null);
  assert.equal(block.fixable, false);
  assert.ok(Array.isArray(block.remediationSteps));
  assert.ok(block.retry);
});

test('buildRemediationBlock with null errorCode uses fallbackMessage as headline', () => {
  const block = buildRemediationBlock({ errorCode: null, fallbackMessage: 'Custom fallback' });
  assert.equal(block.headline, 'Custom fallback');
});

test('buildRemediationBlock fallback without fallbackMessage uses default headline', () => {
  const block = buildRemediationBlock({ errorCode: 'NO_SUCH_CODE' });
  assert.ok(block.headline.length > 0);
});

test('buildRemediationBlock PLAYWRIGHT_DEPENDENCY_MISSING has correct retry tool', () => {
  const block = buildRemediationBlock({ errorCode: 'PLAYWRIGHT_DEPENDENCY_MISSING' });
  assert.equal(block.retry.tool, 'healix_test_my_app');
  assert.equal(block.retry.reuseRunId, false);
});

// ---------------------------------------------------------------------------
// formatRemediationBlock
// ---------------------------------------------------------------------------

test('formatRemediationBlock returns empty string for null/undefined input', () => {
  assert.equal(formatRemediationBlock(null), '');
  assert.equal(formatRemediationBlock(undefined), '');
});

test('formatRemediationBlock output includes AGENT REMEDIATION header', () => {
  const block = buildRemediationBlock({ errorCode: 'WEBAPP_UNREACHABLE' });
  const formatted = formatRemediationBlock(block);
  assert.ok(formatted.includes('## AGENT REMEDIATION'));
});

test('formatRemediationBlock includes errorCode and fixable lines', () => {
  const block = buildRemediationBlock({ errorCode: 'WEBAPP_UNREACHABLE' });
  const formatted = formatRemediationBlock(block);
  assert.ok(formatted.includes('WEBAPP_UNREACHABLE'));
  assert.ok(formatted.includes('fixable: yes'));
});

test('formatRemediationBlock marks non-fixable errors correctly', () => {
  const block = buildRemediationBlock({ errorCode: 'SERVER_START_TIMEOUT' });
  const formatted = formatRemediationBlock(block);
  assert.ok(formatted.includes('fixable: no'));
});

test('formatRemediationBlock includes remediation steps', () => {
  const block = buildRemediationBlock({ errorCode: 'WEBAPP_UNREACHABLE' });
  const formatted = formatRemediationBlock(block);
  assert.ok(formatted.includes('Remediation steps'));
});

test('formatRemediationBlock includes diagnostic commands', () => {
  const block = buildRemediationBlock({ errorCode: 'WEBAPP_UNREACHABLE' });
  const formatted = formatRemediationBlock(block);
  assert.ok(formatted.includes('Diagnostic commands'));
});

test('formatRemediationBlock includes retry info', () => {
  const block = buildRemediationBlock({ errorCode: 'WEBAPP_UNREACHABLE' });
  const formatted = formatRemediationBlock(block);
  assert.ok(formatted.includes('After fixing'));
  assert.ok(formatted.includes('healix_test_my_app'));
});

test('formatRemediationBlock handles wait_for_url step type', () => {
  const block = {
    errorCode: 'TEST',
    headline: 'Test',
    fixable: true,
    agentInstruction: 'Do something',
    diagnosticCommands: [],
    remediationSteps: [
      { kind: 'wait_for_url', url: 'http://localhost:3000/health', timeoutMs: 60000, description: 'Wait for it' },
    ],
    retry: { tool: 'healix_test_my_app', reuseRunId: false },
    fallbackMessage: null,
  };
  const formatted = formatRemediationBlock(block);
  assert.ok(formatted.includes('localhost:3000/health'));
  assert.ok(formatted.includes('60s'));
});

test('formatRemediationBlock handles surface_to_user step type', () => {
  const block = {
    errorCode: 'TEST',
    headline: 'Test',
    fixable: false,
    agentInstruction: 'Surface to user',
    diagnosticCommands: [],
    remediationSteps: [
      { kind: 'surface_to_user', description: 'Ask the user to check their config' },
    ],
    retry: { tool: 'healix_check_run_status', reuseRunId: true },
    fallbackMessage: null,
  };
  const formatted = formatRemediationBlock(block);
  assert.ok(formatted.includes('Surface to user'));
  assert.ok(formatted.includes('Ask the user to check their config'));
});

test('formatRemediationBlock shell step shows alternates', () => {
  const block = {
    errorCode: 'PLAYWRIGHT_DEPENDENCY_MISSING',
    headline: 'Test',
    fixable: true,
    agentInstruction: 'Install deps',
    diagnosticCommands: [],
    remediationSteps: [
      {
        kind: 'shell',
        command: 'npm install --save-dev @playwright/test',
        alternates: { yarn: 'yarn add --dev @playwright/test', pnpm: 'pnpm add -D @playwright/test' },
        description: 'Install @playwright/test',
      },
    ],
    retry: { tool: 'healix_test_my_app', reuseRunId: false },
    fallbackMessage: null,
  };
  const formatted = formatRemediationBlock(block);
  assert.ok(formatted.includes('yarn'));
  assert.ok(formatted.includes('pnpm'));
});

test('formatRemediationBlock PIPELINE_FAILED retry uses same runId', () => {
  const block = buildRemediationBlock({ errorCode: 'PIPELINE_FAILED' });
  const formatted = formatRemediationBlock(block);
  assert.ok(formatted.includes('same runId') || formatted.includes('healix_check_run_status'));
});

// ---------------------------------------------------------------------------
// REMEDIATIONS registry completeness
// ---------------------------------------------------------------------------

test('REMEDIATIONS has entries for all expected pipeline error codes', () => {
  const expectedCodes = [
    'WEBAPP_UNREACHABLE',
    'PLAYWRIGHT_DEPENDENCY_MISSING',
    'MISSING_DEPENDENCY',
    'SERVER_START_TIMEOUT',
    'NO_TESTS_LOADED',
    'GENERATED_TEST_SYNTAX_ERROR',
    'AGENTS_RETURNED_ZERO_TESTS',
    'TIME_BUDGET_EXCEEDED',
    'PIPELINE_FAILED',
  ];
  for (const code of expectedCodes) {
    assert.ok(REMEDIATIONS[code], `Missing REMEDIATIONS entry for ${code}`);
  }
});
