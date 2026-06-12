'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ReportGenerator = require('../src/report-generator');

function makeGen() {
  return new ReportGenerator();
}

// ---------------------------------------------------------------------------
// stripAnsiAndNormalize
// ---------------------------------------------------------------------------

test('stripAnsiAndNormalize removes ANSI escape codes', () => {
  const gen = makeGen();
  const input = '[32mGreen text[0m';
  assert.equal(gen.stripAnsiAndNormalize(input), 'Green text');
});

test('stripAnsiAndNormalize trims whitespace', () => {
  const gen = makeGen();
  assert.equal(gen.stripAnsiAndNormalize('  hello  '), 'hello');
});

test('stripAnsiAndNormalize removes control characters', () => {
  const gen = makeGen();
  const input = 'helloworldfoo';
  const result = gen.stripAnsiAndNormalize(input);
  assert.ok(!result.includes(''));
  assert.ok(!result.includes(''));
});

test('stripAnsiAndNormalize returns null/undefined unchanged', () => {
  const gen = makeGen();
  assert.equal(gen.stripAnsiAndNormalize(null), null);
  assert.equal(gen.stripAnsiAndNormalize(undefined), undefined);
});

test('stripAnsiAndNormalize recursively normalizes arrays', () => {
  const gen = makeGen();
  const result = gen.stripAnsiAndNormalize(['[32mGreen[0m', '[31mRed[0m']);
  assert.deepEqual(result, ['Green', 'Red']);
});

test('stripAnsiAndNormalize recursively normalizes objects', () => {
  const gen = makeGen();
  const result = gen.stripAnsiAndNormalize({ name: '[32mAlice[0m', age: 30 });
  assert.equal(result.name, 'Alice');
  assert.equal(result.age, 30);
});

test('stripAnsiAndNormalize passes through numbers and booleans', () => {
  const gen = makeGen();
  assert.equal(gen.stripAnsiAndNormalize(42), 42);
  assert.equal(gen.stripAnsiAndNormalize(true), true);
  assert.equal(gen.stripAnsiAndNormalize(false), false);
});

test('stripAnsiAndNormalize handles plain string with no escapes', () => {
  const gen = makeGen();
  assert.equal(gen.stripAnsiAndNormalize('Hello World'), 'Hello World');
});

// ---------------------------------------------------------------------------
// normalizePathForReport
// ---------------------------------------------------------------------------

test('normalizePathForReport converts backslashes to forward slashes', () => {
  const gen = makeGen();
  assert.equal(gen.normalizePathForReport('reports\\artifacts\\screenshot.png'), 'reports/artifacts/screenshot.png');
});

test('normalizePathForReport returns empty string for null/undefined', () => {
  const gen = makeGen();
  assert.equal(gen.normalizePathForReport(null), '');
  assert.equal(gen.normalizePathForReport(undefined), '');
});

test('normalizePathForReport leaves forward slashes unchanged', () => {
  const gen = makeGen();
  assert.equal(gen.normalizePathForReport('a/b/c.png'), 'a/b/c.png');
});

// ---------------------------------------------------------------------------
// normalizeStatus
// ---------------------------------------------------------------------------

test('normalizeStatus maps expected → passed', () => {
  assert.equal(makeGen().normalizeStatus('expected'), 'passed');
});

test('normalizeStatus maps unexpected → failed', () => {
  assert.equal(makeGen().normalizeStatus('unexpected'), 'failed');
});

test('normalizeStatus maps pending → skipped', () => {
  assert.equal(makeGen().normalizeStatus('pending'), 'skipped');
});

test('normalizeStatus returns unknown for null/empty', () => {
  assert.equal(makeGen().normalizeStatus(null), 'unknown');
  assert.equal(makeGen().normalizeStatus(''), 'unknown');
  assert.equal(makeGen().normalizeStatus(undefined), 'unknown');
});

test('normalizeStatus is case-insensitive', () => {
  const gen = makeGen();
  assert.equal(gen.normalizeStatus('PASSED'), 'passed');
  assert.equal(gen.normalizeStatus('Failed'), 'failed');
  assert.equal(gen.normalizeStatus('EXPECTED'), 'passed');
});

test('normalizeStatus passes through unknown values lowercased', () => {
  assert.equal(makeGen().normalizeStatus('BLOCKED'), 'blocked');
  assert.equal(makeGen().normalizeStatus('flaky'), 'flaky');
});

