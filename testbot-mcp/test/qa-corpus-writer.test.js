'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  sha256,
  caseKeyFor,
  buildVerdict,
  applyPromotionRules,
  syncCorpus,
  calibrateSensitivity,
  _mutations,
} = require('../src/qa-corpus-writer');

// ---------------------------------------------------------------------------
// sha256
// ---------------------------------------------------------------------------

test('sha256 returns a 64-char hex string', () => {
  const h = sha256('hello');
  assert.equal(typeof h, 'string');
  assert.equal(h.length, 64);
  assert.ok(/^[0-9a-f]{64}$/.test(h));
});

test('sha256 is deterministic', () => {
  assert.equal(sha256('same input'), sha256('same input'));
});

test('sha256 produces different hashes for different inputs', () => {
  assert.notEqual(sha256('abc'), sha256('xyz'));
});

test('sha256 handles empty string', () => {
  const h = sha256('');
  assert.ok(/^[0-9a-f]{64}$/.test(h));
});

// ---------------------------------------------------------------------------
// caseKeyFor
// ---------------------------------------------------------------------------

test('caseKeyFor returns explicit caseKey when provided', () => {
  assert.equal(caseKeyFor({ caseKey: 'my-key' }), 'my-key');
  assert.equal(caseKeyFor({ case_key: 'alt-key' }), 'alt-key');
  assert.equal(caseKeyFor({ testCaseId: 'tc-001' }), 'tc-001');
  assert.equal(caseKeyFor({ id: 'id-007' }), 'id-007');
});

test('caseKeyFor generates deterministic fingerprint when no explicit key', () => {
  const args = { projectFingerprint: 'fp', filePath: 'test.spec.ts', suite: 'Login', title: 'shows error on bad password' };
  assert.equal(caseKeyFor(args), caseKeyFor(args));
});

test('caseKeyFor fingerprint starts with "case:"', () => {
  const key = caseKeyFor({ filePath: 'test.spec.ts', title: 'something' });
  assert.ok(key.startsWith('case:'));
});

test('caseKeyFor fingerprint is 45 chars (case: + 40 hex chars)', () => {
  const key = caseKeyFor({ filePath: 'f', title: 't' });
  assert.equal(key.length, 45);
});

test('caseKeyFor different titles produce different keys', () => {
  const a = caseKeyFor({ title: 'test A', filePath: 'f' });
  const b = caseKeyFor({ title: 'test B', filePath: 'f' });
  assert.notEqual(a, b);
});

test('caseKeyFor empty object generates a key', () => {
  const key = caseKeyFor({});
  assert.ok(key.startsWith('case:'));
});

// ---------------------------------------------------------------------------
// MUTATIONS
// ---------------------------------------------------------------------------

test('_mutations exports three mutation objects with name + apply', () => {
  assert.ok(Array.isArray(_mutations));
  assert.equal(_mutations.length, 3);
  for (const mut of _mutations) {
    assert.ok(typeof mut.name === 'string');
    assert.ok(typeof mut.apply === 'function');
  }
});

test('insert-return-null mutation injects return null after function body open', () => {
  const source = `function greet(name) {\n  return 'Hello ' + name;\n}`;
  const { apply } = _mutations.find((m) => m.name === 'insert-return-null');
  const mutated = apply(source);
  assert.ok(mutated !== null, 'mutation should apply to a function');
  assert.ok(mutated.includes('return null;'));
  assert.ok(mutated.includes('return \'Hello \''), 'original body should remain');
});

test('insert-return-null returns null when no function found', () => {
  const { apply } = _mutations.find((m) => m.name === 'insert-return-null');
  assert.equal(apply('const x = 1;'), null);
});

test('comment-conditional mutation comments out first if statement', () => {
  const source = `function check(x) {\n  if (x > 0) {\n    return true;\n  }\n  return false;\n}`;
  const { apply } = _mutations.find((m) => m.name === 'comment-conditional');
  const mutated = apply(source);
  assert.ok(mutated !== null);
  assert.ok(mutated.includes('// if'), `expected commented if, got: ${mutated}`);
  assert.ok(mutated.includes('[healix-mutation]'));
});

test('comment-conditional returns null when no if statement', () => {
  const { apply } = _mutations.find((m) => m.name === 'comment-conditional');
  assert.equal(apply('const x = 1 + 2;'), null);
});

