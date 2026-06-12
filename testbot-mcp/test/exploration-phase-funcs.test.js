'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EMPTY_ARTIFACT,
  normalizeExplorationArtifact,
  artifactHasUsefulContext,
} = require('../src/exploration-phase');

// ---------------------------------------------------------------------------
// EMPTY_ARTIFACT
// ---------------------------------------------------------------------------

test('EMPTY_ARTIFACT is frozen and has expected shape', () => {
  assert.ok(Object.isFrozen(EMPTY_ARTIFACT));
  assert.deepEqual(EMPTY_ARTIFACT.routes, []);
  assert.deepEqual(EMPTY_ARTIFACT.forms, []);
  assert.equal(EMPTY_ARTIFACT.authFlow, null);
  assert.deepEqual(EMPTY_ARTIFACT.keyFlows, []);
  assert.deepEqual(EMPTY_ARTIFACT.observedErrors, []);
});

// ---------------------------------------------------------------------------
// normalizeExplorationArtifact — basic normalization
// ---------------------------------------------------------------------------

test('normalizeExplorationArtifact returns correct shape with all-empty input', () => {
  const result = normalizeExplorationArtifact({}, 'test-source');
  assert.ok(Array.isArray(result.routes));
  assert.ok(Array.isArray(result.forms));
  assert.ok(Array.isArray(result.keyFlows));
  assert.ok(Array.isArray(result.observedErrors));
  assert.equal(result.authFlow, null);
  assert.equal(result.authFlowRejected, null);
  assert.ok('errorProbe' in result);
});

test('normalizeExplorationArtifact preserves routes array', () => {
  const result = normalizeExplorationArtifact({ routes: [{ path: '/dashboard' }, { path: '/settings' }] });
  assert.equal(result.routes.length, 2);
  assert.equal(result.routes[0].path, '/dashboard');
});

test('normalizeExplorationArtifact coerces null routes to empty array', () => {
  const result = normalizeExplorationArtifact({ routes: null });
  assert.deepEqual(result.routes, []);
});

test('normalizeExplorationArtifact coerces null forms to empty array', () => {
  const result = normalizeExplorationArtifact({ forms: null });
  assert.deepEqual(result.forms, []);
});

test('normalizeExplorationArtifact coerces null keyFlows to empty array', () => {
  const result = normalizeExplorationArtifact({ keyFlows: null });
  assert.deepEqual(result.keyFlows, []);
});

test('normalizeExplorationArtifact works when rawArtifact is null/undefined', () => {
  const result = normalizeExplorationArtifact(null);
  assert.ok(Array.isArray(result.routes));
  assert.ok(Array.isArray(result.forms));
  assert.equal(result.authFlow, null);
  assert.equal(result.authFlowRejected, null);
});

test('normalizeExplorationArtifact preserves errorProbe from rawArtifact', () => {
  const probe = { criticalErrors: ['404 on /home'] };
  const result = normalizeExplorationArtifact({ errorProbe: probe });
  assert.deepEqual(result.errorProbe, probe);
});

test('normalizeExplorationArtifact errorProbe defaults to null', () => {
  const result = normalizeExplorationArtifact({});
  assert.equal(result.errorProbe, null);
});

// ---------------------------------------------------------------------------
// normalizeExplorationArtifact — authFlow acceptance path
// ---------------------------------------------------------------------------

test('normalizeExplorationArtifact accepts a valid login authFlow', () => {
  const rawAuthFlow = {
    loginUrl: '/login',
    credentialFields: { username: 'email', password: 'password' },
  };
  const result = normalizeExplorationArtifact({ authFlow: rawAuthFlow }, 'playwright');
  // A login URL with password/identity fields should score > 35 and be accepted
  assert.ok(result.authFlow !== null, 'valid login authFlow should be accepted');
  assert.equal(result.authFlowRejected, null);
});

test('normalizeExplorationArtifact authFlow is null when rawArtifact has no authFlow', () => {
  const result = normalizeExplorationArtifact({ routes: [{ path: '/home' }] });
  assert.equal(result.authFlow, null);
  assert.equal(result.authFlowRejected, null);
});

// ---------------------------------------------------------------------------
// normalizeExplorationArtifact — authFlow rejection paths
// ---------------------------------------------------------------------------

test('normalizeExplorationArtifact rejects signup URL authFlow as unsafe', () => {
  const rawAuthFlow = {
    loginUrl: '/signup',
    credentialFields: { username: 'email', password: 'password' },
  };
  const result = normalizeExplorationArtifact({ authFlow: rawAuthFlow }, 'browser-use');
  assert.equal(result.authFlow, null, 'signup URL must be rejected');
  assert.ok(result.authFlowRejected !== null, 'authFlowRejected must be set');
  assert.equal(result.authFlowRejected.reason, 'registration_or_signup_flow');
  assert.equal(result.authFlowRejected.loginUrl, '/signup');
  assert.equal(result.authFlowRejected.source, 'browser-use');
});

test('normalizeExplorationArtifact rejects /register URL authFlow as unsafe', () => {
  const rawAuthFlow = { loginUrl: '/register' };
  const result = normalizeExplorationArtifact({ authFlow: rawAuthFlow }, 'test');
  assert.equal(result.authFlow, null);
  assert.equal(result.authFlowRejected.reason, 'registration_or_signup_flow');
});