// ---------------------------------------------------------------------------
// sanitizeArtifactName
// ---------------------------------------------------------------------------

test('sanitizeArtifactName replaces disallowed characters with hyphens', () => {
  const gen = makeGen();
  const result = gen.sanitizeArtifactName('my test file.png');
  assert.ok(!result.includes(' '), 'spaces should be replaced');
  assert.ok(result.includes('-') || result.includes('.') || /[a-zA-Z0-9]/.test(result));
});

test('sanitizeArtifactName returns "artifact" for empty/null input', () => {
  const gen = makeGen();
  assert.equal(gen.sanitizeArtifactName(''), 'artifact');
  assert.equal(gen.sanitizeArtifactName(null), 'artifact');
  assert.equal(gen.sanitizeArtifactName(undefined), 'artifact');
});

test('sanitizeArtifactName trims leading hyphens/dots', () => {
  const gen = makeGen();
  const result = gen.sanitizeArtifactName('-.bad-start');
  assert.ok(!result.startsWith('-'), `got: ${result}`);
  assert.ok(!result.startsWith('.'), `got: ${result}`);
});

test('sanitizeArtifactName collapses multiple hyphens', () => {
  const gen = makeGen();
  const result = gen.sanitizeArtifactName('hello---world');
  assert.ok(!result.includes('---'), `got: ${result}`);
});

test('sanitizeArtifactName limits output to 180 characters', () => {
  const gen = makeGen();
  const longName = 'a'.repeat(300);
  assert.ok(gen.sanitizeArtifactName(longName).length <= 180);
});

test('sanitizeArtifactName preserves dots in filename extensions', () => {
  const gen = makeGen();
  const result = gen.sanitizeArtifactName('screenshot.png');
  assert.ok(result.includes('.'));
});

// ---------------------------------------------------------------------------
// createArtifactFilename
// ---------------------------------------------------------------------------

test('createArtifactFilename returns a non-empty string', () => {
  const gen = makeGen();
  const filename = gen.createArtifactFilename('screenshots', '/project/test-results/shot.png', 'shot.png');
  assert.ok(typeof filename === 'string');
  assert.ok(filename.length > 0);
});

test('createArtifactFilename includes type prefix', () => {
  const gen = makeGen();
  const filename = gen.createArtifactFilename('screenshots', '/project/shot.png', 'shot.png');
  assert.ok(filename.startsWith('screenshots-'));
});

test('createArtifactFilename includes file extension', () => {
  const gen = makeGen();
  const filename = gen.createArtifactFilename('videos', '/project/video.webm', 'video.webm');
  assert.ok(filename.endsWith('.webm'));
});

test('createArtifactFilename includes sha1 digest (12 hex chars)', () => {
  const gen = makeGen();
  const filename = gen.createArtifactFilename('traces', '/project/trace.zip', 'trace.zip');
  const parts = filename.split('-');
  // filename = "traces-{digest}-{base}.zip"
  assert.ok(parts.length >= 2);
  const digest = parts[1];
  assert.equal(digest.length, 12);
  assert.ok(/^[0-9a-f]+$/.test(digest), `digest should be hex: ${digest}`);
});

test('createArtifactFilename produces stable output for same input', () => {
  const gen = makeGen();
  const f1 = gen.createArtifactFilename('screenshots', '/project/shot.png', 'shot.png');
  const f2 = gen.createArtifactFilename('screenshots', '/project/shot.png', 'shot.png');
  assert.equal(f1, f2);
});

test('createArtifactFilename produces different hashes for different source paths', () => {
  const gen = makeGen();
  const f1 = gen.createArtifactFilename('screenshots', '/project/a/shot.png', 'shot.png');
  const f2 = gen.createArtifactFilename('screenshots', '/project/b/shot.png', 'shot.png');
  assert.notEqual(f1, f2);
});

// ---------------------------------------------------------------------------
// isArtifactTypeAllowed
// ---------------------------------------------------------------------------

