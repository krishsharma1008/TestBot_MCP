const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const AutoDetector = require('../src/auto-detector');

// Build a throwaway repo tree under a temp dir. `tree` maps relative file paths
// to string contents; package.json values may be objects (auto-stringified).
function makeRepo(tree) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'healix-detect-'));
  for (const [rel, contents] of Object.entries(tree)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const data = typeof contents === 'string' ? contents : JSON.stringify(contents);
    fs.writeFileSync(abs, data);
  }
  return root;
}

function cleanup(root) {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
}

const detector = new AutoDetector();

test('single-service: plain Vite frontend is NOT split', async () => {
  const root = makeRepo({
    'package.json': { name: 'fe', dependencies: { react: '18.0.0', vite: '5.0.0' } },
  });
  try {
    const settings = await detector.detect(root);
    assert.equal(settings.services.length, 1);
    assert.equal(settings.services[0].role, 'frontend');
    assert.equal(settings.services[0].path, '.');
  } finally { cleanup(root); }
});

test('single-service: Next.js fullstack with app/ + api/ dirs is NOT split', async () => {
  const root = makeRepo({
    'package.json': { name: 'app', dependencies: { next: '14.0.0', react: '18.0.0' } },
    'app/page.tsx': 'export default function Page(){return null}',
    'app/api/route.ts': 'export function GET(){}',
  });
  try {
    const settings = await detector.detect(root);
    assert.equal(settings.services.length, 1);
    assert.equal(settings.services[0].role, 'fullstack');
  } finally { cleanup(root); }
});

test('multi-service: client/ + server/ split into two services', async () => {
  const root = makeRepo({
    'client/package.json': { name: 'client', dependencies: { react: '18.0.0', vite: '5.0.0' } },
    'server/package.json': { name: 'server', dependencies: { express: '4.18.0' } },
  });
  try {
    const settings = await detector.detect(root);
    assert.equal(settings.services.length, 2);
    const roles = settings.services.map((s) => s.role).sort();
    assert.deepEqual(roles, ['backend', 'frontend']);
  } finally { cleanup(root); }
});

test('multi-service: non-standard names (ui/ + api/) split via content, not name', async () => {
  const root = makeRepo({
    'ui/package.json': { name: 'ui', dependencies: { vue: '3.0.0', vite: '5.0.0' } },
    'api/package.json': { name: 'api', dependencies: { fastify: '4.0.0' } },
  });
  try {
    const settings = await detector.detect(root);
    assert.equal(settings.services.length, 2);
    const roles = settings.services.map((s) => s.role).sort();
    assert.deepEqual(roles, ['backend', 'frontend']);
  } finally { cleanup(root); }
});

test('multi-service: role inferred from deps, not directory position', async () => {
  // "client" actually holds the Express API; "server" holds the React app.
  const root = makeRepo({
    'client/package.json': { name: 'client', dependencies: { express: '4.18.0' } },
    'server/package.json': { name: 'server', dependencies: { react: '18.0.0', vite: '5.0.0' } },
  });
  try {
    const settings = await detector.detect(root);
    const byRole = Object.fromEntries(settings.services.map((s) => [s.role, s.path]));
    assert.equal(byRole.backend, 'client');
    assert.equal(byRole.frontend, 'server');
  } finally { cleanup(root); }
});

test('multi-service: apps/* workspace layout (web + api)', async () => {
  const root = makeRepo({
    'package.json': { name: 'mono', private: true, workspaces: ['apps/*'], devDependencies: { turbo: '1.0.0' } },
    'apps/web/package.json': { name: 'web', dependencies: { next: '14.0.0' } },
    'apps/api/package.json': { name: 'api', dependencies: { '@nestjs/core': '10.0.0' } },
  });
  try {
    const settings = await detector.detect(root);
    assert.equal(settings.services.length, 2);
    const paths = settings.services.map((s) => s.path).sort();
    assert.deepEqual(paths, ['apps/api', 'apps/web']);
    // The workspace root carries only tooling deps → must not become a service.
    assert.ok(!settings.services.some((s) => s.path === '.'));
  } finally { cleanup(root); }
});

test('multi-service: pnpm-workspace.yaml packages glob', async () => {
  const root = makeRepo({
    'package.json': { name: 'mono', private: true },
    'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n",
    'packages/frontend/package.json': { name: 'frontend', dependencies: { svelte: '4.0.0', vite: '5.0.0' } },
    'packages/backend/package.json': { name: 'backend', dependencies: { koa: '2.0.0' } },
  });
  try {
    const settings = await detector.detect(root);
    assert.equal(settings.services.length, 2);
    const roles = settings.services.map((s) => s.role).sort();
    assert.deepEqual(roles, ['backend', 'frontend']);
  } finally { cleanup(root); }
});

