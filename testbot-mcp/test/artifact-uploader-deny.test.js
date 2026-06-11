'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { isCredentialFile } = require('../src/artifact-uploader');

// ---------------------------------------------------------------------------
// isCredentialFile — credential deny-list
// These patterns are SECURITY-CRITICAL: credential files must NEVER upload.
// ---------------------------------------------------------------------------

test('isCredentialFile returns false for normal screenshot file', () => {
  assert.equal(isCredentialFile('/project/test-results/screenshot.png', 'screenshot.png'), false);
});

test('isCredentialFile returns false for a trace zip', () => {
  assert.equal(isCredentialFile('/project/test-results/trace.zip', 'trace.zip'), false);
});

test('isCredentialFile returns false for a video file', () => {
  assert.equal(isCredentialFile('/project/test-results/video.webm', 'video.webm'), false);
});

// auth-state-*.json patterns
test('isCredentialFile blocks auth-state-user.json by fileName', () => {
  assert.equal(isCredentialFile(null, 'auth-state-user.json'), true);
});

test('isCredentialFile blocks auth-state-admin.json by fileName', () => {
  assert.equal(isCredentialFile(null, 'auth-state-admin.json'), true);
});

test('isCredentialFile blocks auth-state-*.json by fullPath (in .healix dir)', () => {
  assert.equal(isCredentialFile('/project/.healix/auth-state-user.json', null), true);
});

test('isCredentialFile blocks auth-state-*.json by fullPath (anywhere on disk)', () => {
  assert.equal(isCredentialFile('/tmp/auth-state-role1.json', null), true);
});

test('isCredentialFile blocks auth-state-*.json with Windows path separators', () => {
  assert.equal(isCredentialFile('C:\\project\\.healix\\auth-state-admin.json', null), true);
});

// credentials.json pattern
test('isCredentialFile blocks credentials.json by fileName', () => {
  assert.equal(isCredentialFile(null, 'credentials.json'), true);
});

test('isCredentialFile blocks credentials.json by fullPath', () => {
  assert.equal(isCredentialFile('/project/.healix/credentials.json', null), true);
});

test('isCredentialFile blocks credentials.json at root', () => {
  assert.equal(isCredentialFile('/credentials.json', 'credentials.json'), true);
});

// credentials-* pattern
test('isCredentialFile blocks credentials-admin by fileName', () => {
  assert.equal(isCredentialFile(null, 'credentials-admin'), true);
});

test('isCredentialFile blocks credentials-role-user.json by fileName', () => {
  assert.equal(isCredentialFile(null, 'credentials-role-user.json'), true);
});

test('isCredentialFile blocks credentials-anything by fullPath', () => {
  assert.equal(isCredentialFile('/project/.healix/credentials-something', null), true);
});

// Edge cases
test('isCredentialFile returns false when both filePath and fileName are null', () => {
  assert.equal(isCredentialFile(null, null), false);
});

test('isCredentialFile returns false when both args are undefined', () => {
  assert.equal(isCredentialFile(undefined, undefined), false);
});

test('isCredentialFile returns false for a file named auth-state (no extension, no suffix)', () => {
  // "auth-state" alone doesn't match "auth-state-*.json" pattern
  assert.equal(isCredentialFile(null, 'auth-state'), false);
});

test('isCredentialFile blocks when only fileName matches (fullPath is a legit path)', () => {
  assert.equal(isCredentialFile('/project/test-results/output.zip', 'auth-state-user.json'), true);
});

test('isCredentialFile blocks when only fullPath matches (fileName is a legit name)', () => {
  assert.equal(isCredentialFile('/project/.healix/auth-state-user.json', 'output.zip'), true);
});

test('isCredentialFile returns false for a file that only partially resembles credentials', () => {
  // "my-auth-state-info.txt" shouldn't match — no `.json` extension for auth-state pattern
  // but credentials- pattern would need prefix, so let's test something safe
  assert.equal(isCredentialFile(null, 'authstate.json'), false);
  assert.equal(isCredentialFile(null, 'my-credentials.json'), false); // no match — "my-credentials" not ^credentials
});

test('isCredentialFile handles empty string path gracefully', () => {
  assert.equal(isCredentialFile('', ''), false);
});
