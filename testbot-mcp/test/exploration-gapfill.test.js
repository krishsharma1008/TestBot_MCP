const assert = require('node:assert/strict');
const test = require('node:test');

const { mergeGapFillArtifact } = require('../src/exploration-phase');

test('mergeGapFillArtifact keeps all primary routes and adds only net-new gap-fill routes', () => {
  const primary = {
    routes: [
      { path: '/', requiresAuth: false, elements: [{ name: 'Home' }] },
      { path: '/admindashboard', requiresAuth: true, requiredRole: 'admin' },
    ],
    forms: [],
    keyFlows: [],
    observedErrors: ['primary-err'],
    authFlow: { loginUrl: '/login' },
  };
  const gapFill = {
    routes: [
      { path: '/admindashboard', requiresAuth: true },          // duplicate — must not overwrite
      { path: '/admindashboard/settings', requiresAuth: true }, // net-new
    ],
    forms: [],
    keyFlows: [],
    observedErrors: ['gapfill-err'],
    authFlow: null,
  };

  const merged = mergeGapFillArtifact(primary, gapFill);
  const paths = merged.routes.map((r) => r.path);

  assert.deepEqual(paths, ['/', '/admindashboard', '/admindashboard/settings']);
  // Duplicate route kept the primary's data (still has requiredRole).
  assert.equal(merged.routes.find((r) => r.path === '/admindashboard').requiredRole, 'admin');
  // Net-new route tagged as gap-fill sourced.
  assert.equal(merged.routes.find((r) => r.path === '/admindashboard/settings').source, 'browser-use-gapfill');
});

test('mergeGapFillArtifact unions forms and keyFlows without duplicating', () => {
  const primary = {
    routes: [],
    forms: [{ route: '/login', fields: ['email', 'password'] }],
    keyFlows: [{ name: 'login' }],
    observedErrors: [],
  };
  const gapFill = {
    routes: [],
    forms: [
      { route: '/login', fields: ['email', 'password'] }, // duplicate
      { route: '/profile', fields: ['name'] },             // net-new
    ],
    keyFlows: [
      { name: 'login' },                 // duplicate
      { name: 'update-profile' },        // net-new
    ],
    observedErrors: [],
  };

  const merged = mergeGapFillArtifact(primary, gapFill);
  assert.equal(merged.forms.length, 2);
  assert.deepEqual(merged.keyFlows.map((k) => k.name), ['login', 'update-profile']);
});

test('mergeGapFillArtifact dedups observedErrors and prefers the primary authFlow', () => {
  const primary = {
    routes: [], forms: [], keyFlows: [],
    observedErrors: ['shared', 'p-only'],
    authFlow: { loginUrl: '/login', credentialFields: { username: '#u', password: '#p' } },
  };
  const gapFill = {
    routes: [], forms: [], keyFlows: [],
    observedErrors: ['shared', 'g-only'],
    authFlow: { loginUrl: '/signin' },
  };

  const merged = mergeGapFillArtifact(primary, gapFill);
  assert.deepEqual(merged.observedErrors.sort(), ['g-only', 'p-only', 'shared']);
  // chooseBetterAuthFlow prefers the more complete primary flow.
  assert.equal(merged.authFlow.loginUrl, '/login');
});

test('mergeGapFillArtifact is safe with empty/missing gap-fill', () => {
  const primary = { routes: [{ path: '/' }], forms: [], keyFlows: [], observedErrors: [] };
  const merged = mergeGapFillArtifact(primary, {});
  assert.deepEqual(merged.routes.map((r) => r.path), ['/']);
});
