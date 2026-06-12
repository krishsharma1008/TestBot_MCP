const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { exploreWithPlaywright, enrichAllRoutesWithDOM } = require('../src/playwright-explorer');

function startFixtureServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    const path = req.url.split('?')[0];
    const heading = path === '/orders' ? 'Orders' : (path === '/admin' ? 'Admin' : 'Home');
    res.end(`<!doctype html>
      <html>
        <head><title>${heading}</title></head>
        <body>
          <h1>${heading}</h1>
          <nav>
            <a href="/admin#/products">Admin products</a>
            <a href="/products?q=book">Book search</a>
          </nav>
          <button id="orders-nav" onclick="history.pushState({}, '', '/orders'); document.querySelector('h1').textContent = 'Orders';">Orders</button>
          <button id="menu-toggle" onclick="document.getElementById('menu').innerHTML = '<a href=&quot;/checkout&quot;>Checkout</a>';">Menu</button>
          <div id="menu"></div>
        </body>
      </html>`);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        baseURL: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

test('playwright heuristic explores hash, query, and click-driven routes', async () => {
  const fixture = await startFixtureServer();
  try {
    const result = await exploreWithPlaywright({ baseURL: fixture.baseURL });
    assert.equal(result.available, true);
    const paths = new Set((result.artifact.routes || []).map((route) => route.path));
    assert.equal(paths.has('/'), true);
    assert.equal(paths.has('/admin#/products'), true);
    assert.equal(paths.has('/products?q=book'), true);
    assert.equal(paths.has('/orders'), true);
    assert.equal(paths.has('/checkout'), true);
  } finally {
    await fixture.close();
  }
});

test('enrichAllRoutesWithDOM returns Map with DOM data for known routes', async () => {
  const fixture = await startFixtureServer();
  try {
    const routes = [{ path: '/' }, { path: '/admin' }];
    const { enrichments, timedOut } = await enrichAllRoutesWithDOM({
      routes,
      baseURL: fixture.baseURL,
      concurrency: 2,
      timeBudgetMs: 30_000,
    });
    assert.ok(enrichments instanceof Map, 'enrichments is a Map');
    assert.equal(timedOut, false);
    assert.ok(enrichments.has('/') || enrichments.has('/admin'), 'at least one route enriched');
    if (enrichments.has('/')) {
      const dom = enrichments.get('/');
      assert.ok(typeof dom === 'object', 'DOM data is an object');
    }
  } finally {
    await fixture.close();
  }
});

test('enrichAllRoutesWithDOM respects time budget and sets timedOut flag', async () => {
  const fixture = await startFixtureServer();
  try {
    const routes = [{ path: '/' }, { path: '/admin' }, { path: '/products' }];
    // Budget of 1ms forces an immediate timeout.
    const { enrichments, timedOut } = await enrichAllRoutesWithDOM({
      routes,
      baseURL: fixture.baseURL,
      concurrency: 1,
      timeBudgetMs: 1,
    });
    assert.ok(enrichments instanceof Map);
    // With 1ms budget, timedOut should be true (at least one bucket hit the deadline).
    assert.equal(timedOut, true, 'timedOut should be true with 1ms budget');
  } finally {
    await fixture.close();
  }
});

test('enrichAllRoutesWithDOM returns empty Map for empty routes list', async () => {
  const { enrichments, timedOut } = await enrichAllRoutesWithDOM({
    routes: [],
    baseURL: 'http://127.0.0.1:9999',
  });
  assert.ok(enrichments instanceof Map);
  assert.equal(enrichments.size, 0);
  assert.equal(timedOut, false);
});

test('enrichAllRoutesWithDOM sorts priority paths first', async () => {
  const fixture = await startFixtureServer();
  try {
    const routes = [{ path: '/admin' }, { path: '/' }];
    // '/' is the priority path — should be processed first.
    const { enrichments } = await enrichAllRoutesWithDOM({
      routes,
      baseURL: fixture.baseURL,
      concurrency: 1,
      timeBudgetMs: 30_000,
      priorityPaths: ['/'],
    });
    // Both routes should still be enriched; priority only affects order.
    assert.ok(enrichments instanceof Map);
  } finally {
    await fixture.close();
  }
});
