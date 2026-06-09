const assert = require('node:assert/strict');
const test = require('node:test');

const { _landedOnLoginPage: landedOnLoginPage } = require('../src/playwright-explorer');

function fakePage(url) {
  return { url: () => url };
}

// RC3 regression: run 1780925226135-3xfian. Protected-route enrichment navigated
// unauthenticated, got redirected to /login, and recorded the LOGIN page DOM as
// the route's content. The AI then had no real dashboard selectors and fell back
// to page.locator('main') → 13 timeouts. Detect the redirect so we flag the
// route as un-enriched instead of capturing the wrong DOM.
test('protected route redirected to /login is detected', () => {
  const route = { path: '/admindashboard', requiresAuth: true, requiredRole: 'admin' };
  assert.equal(landedOnLoginPage(fakePage('http://localhost:3001/login'), route), true);
});

test('protected route that actually loaded is NOT flagged', () => {
  const route = { path: '/admindashboard', requiresAuth: true, requiredRole: 'admin' };
  assert.equal(landedOnLoginPage(fakePage('http://localhost:3001/admindashboard'), route), false);
});

test('the login route itself is never treated as a redirect', () => {
  // We are intentionally enriching the login page — landing there is correct.
  const route = { path: '/login', requiresAuth: false };
  assert.equal(landedOnLoginPage(fakePage('http://localhost:3001/login'), route), false);
});

test('hash-based auth redirect is detected', () => {
  const route = { path: '/userdashboard', requiresAuth: true };
  assert.equal(landedOnLoginPage(fakePage('http://localhost:3001/#/signin'), route), true);
});