test('flip-equality mutation flips === to !==', () => {
  const source = `if (a === b) return true;`;
  const { apply } = _mutations.find((m) => m.name === 'flip-equality');
  const mutated = apply(source);
  assert.ok(mutated !== null);
  assert.ok(mutated.includes('!=='));
  assert.ok(!mutated.includes('==='));
});

test('flip-equality mutation flips !== to ===', () => {
  const source = `if (a !== b) return false;`;
  const { apply } = _mutations.find((m) => m.name === 'flip-equality');
  const mutated = apply(source);
  assert.ok(mutated !== null);
  assert.ok(mutated.includes('==='));
});

test('flip-equality falls back to flipping > when no strict equality', () => {
  const source = `if (count > 0) { doSomething(); }`;
  const { apply } = _mutations.find((m) => m.name === 'flip-equality');
  const mutated = apply(source);
  assert.ok(mutated !== null);
  assert.ok(mutated.includes('<'));
});

test('flip-equality returns null when nothing to flip', () => {
  const { apply } = _mutations.find((m) => m.name === 'flip-equality');
  const result = apply('const x = "hello";');
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// buildVerdict
// ---------------------------------------------------------------------------

test('buildVerdict normalizes passed/failed/unknown status', () => {
  const base = { test: { title: 't', file: 'f.spec.ts' } };
  assert.equal(buildVerdict({ ...base, test: { ...base.test, status: 'pass' } }).status, 'passed');
  assert.equal(buildVerdict({ ...base, test: { ...base.test, status: 'passed' } }).status, 'passed');
  assert.equal(buildVerdict({ ...base, test: { ...base.test, status: 'fail' } }).status, 'failed');
  assert.equal(buildVerdict({ ...base, test: { ...base.test, status: 'failed' } }).status, 'failed');
  assert.equal(buildVerdict({ ...base, test: { ...base.test, status: 'skipped' } }).status, 'skipped');
});

test('buildVerdict sets sourceFileChanged when hash mismatch', () => {
  const v = buildVerdict({
    test: { title: 't' },
    targetSourceHash: 'new-hash',
    corpusRow: { targetSourceHash: 'old-hash' },
  });
  assert.equal(v.sourceFileChanged, true);
});

test('buildVerdict sourceFileChanged is false when hashes match', () => {
  const v = buildVerdict({
    test: { title: 't' },
    targetSourceHash: 'hash-123',
    corpusRow: { targetSourceHash: 'hash-123' },
  });
  assert.equal(v.sourceFileChanged, false);
});

test('buildVerdict sourceFileChanged is false when no corpusRow', () => {
  const v = buildVerdict({ test: { title: 't' }, targetSourceHash: 'new' });
  assert.equal(v.sourceFileChanged, false);
});

test('buildVerdict propagates bugSignature from corpusRow', () => {
  const v = buildVerdict({
    test: { title: 't' },
    corpusRow: { bugSignature: 'sig-abc', targetSourceHash: 'h' },
    targetSourceHash: 'h-changed',
  });
  assert.equal(v.bugSignature, 'sig-abc');
});

test('buildVerdict acTagSet and endpointSet default to empty arrays', () => {
  const v = buildVerdict({ test: { title: 't' } });
  assert.deepEqual(v.acTagSet, []);
  assert.deepEqual(v.endpointSet, []);
});

test('buildVerdict preserves acTagSet and endpointSet when provided', () => {
  const v = buildVerdict({
    test: { title: 't' },
    acTagSet: ['REQ:AC1'],
    endpointSet: ['GET /api/items'],
  });
  assert.deepEqual(v.acTagSet, ['REQ:AC1']);
  assert.deepEqual(v.endpointSet, ['GET /api/items']);
});

// ---------------------------------------------------------------------------
// applyPromotionRules
// ---------------------------------------------------------------------------

test('applyPromotionRules returns empty result for empty verdicts', () => {
  const result = applyPromotionRules([], [], {});
  assert.deepEqual(result, { upserts: [], demotions: [], regressions: [] });
});

test('applyPromotionRules skips verdicts with status=skipped', () => {
  const verdicts = [{ caseKey: 'ck1', status: 'skipped', title: 't' }];
  const result = applyPromotionRules(verdicts, [], {});
  assert.equal(result.upserts.length, 0);
});

test('applyPromotionRules promotes new L0 verdict unconditionally', () => {
  const verdicts = [{ caseKey: 'ck-l0', status: 'passed', tier: 'L0', title: 't', filePath: 'test.spec.ts' }];
  const result = applyPromotionRules(verdicts, [], {});
  assert.equal(result.upserts.length, 1);
  assert.equal(result.upserts[0].tier, 'L0');
  assert.equal(result.upserts[0].status, 'active');
});

test('applyPromotionRules promotes new passed test with sensitivity>0 as L1', () => {
  const verdicts = [{
    caseKey: 'ck-l1',
    status: 'passed',
    title: 'shows user list',
    filePath: 'ui.spec.ts',
    sensitivityScore: 1.0,
  }];
  const result = applyPromotionRules(verdicts, [], {});
  assert.equal(result.upserts.length, 1);
  assert.equal(result.upserts[0].tier, 'L1');
});

test('applyPromotionRules rejects new passed test with sensitivity=0 (insensitive)', () => {
  const verdicts = [{
    caseKey: 'ck-insensitive',
    status: 'passed',
    title: 'trivial test',
    filePath: 'trivial.spec.ts',
    sensitivityScore: 0,
  }];
  const result = applyPromotionRules(verdicts, [], {});
  assert.equal(result.upserts.length, 0, 'insensitive test (score=0) must not be promoted');
});

test('applyPromotionRules promotes new passed test with null sensitivity (uncalibrated)', () => {
  const verdicts = [{
    caseKey: 'ck-uncal',
    status: 'passed',
    title: 'uncalibrated',
    filePath: 'uncal.spec.ts',
    sensitivityScore: null,
  }];
  const result = applyPromotionRules(verdicts, [], {});
  assert.equal(result.upserts.length, 1, 'null sensitivity = uncalibrated, should promote');
});

test('applyPromotionRules smoke spec tagged as L0 even without explicit tier', () => {
  const verdicts = [{
    status: 'passed',
    title: 'smoke test',
    filePath: 'smoke.spec.ts',
    sensitivityScore: 0, // normally would be rejected, but smoke skips that gate
  }];
  const result = applyPromotionRules(verdicts, [], {});
  assert.equal(result.upserts.length, 1);
  assert.equal(result.upserts[0].tier, 'L0');
});

test('applyPromotionRules deduplicates by acTagSet overlap', () => {
  // Two new tests covering the same AC tag → second should be deduped
  const acSet = ['[REQ:F1.AC1]'];
  const verdicts = [
    { status: 'passed', title: 'test A', filePath: 't.spec.ts', sensitivityScore: 1, acTagSet: acSet },
    { status: 'passed', title: 'test B', filePath: 't.spec.ts', sensitivityScore: 1, acTagSet: acSet },
  ];
  const result = applyPromotionRules(verdicts, [], {});
  assert.equal(result.upserts.length, 1, 'duplicate acTagSet must be deduplicated');
});

test('applyPromotionRules demotes L1 after 3 consecutive failures (no source change)', () => {
  const caseKey = 'ck-demotion';
  const corpus = [{
    caseKey,
    tier: 'L1',
    status: 'active',
    consecutiveFailureCount: 2, // next failure brings it to 3
  }];
  const verdicts = [{
    caseKey,
    status: 'failed',
    title: 'should pass',
    filePath: 'test.spec.ts',
    sourceFileChanged: false,
  }];
  const result = applyPromotionRules(verdicts, corpus, {});
  assert.equal(result.demotions.length, 1);
  assert.equal(result.demotions[0].toStatus, 'flake-quarantine');
  assert.equal(result.demotions[0].reason, '3 consecutive failures with no source-file diff');
});

test('applyPromotionRules does NOT demote after only 2 consecutive failures', () => {
  const caseKey = 'ck-not-yet';
  const corpus = [{ caseKey, tier: 'L1', status: 'active', consecutiveFailureCount: 1 }];
  const verdicts = [{ caseKey, status: 'failed', sourceFileChanged: false }];
  const result = applyPromotionRules(verdicts, corpus, {});
  assert.equal(result.demotions.length, 0);
  assert.equal(result.upserts.length, 1);
  assert.equal(result.upserts[0].consecutiveFailureCount, 2);
});

test('applyPromotionRules resets failure count when source file changed', () => {
  const caseKey = 'ck-reset';
  const corpus = [{ caseKey, tier: 'L1', status: 'active', consecutiveFailureCount: 2 }];
  const verdicts = [{ caseKey, status: 'failed', sourceFileChanged: true }];
  const result = applyPromotionRules(verdicts, corpus, {});
  assert.equal(result.demotions.length, 0);
  const upsert = result.upserts.find((u) => u.caseKey === caseKey);
  assert.equal(upsert.consecutiveFailureCount, 0);
});

test('applyPromotionRules promotes L2 regression when source changed + bugSignature', () => {
  const caseKey = 'ck-regression';
  const corpus = [{ caseKey, tier: 'L2', status: 'quarantine', bugSignature: 'sig-001' }];
  const verdicts = [{
    caseKey,
    status: 'passed',
    sourceFileChanged: true,
    bugSignature: 'sig-001',
    fixCommitSha: 'abc123',
  }];
  const result = applyPromotionRules(verdicts, corpus, {});
  assert.equal(result.regressions.length, 1);
  assert.equal(result.regressions[0].bugSignature, 'sig-001');
  assert.equal(result.regressions[0].fixCommitSha, 'abc123');
  const upsert = result.upserts.find((u) => u.caseKey === caseKey);
  assert.equal(upsert.tier, 'L2');
  assert.equal(upsert.status, 'active');
});

test('applyPromotionRules accepts corpus as Map via byCaseKey', () => {
  const caseKey = 'ck-map';
  const byCaseKey = new Map([[caseKey, { caseKey, tier: 'L1', status: 'active', consecutiveFailureCount: 0 }]]);
  const verdicts = [{ caseKey, status: 'passed' }];
  const result = applyPromotionRules(verdicts, { byCaseKey }, {});
  assert.equal(result.upserts.length, 1);
  assert.equal(result.upserts[0].tier, 'L1');
});

// ---------------------------------------------------------------------------
// syncCorpus — no-op paths (no network calls needed)
// ---------------------------------------------------------------------------

test('syncCorpus skips when workspaceId is null', async () => {
  const result = await syncCorpus({ workspaceId: null, upserts: [{ x: 1 }] });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'no_workspace');
});

test('syncCorpus skips when client is missing', async () => {
  const result = await syncCorpus({ workspaceId: 'ws-001', client: null, upserts: [{}] });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'no_client');
});

