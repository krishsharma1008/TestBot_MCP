/**
 * Bug Fix #1 — Playwright pre-flight check
 *
 * Verifies that checkPlaywrightAvailable() returns the correct result
 * for each scenario BEFORE AI generation starts.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PlaywrightIntegration = require('../src/playwright-integration');

// ─── helpers ────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'healix-preflight-'));
}

// ─── tests ───────────────────────────────────────────────────────────────────

test('preflight: returns ok=true (source=local) when @playwright/test is in project node_modules', () => {
  const root = makeTempDir();
  try {
    // Simulate a project that already has playwright installed locally
    const playwrightDir = path.join(root, 'node_modules', '@playwright', 'test');
    fs.mkdirSync(playwrightDir, { recursive: true });
    fs.writeFileSync(path.join(playwrightDir, 'package.json'), '{"name":"@playwright/test","version":"1.0.0"}');

    const pi = new PlaywrightIntegration({ projectPath: root });
    const result = pi.checkPlaywrightAvailable();

    assert.equal(result.ok, true, 'should be ok when playwright is installed locally');
    assert.equal(result.source, 'local', 'source should be "local"');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('preflight: returns ok=false when no playwright installed AND no package.json (simulated)', () => {
  const root = makeTempDir();
  try {
    // Empty project dir — no node_modules, no package.json
    // Patch getBundledPlaywrightPackageDir to simulate no bundled playwright
    const pi = new PlaywrightIntegration({ projectPath: root });
    pi.getBundledPlaywrightPackageDir = () => null;

    const result = pi.checkPlaywrightAvailable();

    assert.equal(result.ok, false, 'should fail when playwright is completely absent');
    assert.match(
      result.reason,
      /package\.json/i,
      'error message should mention package.json',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('preflight: returns ok=true when package.json exists but no local playwright (npx or will_install)', () => {
  const root = makeTempDir();
  try {
    // Project has package.json but no playwright in node_modules.
    // Either npx resolves it globally (source='npx') or we flag it for
    // npm install (source='will_install') — both are ok:true.
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"my-app","version":"1.0.0"}');

    const pi = new PlaywrightIntegration({ projectPath: root });
    // Patch out bundled playwright so we reach the package.json / npx branch
    pi.getBundledPlaywrightPackageDir = () => null;

    const result = pi.checkPlaywrightAvailable();

    assert.equal(result.ok, true, 'should be ok when package.json exists — playwright can be resolved or installed');
    assert.ok(
      ['npx', 'will_install'].includes(result.source),
      `source should be "npx" or "will_install", got: ${result.source}`,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