test('multi-service: port conflict between two :3000 defaults is reconciled', async () => {
  const root = makeRepo({
    'client/package.json': { name: 'client', dependencies: { 'react-scripts': '5.0.1', react: '18.0.0' } },
    'server/package.json': { name: 'server', dependencies: { express: '4.18.0' } },
  });
  try {
    const settings = await detector.detect(root);
    const ports = settings.services.map((s) => s.port);
    assert.equal(new Set(ports).size, ports.length, `ports must be unique, got ${ports}`);
  } finally { cleanup(root); }
});

test('apiOnly is true when every detected service is a backend', async () => {
  const root = makeRepo({
    'package.json': { name: 'api', dependencies: { express: '4.18.0' } },
  });
  try {
    const settings = await detector.detect(root);
    assert.equal(settings.apiOnly, true);
  } finally { cleanup(root); }
});

test('frontend at root + server/ subdir splits (old name-pair list would miss this)', async () => {
  const root = makeRepo({
    'package.json': { name: 'app', dependencies: { react: '18.0.0', vite: '5.0.0' } },
    'server/package.json': { name: 'server', dependencies: { express: '4.18.0' } },
  });
  try {
    const settings = await detector.detect(root);
    assert.equal(settings.services.length, 2);
    const root_svc = settings.services.find((s) => s.path === '.');
    assert.equal(root_svc.role, 'frontend');
  } finally { cleanup(root); }
});

// ── Case 3: backend-dependency detection ───────────────────────────────────

test('backendDependency: VITE_API_URL env var on a frontend-only repo', async () => {
  const root = makeRepo({
    'package.json': { name: 'fe', dependencies: { react: '18.0.0', vite: '5.0.0' } },
    '.env': 'VITE_API_URL=http://localhost:3001\n',
  });
  try {
    const settings = await detector.detect(root);
    assert.ok(settings.backendDependency, 'expected backendDependency to be set');
    assert.equal(settings.backendDependency.url, 'http://localhost:3001');
    assert.equal(settings.backendDependency.port, 3001);
  } finally { cleanup(root); }
});

test('backendDependency: vite.config.ts server.proxy target', async () => {
  const root = makeRepo({
    'package.json': { name: 'fe', dependencies: { vue: '3.0.0', vite: '5.0.0' } },
    'vite.config.ts': "export default { server: { proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } } } }",
  });
  try {
    const settings = await detector.detect(root);
    assert.ok(settings.backendDependency);
    assert.equal(settings.backendDependency.url, 'http://localhost:8080');
    assert.equal(settings.backendDependency.port, 8080);
  } finally { cleanup(root); }
});

test('backendDependency: CRA package.json proxy field', async () => {
  const root = makeRepo({
    'package.json': { name: 'fe', dependencies: { 'react-scripts': '5.0.1', react: '18.0.0' }, proxy: 'http://localhost:5000' },
  });
  try {
    const settings = await detector.detect(root);
    assert.ok(settings.backendDependency);
    assert.equal(settings.backendDependency.url, 'http://localhost:5000');
  } finally { cleanup(root); }
});

test('backendDependency: next.config.js rewrites destination', async () => {
  // A Next repo is fullstack, so detection should NOT flag a backend dependency
  // even when a rewrite exists — the prereq only applies to frontend-only repos.
  const root = makeRepo({
    'package.json': { name: 'app', dependencies: { next: '14.0.0', react: '18.0.0' } },
    'next.config.js': "module.exports = { async rewrites(){ return [{ source: '/api/:p*', destination: 'http://localhost:9000/:p*' }] } }",
  });
  try {
    const settings = await detector.detect(root);
    assert.equal(settings.backendDependency, null);
  } finally { cleanup(root); }
});

test('backendDependency: null for multi-service repos (backend is launched)', async () => {
  const root = makeRepo({
    'client/package.json': { name: 'client', dependencies: { react: '18.0.0', vite: '5.0.0' } },
    'client/.env': 'VITE_API_URL=http://localhost:3001\n',
    'server/package.json': { name: 'server', dependencies: { express: '4.18.0' } },
  });
  try {
    const settings = await detector.detect(root);
    assert.equal(settings.backendDependency, null);
  } finally { cleanup(root); }
});

test('backendDependency: null when no backend hints exist', async () => {
  const root = makeRepo({
    'package.json': { name: 'fe', dependencies: { react: '18.0.0', vite: '5.0.0' } },
  });
  try {
    const settings = await detector.detect(root);
    assert.equal(settings.backendDependency, null);
  } finally { cleanup(root); }
});