test('syncCorpus skips when all arrays are empty', async () => {
  const client = { syncCorpus: async () => ({ ok: true }) };
  const result = await syncCorpus({ workspaceId: 'ws-001', client, upserts: [], demotions: [], regressions: [] });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'empty');
});

test('syncCorpus calls client.syncCorpus with correct payload shape', async () => {
  let received = null;
  const client = { syncCorpus: async (payload) => { received = payload; return { ok: true }; } };
  await syncCorpus({
    workspaceId: 'ws-002',
    client,
    upserts: [{ caseKey: 'ck1' }],
    demotions: [],
    regressions: [],
    runId: 'run-001',
    projectFingerprint: 'fp-xyz',
  });
  assert.ok(received);
  assert.equal(received.workspaceId, 'ws-002');
  assert.equal(received.runId, 'run-001');
  assert.equal(received.projectFingerprint, 'fp-xyz');
  assert.equal(received.upserts.length, 1);
});

test('syncCorpus handles client.syncCorpus throwing without crashing', async () => {
  const client = { syncCorpus: async () => { throw new Error('network error'); } };
  const result = await syncCorpus({ workspaceId: 'ws-003', client, upserts: [{}] });
  assert.ok(result.error || result.skipped === false);
});

// ---------------------------------------------------------------------------
// calibrateSensitivity — skip / no-source paths
// ---------------------------------------------------------------------------

test('calibrateSensitivity returns null when skipCalibration=true', async () => {
  const result = await calibrateSensitivity('test.spec.ts', 'src/file.ts', { skipCalibration: true });
  assert.equal(result, null);
});

test('calibrateSensitivity returns null when sourceFile is null', async () => {
  const result = await calibrateSensitivity('test.spec.ts', null, {});
  assert.equal(result, null);
});

test('calibrateSensitivity returns null when testFile is falsy', async () => {
  const result = await calibrateSensitivity(null, 'src/file.ts', {});
  assert.equal(result, null);
});

test('calibrateSensitivity returns null when sourceFile does not exist on disk', async () => {
  const result = await calibrateSensitivity('test.spec.ts', '/nonexistent/path/file.ts', {});
  assert.equal(result, null);
});
