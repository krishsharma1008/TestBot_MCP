/**
 * Bug Fix #2 — MSAL / OAuth popup-auth detection
 *
 * Verifies that detectOAuthRedirect() correctly identifies redirects
 * to external identity providers so driveLogin() can return an
 * actionable error instead of silently failing with
 * "No login form found".
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { detectOAuthRedirect, OAUTH_DOMAINS } = require('../src/credentials-injector');

// ─── detectOAuthRedirect ──────────────────────────────────────────────────────

test('msal-oauth: detects Microsoft MSAL redirect (microsoftonline.com)', () => {
  const matched = detectOAuthRedirect(
    'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/authorize?client_id=abc',
  );
  assert.ok(matched, 'should detect microsoftonline.com as OAuth provider');
  assert.match(matched, /microsoftonline/);
});

test('msal-oauth: detects Google OAuth redirect', () => {
  const matched = detectOAuthRedirect(
    'https://accounts.google.com/o/oauth2/auth?client_id=xyz',
  );
  assert.ok(matched, 'should detect accounts.google.com as OAuth provider');
});

test('msal-oauth: detects GitHub OAuth redirect', () => {
  const matched = detectOAuthRedirect('https://github.com/login/oauth/authorize');
  assert.ok(matched, 'should detect github.com/login as OAuth provider');
});

test('msal-oauth: detects Auth0 redirect', () => {
  const matched = detectOAuthRedirect('https://mycompany.auth0.com/authorize');
  assert.ok(matched, 'should detect auth0.com as OAuth provider');
});

test('msal-oauth: detects Okta redirect', () => {
  const matched = detectOAuthRedirect('https://mycompany.okta.com/oauth2/default/v1/authorize');
  assert.ok(matched, 'should detect .okta.com as OAuth provider');
});

test('msal-oauth: detects ADFS redirect', () => {
  const matched = detectOAuthRedirect('https://corp.example.com/adfs/ls/IdpInitiatedSignOn');
  assert.ok(matched, 'should detect /adfs/ path as OAuth provider');
});

test('msal-oauth: does NOT flag normal app login pages', () => {
  const urls = [
    'http://localhost:3000/login',
    'http://localhost:3000/auth/signin',
    'https://myapp.com/users/sign_in',
    'https://myapp.com/account/login',
  ];
  for (const url of urls) {
    const matched = detectOAuthRedirect(url);
    assert.equal(
      matched,
      null,
      `should NOT flag normal login page: ${url}`,
    );
  }
});

test('msal-oauth: detection is case-insensitive', () => {
  const matched = detectOAuthRedirect(
    'HTTPS://LOGIN.MICROSOFTONLINE.COM/common/oauth2/authorize',
  );
  assert.ok(matched, 'detection should be case-insensitive');
});

test('msal-oauth: OAUTH_DOMAINS list is non-empty and contains key providers', () => {
  assert.ok(Array.isArray(OAUTH_DOMAINS), 'OAUTH_DOMAINS should be an array');
  assert.ok(OAUTH_DOMAINS.length >= 6, 'should cover at least 6 providers');
  assert.ok(OAUTH_DOMAINS.includes('login.microsoftonline.com'), 'must include Microsoft');
  assert.ok(OAUTH_DOMAINS.includes('accounts.google.com'), 'must include Google');
  assert.ok(OAUTH_DOMAINS.includes('auth0.com'), 'must include Auth0');
});