// ── Source-file port detection ─────────────────────────────────────────────

test('port: process.env.PORT || 5000 in app.js is picked up', async () => {
  const root = makeRepo({
    'client/package.json': { name: 'fe', dependencies: { react: '18.0.0', vite: '5.0.0' } },
    'server/package.json': { name: 'api', dependencies: { express: '4.18.0' } },
    'server/app.js': `
      const express = require('express');
      const app = express();
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => console.log('running'));
    `,
  });
  try {
    const settings = await detector.detect(root);
    const backend = settings.services.find((s) => s.role === 'backend');
    assert.ok(backend, 'backend service must exist');
    assert.equal(backend.port, 5000, `expected port 5000, got ${backend.port}`);
  } finally { cleanup(root); }
});

test('port: Java Spring Boot application.properties server.port is detected', async () => {
  const root = makeRepo({
    'client/package.json': { name: 'fe', dependencies: { react: '18.0.0', vite: '5.0.0' } },
    'server/pom.xml': '<project/>',
    'server/src/main/resources/application.properties': 'server.port=8090\nspring.datasource.url=jdbc:h2:mem:testdb\n',
  });
  try {
    const settings = await detector.detect(root);
    const backend = settings.services.find((s) => s.role === 'backend');
    assert.ok(backend, 'backend service must exist');
    assert.equal(backend.port, 8090);
  } finally { cleanup(root); }
});

test('port: Java Spring Boot application.yml server port is detected', async () => {
  const root = makeRepo({
    'client/package.json': { name: 'fe', dependencies: { react: '18.0.0', vite: '5.0.0' } },
    'server/pom.xml': '<project/>',
    'server/src/main/resources/application.yml': 'server:\n  port: 9090\n',
  });
  try {
    const settings = await detector.detect(root);
    const backend = settings.services.find((s) => s.role === 'backend');
    assert.ok(backend);
    assert.equal(backend.port, 9090);
  } finally { cleanup(root); }
});

test('port: .env.local PORT overrides framework default', async () => {
  const root = makeRepo({
    'client/package.json': { name: 'fe', dependencies: { react: '18.0.0', vite: '5.0.0' } },
    'server/package.json': { name: 'api', dependencies: { express: '4.18.0' } },
    'server/.env.local': 'PORT=7777\n',
  });
  try {
    const settings = await detector.detect(root);
    const backend = settings.services.find((s) => s.role === 'backend');
    assert.ok(backend);
    assert.equal(backend.port, 7777);
  } finally { cleanup(root); }
});

test('port: app.listen(8080) in server.js wins over express default 3000', async () => {
  const root = makeRepo({
    'client/package.json': { name: 'fe', dependencies: { react: '18.0.0', vite: '5.0.0' } },
    'server/package.json': { name: 'api', dependencies: { express: '4.18.0' } },
    'server/server.js': `
      const express = require('express');
      const app = express();
      app.listen(8080, () => console.log('listening'));
    `,
  });
  try {
    const settings = await detector.detect(root);
    const backend = settings.services.find((s) => s.role === 'backend');
    assert.ok(backend);
    assert.equal(backend.port, 8080);
  } finally { cleanup(root); }
});

// ── Case 4: Docker Compose stack detection ─────────────────────────────────

test('composeStack: web + db stack is one unit started by docker compose up', async () => {
  const root = makeRepo({
    'package.json': { name: 'app', dependencies: { express: '4.18.0' } },
    'docker-compose.yml': [
      'services:',
      '  web:',
      '    build: .',
      '    ports:',
      '      - "8080:80"',
      '  db:',
      '    image: postgres:15',
      '    ports:',
      '      - "5432:5432"',
      '',
    ].join('\n'),
  });
  try {
    const settings = await detector.detect(root);
    assert.ok(settings.composeStack, 'expected composeStack to be set');
    assert.equal(settings.composeStack.port, 8080);
    assert.equal(settings.composeStack.baseURL, 'http://localhost:8080/');
    assert.equal(settings.composeStack.command, 'docker compose up');
    // Treated as one unit → exactly one service, not split.
    assert.equal(settings.services.length, 1);
    assert.equal(settings.services[0].framework, 'docker-compose');
    assert.equal(settings.baseURL, 'http://localhost:8080/');
  } finally { cleanup(root); }
});

