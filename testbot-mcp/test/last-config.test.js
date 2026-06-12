'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const HealixMCPServer = require('../src/index');
const ConfigUILauncher = require('../src/config-ui-launcher');

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'healix-last-config-'));
}

// ---------------------------------------------------------------------------
// saveLastConfig
// ---------------------------------------------------------------------------

test('saveLastConfig writes .healix/last-config.json with safe fields', () => {
  const projectPath = mktemp();
  const server = new HealixMCPServer();

  server.saveLastConfig(projectPath, {
    testType: 'frontend',
    scope: 'diff',
    baseURL: 'http://localhost:4200',
    startCommand: 'npm start',
    services: undefined,
    generateTests: true,
    openDashboard: false,
    credentials: [{ role: 'admin', username: 'user@test.com', password: 'secret' }],
    prd: { name: 'prd.md', textContent: 'some content' },
  });

  const saved = JSON.parse(
    fs.readFileSync(path.join(projectPath, '.healix', 'last-config.json'), 'utf-8')
  );

  assert.equal(saved.testType, 'frontend');
  assert.equal(saved.scope, 'diff');
  assert.equal(saved.baseURL, 'http://localhost:4200');
  assert.equal(saved.startCommand, 'npm start');
  assert.equal(saved.generateTests, true);
  assert.equal(saved.openDashboard, false);
});

test('saveLastConfig does not persist credentials or prd content', () => {
  const projectPath = mktemp();
  const server = new HealixMCPServer();

  server.saveLastConfig(projectPath, {
    testType: 'both',
    baseURL: 'http://localhost:3000',
    startCommand: 'npm run dev',
    generateTests: true,
    openDashboard: true,
    credentials: [{ role: 'admin', username: 'admin@example.com', password: 'hunter2' }],
    prd: { name: 'spec.md', textContent: 'AC1: user can login' },
    prdFiles: [{ name: 'extra.md', textContent: 'extra content' }],
  });

  const saved = JSON.parse(
    fs.readFileSync(path.join(projectPath, '.healix', 'last-config.json'), 'utf-8')
  );

  assert.equal('credentials' in saved, false, 'credentials must not be saved');
  assert.equal('prd' in saved, false, 'prd must not be saved');
  assert.equal('prdFiles' in saved, false, 'prdFiles must not be saved');
});

test('saveLastConfig persists services array for multi-service repos', () => {
  const projectPath = mktemp();
  const server = new HealixMCPServer();
  const services = [
    { role: 'frontend', port: 3000, startCommand: 'npm run dev', isPrimary: true },
    { role: 'backend', port: 8080, startCommand: 'npm run api', isPrimary: false },
  ];

  server.saveLastConfig(projectPath, {
    testType: 'both',
    baseURL: 'http://localhost:3000',
    startCommand: 'npm run dev',
    services,
    generateTests: true,
    openDashboard: true,
  });

  const saved = JSON.parse(
    fs.readFileSync(path.join(projectPath, '.healix', 'last-config.json'), 'utf-8')
  );

  assert.deepEqual(saved.services, services);
});

test('saveLastConfig creates the .healix directory if it does not exist', () => {
  const projectPath = mktemp();
  const server = new HealixMCPServer();

  assert.equal(fs.existsSync(path.join(projectPath, '.healix')), false);

  server.saveLastConfig(projectPath, {
    testType: 'backend',
    baseURL: 'http://localhost:8080',
    startCommand: 'node server.js',
    generateTests: false,
    openDashboard: false,
  });

  assert.ok(fs.existsSync(path.join(projectPath, '.healix', 'last-config.json')));
});

test('saveLastConfig is non-fatal when the directory is not writable', () => {
  const server = new HealixMCPServer();
  // Pass a path that cannot be created (null byte in path)
  assert.doesNotThrow(() => {
    server.saveLastConfig('/nonexistent\x00path', {
      testType: 'both',
      baseURL: 'http://localhost:3000',
      startCommand: 'npm run dev',
      generateTests: true,
      openDashboard: true,
    });
  });
});

// ---------------------------------------------------------------------------
// loadLastConfig
// ---------------------------------------------------------------------------