test('isArtifactTypeAllowed: screenshots accept image types', () => {
  const gen = makeGen();
  assert.equal(gen.isArtifactTypeAllowed('screenshots', 'shot.png'), true);
  assert.equal(gen.isArtifactTypeAllowed('screenshots', 'shot.jpg'), true);
  assert.equal(gen.isArtifactTypeAllowed('screenshots', 'shot.jpeg'), true);
  assert.equal(gen.isArtifactTypeAllowed('screenshots', 'shot.gif'), true);
  assert.equal(gen.isArtifactTypeAllowed('screenshots', 'shot.webp'), true);
});

test('isArtifactTypeAllowed: screenshots reject non-image types', () => {
  const gen = makeGen();
  assert.equal(gen.isArtifactTypeAllowed('screenshots', 'file.mp4'), false);
  assert.equal(gen.isArtifactTypeAllowed('screenshots', 'file.txt'), false);
});

test('isArtifactTypeAllowed: videos accept video types', () => {
  const gen = makeGen();
  assert.equal(gen.isArtifactTypeAllowed('videos', 'clip.webm'), true);
  assert.equal(gen.isArtifactTypeAllowed('videos', 'clip.mp4'), true);
  assert.equal(gen.isArtifactTypeAllowed('videos', 'clip.mov'), true);
  assert.equal(gen.isArtifactTypeAllowed('videos', 'clip.mkv'), true);
});

test('isArtifactTypeAllowed: traces accept zip and trace', () => {
  const gen = makeGen();
  assert.equal(gen.isArtifactTypeAllowed('traces', 'trace.zip'), true);
  assert.equal(gen.isArtifactTypeAllowed('traces', 'trace.trace'), true);
});

test('isArtifactTypeAllowed: traces allow any file containing "trace" in name', () => {
  const gen = makeGen();
  assert.equal(gen.isArtifactTypeAllowed('traces', '/results/test-trace.bin'), true);
});

test('isArtifactTypeAllowed: other accepts text-like types', () => {
  const gen = makeGen();
  assert.equal(gen.isArtifactTypeAllowed('other', 'output.txt'), true);
  assert.equal(gen.isArtifactTypeAllowed('other', 'report.html'), true);
  assert.equal(gen.isArtifactTypeAllowed('other', 'data.json'), true);
  assert.equal(gen.isArtifactTypeAllowed('other', 'request.har'), true);
});

test('isArtifactTypeAllowed: returns false for unknown type', () => {
  const gen = makeGen();
  assert.equal(gen.isArtifactTypeAllowed('unknown-type', 'file.png'), false);
  assert.equal(gen.isArtifactTypeAllowed(null, 'file.png'), false);
  assert.equal(gen.isArtifactTypeAllowed('', 'file.png'), false);
});

// ---------------------------------------------------------------------------
// ensureDir (light filesystem test)
// ---------------------------------------------------------------------------