test('composeStack: infra-only compose (postgres+redis) is NOT hijacked', async () => {
  const root = makeRepo({
    'package.json': { name: 'fe', dependencies: { react: '18.0.0', vite: '5.0.0' } },
    'docker-compose.yml': [
      'services:',
      '  db:',
      '    image: postgres:15',
      '    ports:',
      '      - "5432:5432"',
      '  cache:',
      '    image: redis:7',
      '    ports:',
      '      - "6379:6379"',
      '',
    ].join('\n'),
  });
  try {
    const settings = await detector.detect(root);
    assert.equal(settings.composeStack, null);
    // Falls through to normal detection.
    assert.equal(settings.services[0].role, 'frontend');
  } finally { cleanup(root); }
});

test('composeStack: inline ports array and service-name preference', async () => {
  const root = makeRepo({
    'compose.yaml': [
      'services:',
      '  api:',
      '    build: ./api',
      '    ports: ["9000:9000"]',
      '  frontend:',
      '    build: ./frontend',
      '    ports: ["3000:3000"]',
      '  db:',
      '    image: mysql:8',
      '',
    ].join('\n'),
  });
  try {
    const settings = await detector.detect(root);
    assert.ok(settings.composeStack);
    // "frontend" is preferred over "api" as the web entrypoint.
    assert.equal(settings.composeStack.port, 3000);
  } finally { cleanup(root); }
});

test('composeStack: does NOT hijack a repo with separate frontend+backend dirs', async () => {
  // This is the key regression: a dev-database compose file must not swallow
  // the multi-service split that the directory scan found.
  const root = makeRepo({
    'docker-compose.yml': [
      'services:',
      '  db:',
      '    image: postgres:15',
      '    ports:',
      '      - "5432:5432"',
      '  web:',
      '    build: .',
      '    ports:',
      '      - "8080:80"',
      '',
    ].join('\n'),
    'frontend/package.json': { name: 'fe', dependencies: { react: '18.0.0', vite: '5.0.0' } },
    'backend/package.json': { name: 'api', dependencies: { express: '4.18.0' } },
  });
  try {
    const settings = await detector.detect(root);
    // Multi-service wins; compose is skipped.
    assert.equal(settings.composeStack, null);
    assert.equal(settings.services.length, 2);
    const roles = settings.services.map((s) => s.role).sort();
    assert.deepEqual(roles, ['backend', 'frontend']);
  } finally { cleanup(root); }
});

test('composeStack: null when no compose file present', async () => {
  const root = makeRepo({
    'package.json': { name: 'app', dependencies: { express: '4.18.0' } },
  });
  try {
    const settings = await detector.detect(root);
    assert.equal(settings.composeStack, null);
  } finally { cleanup(root); }
});

// ── normalizeCommandForPlatform ──────────────────────────────────────────────
// These tests exercise the Windows-path of the normalizer directly by mocking
// process.platform inline (the function reads it at call time).

const { normalizeCommandForPlatform } = require('../src/multi-service-starter');

function normalizeOnWindows(cmd) {
  const orig = process.platform;
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  try {
    return normalizeCommandForPlatform(cmd);
  } finally {
    Object.defineProperty(process, 'platform', { value: orig, configurable: true });
  }
}

function normalizeOnUnix(cmd) {
  const orig = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
  try {
    return normalizeCommandForPlatform(cmd);
  } finally {
    Object.defineProperty(process, 'platform', { value: orig, configurable: true });
  }
}

test('normalizeCommandForPlatform: PORT=3000 node app.js → set PORT=3000 && node app.js on Windows', () => {
  assert.equal(normalizeOnWindows('PORT=3000 node app.js'), 'set PORT=3000 && node app.js');
});

test('normalizeCommandForPlatform: multiple leading vars are each wrapped in set', () => {
  assert.equal(
    normalizeOnWindows('NODE_ENV=production PORT=5000 node server.js'),
    'set NODE_ENV=production && set PORT=5000 && node server.js'
  );
});

test('normalizeCommandForPlatform: npm run dev unchanged on Windows (no leading KEY=val)', () => {
  assert.equal(normalizeOnWindows('npm run dev'), 'npm run dev');
});

test('normalizeCommandForPlatform: set PORT=3000 && npm start unchanged on Windows (already converted)', () => {
  assert.equal(normalizeOnWindows('set PORT=3000 && npm start'), 'set PORT=3000 && npm start');
});

test('normalizeCommandForPlatform: command is unchanged on non-Windows regardless of syntax', () => {
  assert.equal(normalizeOnUnix('PORT=3000 node app.js'), 'PORT=3000 node app.js');
});

test('normalizeCommandForPlatform: node app.js unchanged on Windows', () => {
  assert.equal(normalizeOnWindows('node app.js'), 'node app.js');
});