test('loadLastConfig returns saved values when last-config.json exists', () => {
  const projectPath = mktemp();
  const server = new HealixMCPServer();

  const expected = {
    testType: 'frontend',
    scope: 'diff',
    baseURL: 'http://localhost:4200',
    startCommand: 'ng serve',
    generateTests: true,
    openDashboard: false,
  };

  fs.mkdirSync(path.join(projectPath, '.healix'), { recursive: true });
  fs.writeFileSync(
    path.join(projectPath, '.healix', 'last-config.json'),
    JSON.stringify(expected, null, 2),
    'utf-8'
  );

  const loaded = server.loadLastConfig(projectPath);
  assert.deepEqual(loaded, expected);
});

test('loadLastConfig returns empty object when no file exists', () => {
  const projectPath = mktemp();
  const server = new HealixMCPServer();
  const loaded = server.loadLastConfig(projectPath);
  assert.deepEqual(loaded, {});
});

test('loadLastConfig returns empty object when file contains invalid JSON', () => {
  const projectPath = mktemp();
  const server = new HealixMCPServer();

  fs.mkdirSync(path.join(projectPath, '.healix'), { recursive: true });
  fs.writeFileSync(
    path.join(projectPath, '.healix', 'last-config.json'),
    'not valid json {{',
    'utf-8'
  );

  const loaded = server.loadLastConfig(projectPath);
  assert.deepEqual(loaded, {});
});

test('saveLastConfig + loadLastConfig round-trips all safe fields', () => {
  const projectPath = mktemp();
  const server = new HealixMCPServer();
  const input = {
    testType: 'both',
    scope: 'codebase',
    baseURL: 'http://localhost:3000',
    startCommand: 'npm run dev',
    services: [{ role: 'frontend', port: 3000, startCommand: 'npm run dev', isPrimary: true }],
    generateTests: true,
    openDashboard: true,
    credentials: [{ username: 'u', password: 'p' }],
  };

  server.saveLastConfig(projectPath, input);
  const loaded = server.loadLastConfig(projectPath);

  assert.equal(loaded.testType, 'both');
  assert.equal(loaded.scope, 'codebase');
  assert.equal(loaded.baseURL, 'http://localhost:3000');
  assert.equal(loaded.startCommand, 'npm run dev');
  assert.equal(loaded.generateTests, true);
  assert.equal(loaded.openDashboard, true);
  assert.deepEqual(loaded.services, input.services);
  assert.equal('credentials' in loaded, false);
});

// ---------------------------------------------------------------------------
// ConfigUILauncher.buildConfigURL — scope param
// ---------------------------------------------------------------------------

test('buildConfigURL includes scope param when projectInfo.scope is set', () => {
  const launcher = new ConfigUILauncher({ port: 54399 });
  const url = launcher.buildConfigURL({
    projectPath: '/tmp/proj',
    projectName: 'TestApp',
    baseURL: 'http://localhost:3000',
    startCommand: 'npm run dev',
    scope: 'diff',
  });

  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('scope'), 'diff');
});

test('buildConfigURL defaults scope to "codebase" when not provided', () => {
  const launcher = new ConfigUILauncher({ port: 54399 });
  const url = launcher.buildConfigURL({
    projectPath: '/tmp/proj',
    projectName: 'TestApp',
    baseURL: 'http://localhost:3000',
    startCommand: 'npm run dev',
  });

  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('scope'), 'codebase');
});

test('buildConfigURL includes scope alongside existing params', () => {
  const launcher = new ConfigUILauncher({ port: 54399 });
  const url = launcher.buildConfigURL({
    projectPath: '/tmp/proj',
    projectName: 'MyApp',
    baseURL: 'http://localhost:4000',
    startCommand: 'yarn start',
    testType: 'backend',
    scope: 'diff',
    generateTests: false,
    openDashboard: false,
  });

  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('scope'), 'diff');
  assert.equal(parsed.searchParams.get('testType'), 'backend');
  assert.equal(parsed.searchParams.get('generateTests'), 'false');
  assert.equal(parsed.searchParams.get('baseURL'), 'http://localhost:4000');
});