test('normalizeExplorationArtifact rejects low-confidence authFlow (random URL)', () => {
  // A path with no login signals won't reach score>=35 — sanitizeAuthFlow returns null
  // but isUnsafeAuthFlow returns false → reason = 'low_confidence_login_flow'
  const rawAuthFlow = { loginUrl: '/some-random-dashboard-page' };
  const result = normalizeExplorationArtifact({ authFlow: rawAuthFlow }, 'playwright');
  assert.equal(result.authFlow, null);
  assert.ok(result.authFlowRejected !== null);
  assert.equal(result.authFlowRejected.reason, 'low_confidence_login_flow');
});

test('normalizeExplorationArtifact appends rejection reason to observedErrors', () => {
  const rawAuthFlow = { loginUrl: '/signup' };
  const result = normalizeExplorationArtifact({ authFlow: rawAuthFlow }, 'browser-use');
  assert.ok(result.observedErrors.length > 0);
  assert.ok(result.observedErrors[0].includes('/signup'));
});

test('normalizeExplorationArtifact preserves existing observedErrors on rejection', () => {
  const rawAuthFlow = { loginUrl: '/signup' };
  const existingError = 'previous error';
  const result = normalizeExplorationArtifact({
    authFlow: rawAuthFlow,
    observedErrors: [existingError],
  }, 'test');
  assert.equal(result.observedErrors.length, 2);
  assert.equal(result.observedErrors[0], existingError);
});

test('normalizeExplorationArtifact authFlow has loginUrl string after acceptance', () => {
  const result = normalizeExplorationArtifact({
    authFlow: { loginUrl: '/login', credentialFields: { username: 'email', password: 'password' } },
  });
  if (result.authFlow) {
    assert.ok(typeof result.authFlow.loginUrl === 'string');
  }
});

// ---------------------------------------------------------------------------
// artifactHasUsefulContext
// ---------------------------------------------------------------------------

test('artifactHasUsefulContext returns false for null', () => {
  assert.equal(artifactHasUsefulContext(null), false);
});

test('artifactHasUsefulContext returns false for non-object', () => {
  assert.equal(artifactHasUsefulContext('string'), false);
  assert.equal(artifactHasUsefulContext(42), false);
});

test('artifactHasUsefulContext returns false for empty artifact', () => {
  assert.equal(artifactHasUsefulContext({}), false);
  assert.equal(artifactHasUsefulContext(EMPTY_ARTIFACT), false);
});

test('artifactHasUsefulContext returns false for homepage-only routes', () => {
  const artifact = { routes: [{ path: '/' }], forms: [], keyFlows: [] };
  assert.equal(artifactHasUsefulContext(artifact), false);
});

test('artifactHasUsefulContext returns false for hash-root route', () => {
  const artifact = { routes: [{ path: '/#' }], forms: [], keyFlows: [] };
  assert.equal(artifactHasUsefulContext(artifact), false);
});

test('artifactHasUsefulContext returns false for login-only routes', () => {
  const artifact = {
    routes: [{ path: '/login' }, { path: '/signin' }, { path: '/sign-in' }],
    forms: [],
    keyFlows: [],
  };
  assert.equal(artifactHasUsefulContext(artifact), false);
});

test('artifactHasUsefulContext returns false for auth-only route variants', () => {
  const authPaths = ['/auth', '/auth/login', '/register', '/signup', '/sign-up', '/signin'];
  for (const p of authPaths) {
    const artifact = { routes: [{ path: p }], forms: [], keyFlows: [] };
    assert.equal(artifactHasUsefulContext(artifact), false, `Expected false for path: ${p}`);
  }
});

test('artifactHasUsefulContext returns true for a useful non-auth route', () => {
  const artifact = { routes: [{ path: '/dashboard' }], forms: [], keyFlows: [] };
  assert.equal(artifactHasUsefulContext(artifact), true);
});

test('artifactHasUsefulContext returns true for a route with url instead of path', () => {
  const artifact = { routes: [{ url: '/orders' }], forms: [], keyFlows: [] };
  assert.equal(artifactHasUsefulContext(artifact), true);
});

test('artifactHasUsefulContext returns true when forms present (no routes)', () => {
  const artifact = { routes: [], forms: [{ route: '/checkout', fields: ['email'] }], keyFlows: [] };
  assert.equal(artifactHasUsefulContext(artifact), true);
});

test('artifactHasUsefulContext returns true when keyFlows present (no routes)', () => {
  const artifact = { routes: [], forms: [], keyFlows: [{ name: 'purchase flow' }] };
  assert.equal(artifactHasUsefulContext(artifact), true);
});

test('artifactHasUsefulContext returns true when mix of auth and useful routes', () => {
  const artifact = {
    routes: [{ path: '/login' }, { path: '/products' }],
    forms: [],
    keyFlows: [],
  };
  assert.equal(artifactHasUsefulContext(artifact), true);
});

test('artifactHasUsefulContext returns false for routes with nested auth paths', () => {
  const artifact = {
    routes: [{ path: '/api/auth/session' }],
    forms: [],
    keyFlows: [],
  };
  assert.equal(artifactHasUsefulContext(artifact), false);
});

test('artifactHasUsefulContext ignores null/undefined route entries', () => {
  const artifact = { routes: [null, undefined, { path: '/dashboard' }], forms: [], keyFlows: [] };
  assert.equal(artifactHasUsefulContext(artifact), true);
});
