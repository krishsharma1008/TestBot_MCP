'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const ResultsMerger = require('../src/results-merger');

function makeMerger(config = {}) {
  return new ResultsMerger(config);
}

function makeTest(overrides = {}) {
  return {
    id: null,
    title: 'sample test',
    suite: 'Sample Suite',
    file: 'tests/sample.spec.ts',
    status: 'passed',
    duration: 1000,
    retries: 0,
    artifacts: { screenshots: [], videos: [], traces: [], other: [] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizeStatus
// ---------------------------------------------------------------------------

test('normalizeStatus maps expected → passed', () => {
  const m = makeMerger();
  assert.equal(m.normalizeStatus('expected'), 'passed');
});

test('normalizeStatus maps unexpected → failed', () => {
  const m = makeMerger();
  assert.equal(m.normalizeStatus('unexpected'), 'failed');
});

test('normalizeStatus maps pending → skipped', () => {
  const m = makeMerger();
  assert.equal(m.normalizeStatus('pending'), 'skipped');
});

test('normalizeStatus returns unknown for falsy input', () => {
  const m = makeMerger();
  assert.equal(m.normalizeStatus(null), 'unknown');
  assert.equal(m.normalizeStatus(''), 'unknown');
  assert.equal(m.normalizeStatus(undefined), 'unknown');
});

test('normalizeStatus preserves passed/failed/skipped/blocked/flaky', () => {
  const m = makeMerger();
  for (const s of ['passed', 'failed', 'skipped', 'blocked', 'flaky']) {
    assert.equal(m.normalizeStatus(s), s);
  }
});

// ---------------------------------------------------------------------------
// getWorstStatus
// ---------------------------------------------------------------------------

test('getWorstStatus: failed beats everything', () => {
  const m = makeMerger();
  assert.equal(m.getWorstStatus('failed', 'passed'), 'failed');
  assert.equal(m.getWorstStatus('passed', 'failed'), 'failed');
  assert.equal(m.getWorstStatus('failed', 'blocked'), 'failed');
  assert.equal(m.getWorstStatus('failed', 'skipped'), 'failed');
});

test('getWorstStatus: blocked beats flaky/skipped/passed', () => {
  const m = makeMerger();
  assert.equal(m.getWorstStatus('blocked', 'passed'), 'blocked');
  assert.equal(m.getWorstStatus('skipped', 'blocked'), 'blocked');
  assert.equal(m.getWorstStatus('flaky', 'blocked'), 'blocked');
});

test('getWorstStatus: flaky beats skipped/passed', () => {
  const m = makeMerger();
  assert.equal(m.getWorstStatus('flaky', 'passed'), 'flaky');
  assert.equal(m.getWorstStatus('passed', 'flaky'), 'flaky');
  assert.equal(m.getWorstStatus('flaky', 'skipped'), 'flaky');
});

test('getWorstStatus: skipped beats passed', () => {
  const m = makeMerger();
  assert.equal(m.getWorstStatus('skipped', 'passed'), 'skipped');
  assert.equal(m.getWorstStatus('passed', 'skipped'), 'skipped');
});

test('getWorstStatus: maps Playwright aliases', () => {
  const m = makeMerger();
  assert.equal(m.getWorstStatus('unexpected', 'expected'), 'failed');
  assert.equal(m.getWorstStatus('expected', 'pending'), 'skipped');
});

// ---------------------------------------------------------------------------
// normalizePath / normalizeToken
// ---------------------------------------------------------------------------

test('normalizePath normalizes backslashes and case', () => {
  const m = makeMerger();
  assert.equal(m.normalizePath('tests\\generated\\shop.spec.ts'), 'tests/generated/shop.spec.ts');
  assert.equal(m.normalizePath('TESTS/SHOP.spec.ts'), 'tests/shop.spec.ts');
  assert.equal(m.normalizePath('tests//double//slash.spec.ts'), 'tests/double/slash.spec.ts');
});

test('normalizePath handles null/empty gracefully', () => {
  const m = makeMerger();
  assert.equal(m.normalizePath(null), '');
  assert.equal(m.normalizePath(''), '');
  assert.equal(m.normalizePath(undefined), '');
});

test('normalizeToken trims and lowercases', () => {
  const m = makeMerger();
  assert.equal(m.normalizeToken('  Hello World  '), 'hello world');
  assert.equal(m.normalizeToken('  SHOP TEST  '), 'shop test');
});

test('normalizeToken collapses whitespace', () => {
  const m = makeMerger();
  assert.equal(m.normalizeToken('hello   world'), 'hello world');
});

// ---------------------------------------------------------------------------
// getTestKey
// ---------------------------------------------------------------------------

test('getTestKey uses explicit id when present', () => {
  const m = makeMerger();
  const key = m.getTestKey({ id: 'abc-123', file: 'a.spec.ts', title: 'T', projectName: 'proj' });
  assert.ok(key.startsWith('id::abc-123'));
});

test('getTestKey ignores id if empty', () => {
  const m = makeMerger();
  const key1 = m.getTestKey({ id: '', file: 'a.spec.ts', title: 'T', projectName: 'proj' });
  const key2 = m.getTestKey({ id: null, file: 'a.spec.ts', title: 'T', projectName: 'proj' });
  assert.ok(!key1.startsWith('id::'));
  assert.ok(!key2.startsWith('id::'));
});

test('getTestKey produces same key for equivalent tests (strict mode)', () => {
  const m = makeMerger({ dedupeStrategy: 'strict' });
  const t1 = { file: 'tests/shop.spec.ts', suite: 'Shop', title: 'buy item', projectName: 'chromium' };
  const t2 = { file: 'tests/shop.spec.ts', suite: 'Shop', title: 'buy item', projectName: 'chromium' };
  assert.equal(m.getTestKey(t1), m.getTestKey(t2));
});

test('getTestKey differentiates different projects', () => {
  const m = makeMerger({ dedupeStrategy: 'strict' });
  const t1 = { file: 'tests/shop.spec.ts', suite: 'Shop', title: 'buy item', projectName: 'chromium' };
  const t2 = { file: 'tests/shop.spec.ts', suite: 'Shop', title: 'buy item', projectName: 'firefox' };
  assert.notEqual(m.getTestKey(t1), m.getTestKey(t2));
});

test('getTestKey legacy strategy uses simple file::title key', () => {
  const m = makeMerger({ dedupeStrategy: 'legacy' });
  const key = m.getTestKey({ file: 'tests/shop.spec.ts', title: 'Buy Item' });
  assert.equal(key, 'tests/shop.spec.ts::buy-item');
});

// ---------------------------------------------------------------------------
// mergeTestResults
// ---------------------------------------------------------------------------

test('mergeTestResults uses worst status', () => {
  const m = makeMerger();
  const t1 = makeTest({ status: 'passed' });
  const t2 = makeTest({ status: 'failed' });
  const merged = m.mergeTestResults(t1, t2);
  assert.equal(merged.status, 'failed');
});

test('mergeTestResults takes max duration', () => {
  const m = makeMerger();
  const t1 = makeTest({ duration: 500 });
  const t2 = makeTest({ duration: 1200 });
  const merged = m.mergeTestResults(t1, t2);
  assert.equal(merged.duration, 1200);
});

test('mergeTestResults takes max retries', () => {
  const m = makeMerger();
  const t1 = makeTest({ retries: 1 });
  const t2 = makeTest({ retries: 3 });
  const merged = m.mergeTestResults(t1, t2);
  assert.equal(merged.retries, 3);
});

test('mergeTestResults MCP source is prioritized by default', () => {
  const m = makeMerger({ prioritizeSource: 'playwright-mcp' });
  const t1 = makeTest({ title: 'original from direct', source: 'direct' });
  const t2 = makeTest({ title: 'override from mcp', source: 'mcp' });
  const merged = m.mergeTestResults(t1, t2);
  // MCP is primary so its title should win
  assert.equal(merged.title, 'override from mcp');
});

test('mergeTestResults sets sources array to direct+mcp', () => {
  const m = makeMerger();
  const merged = m.mergeTestResults(makeTest(), makeTest());
  assert.deepEqual(merged.sources, ['direct', 'mcp']);
});

// ---------------------------------------------------------------------------
// normalizeResults
// ---------------------------------------------------------------------------

test('normalizeResults returns empty structure for null input', () => {
  const m = makeMerger();
  const result = m.normalizeResults(null);
  assert.equal(result.total, 0);
  assert.equal(result.passed, 0);
  assert.equal(result.failed, 0);
  assert.deepEqual(result.tests, []);
  assert.deepEqual(result.failures, []);
  assert.ok(result.artifacts);
});

test('normalizeResults preserves existing values', () => {
  const m = makeMerger();
  const input = { total: 5, passed: 4, failed: 1, skipped: 0, flaky: 1, duration: 3000, tests: [], failures: [], artifacts: {} };
  const result = m.normalizeResults(input);
  assert.equal(result.total, 5);
  assert.equal(result.flaky, 1);
  assert.equal(result.duration, 3000);
});

test('normalizeResults includes sessionId when present', () => {
  const m = makeMerger();
  const result = m.normalizeResults({ total: 0, sessionId: 'sess-001' });
  assert.equal(result.sessionId, 'sess-001');
});

// ---------------------------------------------------------------------------
// mergeResults
// ---------------------------------------------------------------------------

test('mergeResults falls back to direct when mcp results empty', () => {
  const m = makeMerger();
  const direct = { total: 3, passed: 3, failed: 0, skipped: 0, flaky: 0, duration: 0, tests: [], failures: [], artifacts: {} };
  const mcp = { total: 0 };
  const result = m.mergeResults(direct, mcp);
  assert.equal(result.total, 3);
});

test('mergeResults falls back to mcp when direct results empty', () => {
  const m = makeMerger();
  const direct = { total: 0 };
  const mcp = { total: 2, passed: 2, failed: 0, skipped: 0, flaky: 0, duration: 0, tests: [], failures: [], artifacts: {} };
  const result = m.mergeResults(direct, mcp);
  assert.equal(result.total, 2);
});

test('mergeResults falls back when mcp is unavailable', () => {
  const m = makeMerger();
  const direct = { total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, duration: 0, tests: [], failures: [], artifacts: {} };
  const mcp = { total: 0, available: false };
  const result = m.mergeResults(direct, mcp);
  assert.equal(result.total, 1);
});

test('mergeResults deduplicates tests with same key', () => {
  const m = makeMerger();
  const sharedTest = makeTest({ file: 'a.spec.ts', title: 'same test', projectName: 'chromium', status: 'passed', duration: 100 });
  const direct = {
    total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, duration: 100,
    tests: [sharedTest], failures: [], artifacts: {},
  };
  const mcp = {
    total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, duration: 120,
    tests: [{ ...sharedTest, duration: 120 }], failures: [], artifacts: {},
  };

  const result = m.mergeResults(direct, mcp);
  assert.equal(result.total, 1, 'should be deduplicated to 1 test');
  assert.equal(result.tests[0].duration, 120, 'should use max duration');
});

test('mergeResults combines non-overlapping tests', () => {
  const m = makeMerger();
  const t1 = makeTest({ file: 'a.spec.ts', title: 'test A', projectName: 'chromium' });
  const t2 = makeTest({ file: 'b.spec.ts', title: 'test B', projectName: 'chromium' });
  const direct = { total: 1, passed: 1, failed: 0, skipped: 0, tests: [t1], failures: [], artifacts: {} };
  const mcp = { total: 1, passed: 1, failed: 0, skipped: 0, tests: [t2], failures: [], artifacts: {} };

  const result = m.mergeResults(direct, mcp);
  assert.equal(result.total, 2);
});

test('mergeResults counts failed tests in failures array', () => {
  const m = makeMerger();
  // Use full merge path (both sources non-empty) so the merger builds failures from tests
  const tFailing = makeTest({ file: 'a.spec.ts', title: 'failing test', projectName: 'chromium', status: 'failed', error: 'Expected X but got Y' });
  const tPassing = makeTest({ file: 'b.spec.ts', title: 'passing test', projectName: 'chromium', status: 'passed' });
  const direct = { total: 1, passed: 0, failed: 1, skipped: 0, flaky: 0, tests: [tFailing], failures: [], artifacts: {} };
  const mcp = { total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, tests: [tPassing], failures: [], artifacts: {} };

  const result = m.mergeResults(direct, mcp);
  assert.equal(result.failed, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].testName, 'failing test');
});

test('mergeResults tracks flaky tests separately', () => {
  const m = makeMerger();
  // Use full merge path (both sources non-empty) so the merger processes test status
  const tFlaky = makeTest({ file: 'a.spec.ts', title: 'flaky test', projectName: 'chromium', status: 'flaky' });
  const tPassing = makeTest({ file: 'b.spec.ts', title: 'stable test', projectName: 'chromium', status: 'passed' });
  const direct = { total: 1, passed: 0, failed: 0, skipped: 0, flaky: 1, tests: [tFlaky], failures: [], artifacts: {} };
  const mcp = { total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, tests: [tPassing], failures: [], artifacts: {} };

  const result = m.mergeResults(direct, mcp);
  assert.equal(result.flaky, 1);
  // flaky counts toward passed in headline stats
  assert.ok(result.passed >= 1);
});

test('mergeResults preserves source stats in merged.sources', () => {
  const m = makeMerger();
  const t1 = makeTest({ file: 'a.spec.ts', title: 'A', projectName: 'chrome' });
  const t2 = makeTest({ file: 'b.spec.ts', title: 'B', projectName: 'chrome' });
  const direct = { total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, tests: [t1], failures: [], artifacts: {} };
  const mcp = { total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, tests: [t2], failures: [], artifacts: {}, sessionId: 'sess-1' };

  const result = m.mergeResults(direct, mcp);
  assert.ok(result.sources.direct);
  assert.ok(result.sources.mcp);
  assert.equal(result.sources.mcp.sessionId, 'sess-1');
});

// ---------------------------------------------------------------------------
// mergeArtifacts / mergeTestArtifacts
// ---------------------------------------------------------------------------

test('mergeArtifacts deduplicates by key', () => {
  const m = makeMerger();
  const screenshot = { fullPath: '/project/screenshots/shot.png', contentType: 'image/png', size: 5000 };
  const col1 = { screenshots: [screenshot], videos: [], traces: [], other: [] };
  const col2 = { screenshots: [screenshot], videos: [], traces: [], other: [] };

  const merged = m.mergeArtifacts(col1, col2);
  assert.equal(merged.screenshots.length, 1);
});

test('mergeArtifacts combines artifacts from both collections', () => {
  const m = makeMerger();
  const s1 = { fullPath: '/screenshots/a.png', contentType: 'image/png', size: 1000 };
  const s2 = { fullPath: '/screenshots/b.png', contentType: 'image/png', size: 2000 };
  const col1 = { screenshots: [s1], videos: [], traces: [], other: [] };
  const col2 = { screenshots: [s2], videos: [], traces: [], other: [] };

  const merged = m.mergeArtifacts(col1, col2);
  assert.equal(merged.screenshots.length, 2);
});

test('mergeArtifacts handles null collections gracefully', () => {
  const m = makeMerger();
  const col1 = { screenshots: [{ fullPath: '/a.png', contentType: 'image/png' }], videos: [], traces: [], other: [] };
  const merged = m.mergeArtifacts(col1, null);
  assert.equal(merged.screenshots.length, 1);
});

test('mergeTestArtifacts deduplicates matching artifacts', () => {
  const m = makeMerger();
  const trace = { fullPath: '/traces/test.zip', contentType: 'application/zip', size: 5000 };
  const a1 = { screenshots: [], videos: [], traces: [trace], other: [] };
  const a2 = { screenshots: [], videos: [], traces: [trace], other: [] };

  const merged = m.mergeTestArtifacts(a1, a2);
  assert.equal(merged.traces.length, 1);
});

// ---------------------------------------------------------------------------
// computeTierResults
// ---------------------------------------------------------------------------

test('computeTierResults groups by project name prefix', () => {
  const m = makeMerger();
  const tests = [
    makeTest({ projectName: 'tierA-public', status: 'passed' }),
    makeTest({ projectName: 'tierA-public', status: 'failed' }),
    makeTest({ projectName: 'tierB-auth-admin', status: 'passed' }),
    makeTest({ projectName: 'tierC-backend', status: 'passed' }),
  ];

  const tiers = m.computeTierResults(tests);
  assert.equal(tiers['A-public'].total, 2);
  assert.equal(tiers['A-public'].passed, 1);
  assert.equal(tiers['A-public'].failed, 1);
  assert.equal(tiers['B-auth-admin'].total, 1);
  assert.equal(tiers['C-backend'].total, 1);
});

test('computeTierResults handles untiered tests', () => {
  const m = makeMerger();
  const tests = [makeTest({ projectName: 'my-custom-project', status: 'passed' })];
  const tiers = m.computeTierResults(tests);
  assert.equal(tiers['untiered'].total, 1);
});

test('computeTierResults returns empty object for empty input', () => {
  const m = makeMerger();
  const tiers = m.computeTierResults([]);
  assert.deepEqual(tiers, {});
  const tiers2 = m.computeTierResults(null);
  assert.deepEqual(tiers2, {});
});

test('computeTierResults matches "public" substring for tier A', () => {
  const m = makeMerger();
  const tests = [makeTest({ projectName: 'e2e-public', status: 'passed' })];
  const tiers = m.computeTierResults(tests);
  assert.ok(tiers['A-public']);
});

test('computeTierResults matches "api" substring for tier C', () => {
  const m = makeMerger();
  const tests = [makeTest({ projectName: 'api-tests', status: 'failed' })];
  const tiers = m.computeTierResults(tests);
  assert.ok(tiers['C-backend']);
  assert.equal(tiers['C-backend'].failed, 1);
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

test('formatDuration formats milliseconds correctly', () => {
  const m = makeMerger();
  assert.equal(m.formatDuration(500), '500ms');
  assert.equal(m.formatDuration(0), '0ms');
  assert.equal(m.formatDuration(-100), '0ms');
  assert.equal(m.formatDuration(null), '0ms');
});

test('formatDuration formats seconds correctly', () => {
  const m = makeMerger();
  assert.ok(m.formatDuration(5000).endsWith('s'));
  assert.equal(m.formatDuration(5000), '5.00s');
  assert.equal(m.formatDuration(1500), '1.50s');
});

test('formatDuration formats minutes correctly', () => {
  const m = makeMerger();
  const result = m.formatDuration(90000);
  assert.ok(result.includes('m'));
  assert.ok(result.includes('s'));
  assert.ok(result.startsWith('1m'));
});

// ---------------------------------------------------------------------------
// createSummary
// ---------------------------------------------------------------------------

test('createSummary computes pass rate', () => {
  const m = makeMerger();
  const merged = {
    total: 10, passed: 8, failed: 2, skipped: 0,
    duration: 5000,
    artifacts: { screenshots: [], videos: [], traces: [], other: [] },
    failures: [{ testName: 'T1' }, { testName: 'T2' }],
  };
  const summary = m.createSummary(merged);
  assert.equal(summary.execution.passRate, 80);
  assert.equal(summary.execution.total, 10);
  assert.equal(summary.failedTests.length, 2);
});

test('createSummary pass rate is 0 for empty results', () => {
  const m = makeMerger();
  const merged = {
    total: 0, passed: 0, failed: 0, skipped: 0,
    duration: 0,
    artifacts: { screenshots: [], videos: [], traces: [], other: [] },
    failures: [],
  };
  const summary = m.createSummary(merged);
  assert.equal(summary.execution.passRate, 0);
});

test('createSummary counts artifacts correctly', () => {
  const m = makeMerger();
  const merged = {
    total: 1, passed: 1, failed: 0, skipped: 0, duration: 100,
    artifacts: {
      screenshots: [{ path: 'a.png' }, { path: 'b.png' }],
      videos: [{ path: 'v.mp4' }],
      traces: [],
      other: [],
    },
    failures: [],
  };
  const summary = m.createSummary(merged);
  assert.equal(summary.artifacts.screenshots, 2);
  assert.equal(summary.artifacts.videos, 1);
  assert.equal(summary.artifacts.total, 3);
});

// ---------------------------------------------------------------------------
// prioritizeArtifacts
// ---------------------------------------------------------------------------

test('prioritizeArtifacts sorts playwright-mcp artifacts first by default', () => {
  const m = makeMerger();
  const artifacts = {
    screenshots: [
      { path: '/direct/shot.png' },
      { path: '/playwright-mcp/shot.png' },
    ],
    videos: [], traces: [], other: [],
  };
  const sorted = m.prioritizeArtifacts(artifacts, 'playwright-mcp');
  assert.ok(sorted.screenshots[0].path.includes('playwright-mcp'));
});

test('prioritizeArtifacts sorts direct artifacts first when preference is direct', () => {
  const m = makeMerger();
  const artifacts = {
    screenshots: [
      { path: '/playwright-mcp/shot.png' },
      { path: '/direct/shot.png' },
    ],
    videos: [], traces: [], other: [],
  };
  const sorted = m.prioritizeArtifacts(artifacts, 'direct');
  assert.ok(!sorted.screenshots[0].path.includes('playwright-mcp'));
});