test('ensureDir creates a directory that does not exist', () => {
  const gen = makeGen();
  const tmpDir = path.join(os.tmpdir(), `healix-test-ensuredir-${Date.now()}`);
  try {
    gen.ensureDir(tmpDir);
    assert.ok(fs.existsSync(tmpDir));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('ensureDir is idempotent (no error if directory exists)', () => {
  const gen = makeGen();
  const tmpDir = path.join(os.tmpdir(), `healix-test-ensuredir2-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    assert.doesNotThrow(() => gen.ensureDir(tmpDir));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// generate() — filesystem integration (no HTTP, no api_key)
// ---------------------------------------------------------------------------

test('generate() writes report JSON and returns path + url', async () => {
  const gen = makeGen();
  const tmpDir = path.join(os.tmpdir(), `healix-gen-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    const result = await gen.generate({
      projectPath: tmpDir,
      projectName: 'Test Project',
      runId: 'run-unit-001',
    });
    assert.ok(typeof result.path === 'string');
    assert.ok(typeof result.latestPath === 'string');
    assert.ok(typeof result.url === 'string');
    assert.ok(fs.existsSync(result.path), 'report file should exist');
    assert.ok(fs.existsSync(result.latestPath), 'latest.json should exist');
    assert.ok(result.url.startsWith('file://'), `url should be file:// without api_key, got: ${result.url}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generate() report JSON contains expected structure', async () => {
  const gen = makeGen();
  const tmpDir = path.join(os.tmpdir(), `healix-gen-struct-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    const result = await gen.generate({
      projectPath: tmpDir,
      projectName: 'My App',
      runId: 'run-struct-001',
      testResults: {
        total: 2,
        passed: 1,
        failed: 1,
        skipped: 0,
        duration: 3500,
        tests: [
          { title: 'loads home page', status: 'passed', duration: 1200 },
          { title: 'login fails with wrong password', status: 'failed', duration: 2300 },
        ],
        failures: [],
      },
    });
    const report = JSON.parse(fs.readFileSync(result.path, 'utf-8'));
    assert.equal(report.metadata.projectName, 'My App');
    assert.equal(report.metadata.runId, 'run-struct-001');
    assert.equal(report.stats.total, 2);
    assert.equal(report.stats.passed, 1);
    assert.equal(report.stats.failed, 1);
    assert.equal(report.stats.passRate, 50);
    assert.ok(Array.isArray(report.tests));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generate() handles null testResults gracefully', async () => {
  const gen = makeGen();
  const tmpDir = path.join(os.tmpdir(), `healix-gen-null-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    const result = await gen.generate({
      projectPath: tmpDir,
      testResults: null,
    });
    const report = JSON.parse(fs.readFileSync(result.path, 'utf-8'));
    assert.equal(report.stats.total, 0);
    assert.deepEqual(report.tests, []);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generate() workspaceBinding is attached when workspaceId provided', async () => {
  const gen = makeGen();
  const tmpDir = path.join(os.tmpdir(), `healix-gen-ws-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    const result = await gen.generate({
      projectPath: tmpDir,
      workspaceId: 'ws-abc-123',
    });
    const report = JSON.parse(fs.readFileSync(result.path, 'utf-8'));
    assert.equal(report.metadata.workspaceBinding.status, 'attached');
    assert.equal(report.metadata.workspaceBinding.workspaceId, 'ws-abc-123');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generate() workspaceBinding is skipped when workspaceSkip provided', async () => {
  const gen = makeGen();
  const tmpDir = path.join(os.tmpdir(), `healix-gen-skip-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    const result = await gen.generate({
      projectPath: tmpDir,
      workspaceSkip: {
        reason: 'not_found',
        message: 'No workspace matched this project',
        projectKey: 'PROJ',
        paidPlanRequired: false,
      },
    });
    const report = JSON.parse(fs.readFileSync(result.path, 'utf-8'));
    assert.equal(report.metadata.workspaceBinding.status, 'skipped');
    assert.equal(report.metadata.workspaceBinding.reason, 'not_found');
    assert.equal(report.metadata.workspaceBinding.projectKey, 'PROJ');
    assert.equal(report.metadata.workspaceBinding.paidPlanRequired, false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generate() workspaceBinding is solo when neither workspaceId nor workspaceSkip', async () => {
  const gen = makeGen();
  const tmpDir = path.join(os.tmpdir(), `healix-gen-solo-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    const result = await gen.generate({ projectPath: tmpDir });
    const report = JSON.parse(fs.readFileSync(result.path, 'utf-8'));
    assert.equal(report.metadata.workspaceBinding.status, 'solo');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generate() includes pipelineError in report when provided', async () => {
  const gen = makeGen();
  const tmpDir = path.join(os.tmpdir(), `healix-gen-err-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    const result = await gen.generate({
      projectPath: tmpDir,
      pipelineError: 'WEBAPP_UNREACHABLE: Could not connect to app',
    });
    const report = JSON.parse(fs.readFileSync(result.path, 'utf-8'));
    assert.ok(typeof report.pipelineError === 'string');
    assert.ok(report.pipelineError.includes('WEBAPP_UNREACHABLE'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generate() normalizes non-array tests and failures to empty arrays', async () => {
  const gen = makeGen();
  const tmpDir = path.join(os.tmpdir(), `healix-gen-norm-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    // testResults exists but tests/failures properties are missing (not arrays)
    const result = await gen.generate({
      projectPath: tmpDir,
      testResults: { total: 0, passed: 0, failed: 0, duration: 0 },
    });
    const report = JSON.parse(fs.readFileSync(result.path, 'utf-8'));
    assert.deepEqual(report.tests, []);
    assert.deepEqual(report.failures, []);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generate() returnValue actualRunId falls back to provided runId', async () => {
  const gen = makeGen();
  const tmpDir = path.join(os.tmpdir(), `healix-gen-rid-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    const result = await gen.generate({
      projectPath: tmpDir,
      runId: 'my-run-id',
    });
    assert.equal(result.actualRunId, 'my-run-id');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
