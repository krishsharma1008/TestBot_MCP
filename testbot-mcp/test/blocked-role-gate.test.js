const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { gateBlockedRoleSpecs } = require('../src/pipeline-worker');

function makeProject(specContent) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'healix-rolegate-'));
  const generatedDir = path.join(dir, 'tests', 'generated');
  fs.mkdirSync(generatedDir, { recursive: true });
  fs.writeFileSync(path.join(generatedDir, 'rbac.spec.ts'), specContent, 'utf8');
  return { dir, generatedDir, specPath: path.join(generatedDir, 'rbac.spec.ts') };
}

// RC2 regression: run 1780925226135-3xfian. Admin pre-auth failed, no
// auth-state-admin.json, yet 10 admin-dashboard tests still executed against the
// user session and failed red. They should be gated to skip (blocked), not run.
test('admin test for an unverified role is converted to test.skip', () => {
  const spec = `import { test, expect } from '@playwright/test';

test('admin can open the admin dashboard', async ({ page }) => {
  await page.goto('/admindashboard');
  await expect(page).toHaveURL(/\\/admindashboard/);
});

test('user can open the user dashboard', async ({ page }) => {
  await page.goto('/userdashboard');
  await expect(page).toHaveURL(/\\/userdashboard/);
});
`;
  const { dir, specPath } = makeProject(spec);
  try {
    const result = gateBlockedRoleSpecs({
      projectPath: dir,
      routeAccessSummary: {
        protectedRoutesDetail: [
          { path: '/admindashboard', requiredRole: 'admin' },
          { path: '/userdashboard', requiredRole: 'user' },
        ],
      },
      roles: [
        { role: 'user', loginVerified: true, storageStatePath: '/tmp/user.json' },
        // admin is NOT verified — no storageStatePath
        { role: 'admin', loginVerified: false },
      ],
    });

    assert.equal(result.applied, true);
    assert.equal(result.gatedBlocks, 1);
    assert.deepEqual(result.blockedRoles, ['admin']);

    const rewritten = fs.readFileSync(specPath, 'utf8');
    // The admin block is gated...
    assert.match(rewritten, /\[HEALIX:BLOCKED_ROLE\]/);
    assert.match(rewritten, /test\.skip\('admin can open the admin dashboard'/);
    // ...while the verified-user block runs untouched.
    assert.match(rewritten, /\btest\('user can open the user dashboard'/);
    assert.doesNotMatch(rewritten, /test\.skip\('user can open/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('helper-navigation admin test is gated via its @role:admin tag when admin is unverified', () => {
  // The goto lives in an imported helper, so the inline-goto scan can't see it.
  // applyRoleScopedAuthTags has already written @role:admin, so the gate keys off
  // the tag instead.
  const spec = `import { test, expect } from './__healix-fixture';
import { openAdminDashboard } from './role-actions';

test('View roles from the admin dashboard @smoke @ui @auth @role:admin', async ({ page }) => {
  await openAdminDashboard(page);
  await expect(page.getByRole('tab', { name: 'Role Management' })).toBeVisible();
});
`;
  const { dir, specPath } = makeProject(spec);
  try {
    const result = gateBlockedRoleSpecs({
      projectPath: dir,
      routeAccessSummary: {
        protectedRoutesDetail: [{ path: '/admindashboard', requiredRole: 'admin' }],
      },
      roles: [{ role: 'user', loginVerified: true, storageStatePath: '/tmp/user.json' }],
    });
    assert.equal(result.applied, true);
    assert.equal(result.gatedBlocks, 1);
    const out = fs.readFileSync(specPath, 'utf8');
    assert.match(out, /test\.skip\('View roles from the admin dashboard/);
    assert.match(out, /\[HEALIX:BLOCKED_ROLE\] requires "admin"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('no gating when the required role IS verified', () => {
  const spec = `import { test, expect } from '@playwright/test';

test('admin opens dashboard', async ({ page }) => {
  await page.goto('/admindashboard');
  await expect(page).toHaveURL(/\\/admindashboard/);
});
`;
  const { dir, specPath } = makeProject(spec);
  try {
    const result = gateBlockedRoleSpecs({
      projectPath: dir,
      routeAccessSummary: {
        protectedRoutesDetail: [{ path: '/admindashboard', requiredRole: 'admin' }],
      },
      roles: [{ role: 'admin', loginVerified: true, storageStatePath: '/tmp/admin.json' }],
    });
    assert.equal(result.applied, false);
    assert.equal(fs.readFileSync(specPath, 'utf8'), spec);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('protected route without a requiredRole is not gated (generic auth)', () => {
  const spec = `import { test, expect } from '@playwright/test';

test('dashboard loads', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\\/dashboard/);
});
`;
  const { dir, specPath } = makeProject(spec);
  try {
    const result = gateBlockedRoleSpecs({
      projectPath: dir,
      routeAccessSummary: {
        protectedRoutesDetail: [{ path: '/dashboard', requiredRole: null }],
      },
      roles: [],
    });
    assert.equal(result.applied, false);
    assert.equal(fs.readFileSync(specPath, 'utf8'), spec);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('blocked-role route that is only visited (no destination assertion) is left alone', () => {
  // A test that merely navigates but does not assert arriving at the protected
  // route may be a negative/redirect test — do not gate it.
  const spec = `import { test, expect } from '@playwright/test';

test('unauthenticated visit to admin redirects to login', async ({ page }) => {
  await page.goto('/admindashboard');
  await expect(page).toHaveURL(/\\/login/);
});
`;
  const { dir, specPath } = makeProject(spec);
  try {
    const result = gateBlockedRoleSpecs({
      projectPath: dir,
      routeAccessSummary: {
        protectedRoutesDetail: [{ path: '/admindashboard', requiredRole: 'admin' }],
      },
      roles: [{ role: 'user', loginVerified: true, storageStatePath: '/tmp/user.json' }],
    });
    assert.equal(result.applied, false);
    assert.equal(fs.readFileSync(specPath, 'utf8'), spec);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
