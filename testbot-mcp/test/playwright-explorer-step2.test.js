const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { exploreWithPlaywright, enrichAllRoutesWithDOM } = require('../src/playwright-explorer');

// A landing page with NO links to /hidden. The only way an explorer reaches
// /hidden is if it is seeded from static code analysis — mirroring a SPA route
// reached via router.navigate() after login rather than an <a href>.
function startUnlinkedRouteServer() {
  const server = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const heading = p === '/hidden' ? 'Hidden Dashboard' : 'Login';
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><html><head><title>${heading}</title></head><body><h1>${heading}</h1></body></html>`);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ baseURL: `http://127.0.0.1:${port}`, close: () => new Promise((d) => server.close(d)) });
    });
  });
}

// Echoes the `role` cookie value into an <h1> so we can assert which session a
// page was visited under.
function startRoleEchoServer() {
  const server = http.createServer((req, res) => {
    const cookie = req.headers.cookie || '';
    const m = cookie.match(/role=(\w+)/);
    const role = m ? m[1] : 'anon';
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><html><head><title>r</title></head><body><h1>role:${role}</h1></body></html>`);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ baseURL: `http://127.0.0.1:${port}`, close: () => new Promise((d) => server.close(d)) });
    });
  });
}

function writeStorageState(roleValue) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'healix-state-'));
  const file = path.join(dir, `auth-state-${roleValue}.json`);
  fs.writeFileSync(file, JSON.stringify({
    cookies: [{
      name: 'role', value: roleValue, domain: '127.0.0.1', path: '/',
      expires: -1, httpOnly: false, secure: false, sameSite: 'Lax',
    }],
    origins: [],
  }));
  return file;
}

test('exploreWithPlaywright seeds known routes the crawl could not reach via links', async () => {
  const fixture = await startUnlinkedRouteServer();
  try {
    const withoutSeed = await exploreWithPlaywright({ baseURL: fixture.baseURL });
    const seenWithout = new Set((withoutSeed.artifact.routes || []).map((r) => r.path));
    assert.equal(seenWithout.has('/hidden'), false, '/hidden is unreachable without seeding');

    const withSeed = await exploreWithPlaywright({ baseURL: fixture.baseURL, seedRoutes: [{ path: '/hidden' }] });
    const seenWith = new Set((withSeed.artifact.routes || []).map((r) => r.path));
    assert.equal(seenWith.has('/hidden'), true, 'seeded /hidden must be visited');
  } finally {
    await fixture.close();
  }
});

test('enrichAllRoutesWithDOM visits each role-gated route under its own session', async () => {
  const fixture = await startRoleEchoServer();
  const adminState = writeStorageState('admin');
  const userState = writeStorageState('user');
  try {
    const { enrichments } = await enrichAllRoutesWithDOM({
      routes: [
        { path: '/admin-area', requiresAuth: true, requiredRole: 'admin' },
        { path: '/user-area', requiresAuth: true, requiredRole: 'user' },
      ],
      baseURL: fixture.baseURL,
      storageStatePaths: [
        { role: 'admin', storageStatePath: adminState },
        { role: 'user', storageStatePath: userState },
      ],
      concurrency: 2,
      timeBudgetMs: 30_000,
    });

    const headingText = (p) => (enrichments.get(p)?.headings || []).map((h) => h.text).join(' ');
    assert.match(headingText('/admin-area'), /role:admin/, 'admin route enriched under admin session');
    assert.match(headingText('/user-area'), /role:user/, 'user route enriched under user session');
  } finally {
    await fixture.close();
    fs.rmSync(path.dirname(adminState), { recursive: true, force: true });
    fs.rmSync(path.dirname(userState), { recursive: true, force: true });
  }
});

test('enrichAllRoutesWithDOM falls back to an authenticated session for an unmatched role', async () => {
  const fixture = await startRoleEchoServer();
  const adminState = writeStorageState('admin');
  try {
    // Route requires a role with no matching session → should fall back to the
    // only available authenticated session rather than visiting anonymously.
    const { enrichments } = await enrichAllRoutesWithDOM({
      routes: [{ path: '/reports', requiresAuth: true, requiredRole: 'manager' }],
      baseURL: fixture.baseURL,
      storageStatePaths: [{ role: 'admin', storageStatePath: adminState }],
      concurrency: 1,
      timeBudgetMs: 30_000,
    });
    const heading = (enrichments.get('/reports')?.headings || []).map((h) => h.text).join(' ');
    assert.match(heading, /role:admin/, 'unmatched role falls back to an available session');
  } finally {
    await fixture.close();
    fs.rmSync(path.dirname(adminState), { recursive: true, force: true });
  }
});
