const assert = require('node:assert/strict');
const test = require('node:test');

const { mergeFailedPreAuthRoles } = require('../src/pipeline-worker');

// Run 1780939686499-wu4w1a: the admin DB record was deleted, so admin pre-auth
// failed and the role was silently dropped — the dashboard showed only `user`,
// reading as "admin never attempted". Failed roles must stay visible.
test('failed pre-auth role is appended as loginVerified:false with a reason', () => {
  const verified = [{ role: 'user', name: 'user', storageStatePath: '/tmp/user.json', loginVerified: true }];
  const failed = [{ role: 'admin', loginVerified: false, reason: 'Invalid credentials' }];

  const merged = mergeFailedPreAuthRoles(verified, failed);

  assert.equal(merged.length, 2);
  const admin = merged.find((r) => r.role === 'admin');
  assert.ok(admin, 'admin role should be surfaced');
  assert.equal(admin.loginVerified, false);
  assert.equal(admin.storageStatePath, null);
  assert.equal(admin.reason, 'Invalid credentials');

  // The verified role is untouched and still wins.
  const user = merged.find((r) => r.role === 'user');
  assert.equal(user.loginVerified, true);
  assert.equal(user.storageStatePath, '/tmp/user.json');
});

test('verified role is NOT overwritten by a same-key failed entry', () => {
  const verified = [{ role: 'admin', name: 'admin', storageStatePath: '/tmp/admin.json', loginVerified: true }];
  const failed = [{ role: 'admin', loginVerified: false, reason: 'stale' }];

  const merged = mergeFailedPreAuthRoles(verified, failed);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].loginVerified, true);
  assert.equal(merged[0].storageStatePath, '/tmp/admin.json');
});

test('role-label normalization de-dupes (Administrator == admin)', () => {
  const verified = [{ role: 'user', storageStatePath: '/tmp/user.json', loginVerified: true }];
  const failed = [{ role: 'Administrator', loginVerified: false, reason: 'x' }];

  const merged = mergeFailedPreAuthRoles(verified, failed);
  // 'Administrator' normalizes to 'admin' — appended once, not duplicated.
  assert.equal(merged.length, 2);
  assert.ok(merged.find((r) => r.role === 'admin'));
});

test('noLoginForm flag is preserved on the surfaced role', () => {
  const merged = mergeFailedPreAuthRoles(
    [],
    [{ role: 'admin', loginVerified: false, reason: 'no form', noLoginForm: true }],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].noLoginForm, true);
});

test('input array is not mutated', () => {
  const verified = [{ role: 'user', loginVerified: true, storageStatePath: '/tmp/u.json' }];
  const merged = mergeFailedPreAuthRoles(verified, [{ role: 'admin', loginVerified: false }]);
  assert.equal(verified.length, 1, 'original roles array must be untouched');
  assert.equal(merged.length, 2);
});

test('no failed roles → returns an equivalent list', () => {
  const verified = [{ role: 'user', loginVerified: true, storageStatePath: '/tmp/u.json' }];
  assert.deepEqual(mergeFailedPreAuthRoles(verified, []), verified);
  assert.deepEqual(mergeFailedPreAuthRoles(verified, undefined), verified);
});
