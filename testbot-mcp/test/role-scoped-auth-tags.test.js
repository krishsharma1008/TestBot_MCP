const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { applyRoleScopedAuthTags, tierBGrepSource } = require('../src/pipeline-worker');

function makeProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'healix-roletag-'));
  const generatedDir = path.join(dir, 'tests', 'generated');
  fs.mkdirSync(generatedDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(generatedDir, name), content, 'utf8');
  }
  return { dir, generatedDir };
}

const RBAC_SUMMARY = {
  protectedRoutesDetail: [
    { path: '/admindashboard', requiredRole: 'admin' },
    { path: '/userdashboard', requiredRole: 'user' },
  ],
};
const ROLES = [
  { role: 'admin', loginVerified: true, storageStatePath: '/tmp/admin.json' },
  { role: 'user', loginVerified: true, storageStatePath: '/tmp/user.json' },
];

// ── tierBGrepSource ─────────────────────────────────────────────────────────
test('tierBGrepSource: non-primary role greps only its own @role tag', () => {
  assert.equal(tierBGrepSource('user', 'admin'), '/@role:user(?![A-Za-z0-9_-])/');
});

test('tierBGrepSource: primary role also greps @role:any + legacy @auth/@tierB', () => {
  assert.equal(
    tierBGrepSource('admin', 'admin'),
    '/@role:admin(?![A-Za-z0-9_-])|@role:any(?![A-Za-z0-9_-])|@auth\\b|@tierB\\b/',
  );
});

test('tierBGrepSource: regex matches exact role and not a prefix', () => {
  const re = new RegExp(tierBGrepSource('admin', 'admin').slice(1, -1));
  assert.ok(re.test('Foo @role:admin @smoke'));
  assert.ok(re.test('Foo @role:any'));
  assert.ok(!re.test('Foo @role:administrator')); // boundary: must not match prefix
  const userRe = new RegExp(tierBGrepSource('user', 'admin').slice(1, -1));
  assert.ok(userRe.test('Bar @role:user'));
  assert.ok(!userRe.test('Bar @role:admin')); // user project ignores admin tests
});

// ── applyRoleScopedAuthTags ─────────────────────────────────────────────────
test('admin-route test (goto in imported helper) gets @auth @role:admin', () => {
  const helper = `import { expect } from './__healix-fixture';
export async function openAdminDashboard(page) {
  await page.goto('/admindashboard');
  await expect(page).toHaveURL(/\\/admindashboard/);
}`;
  const spec = `import { test, expect } from './__healix-fixture';
import { openAdminDashboard } from './role-actions';

test('[REQ:F2.S1.AC1] View roles from the admin dashboard @smoke @ui', async ({ page }) => {
  await openAdminDashboard(page);
  await expect(page.getByRole('tab', { name: 'Role Management' })).toBeVisible();
});
`;
  const { dir, generatedDir } = makeProject({ 'role-actions.ts': helper, 'role-management-ui.spec.ts': spec });
  try {
    const res = applyRoleScopedAuthTags({ projectPath: dir, routeAccessSummary: RBAC_SUMMARY, roles: ROLES });
    assert.equal(res.applied, true);
    assert.equal(res.taggedBlocks, 1);
    const out = fs.readFileSync(path.join(generatedDir, 'role-management-ui.spec.ts'), 'utf8');
    assert.match(out, /@auth @role:admin/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('user-route test gets @role:user even when title already had a stray @role:admin', () => {
  const spec = `import { test, expect } from './__healix-fixture';

test('user can open the user dashboard @auth @role:admin @ui', async ({ page }) => {
  await page.goto('/userdashboard');
  await expect(page).toHaveURL(/\\/userdashboard/);
});
`;
  const { dir, generatedDir } = makeProject({ 'user-ui.spec.ts': spec });
  try {
    applyRoleScopedAuthTags({ projectPath: dir, routeAccessSummary: RBAC_SUMMARY, roles: ROLES });
    const out = fs.readFileSync(path.join(generatedDir, 'user-ui.spec.ts'), 'utf8');
    assert.match(out, /@role:user/);
    assert.doesNotMatch(out, /@role:admin/); // stray wrong-role tag removed
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('login/self-auth test is stripped of @auth so it runs unauthenticated', () => {
  const spec = `import { test, expect } from './__healix-fixture';

test('login form allows credential submission @auth @ui', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill('a@b.com');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/dashboard/);
});
`;
  const { dir, generatedDir } = makeProject({ 'auth-ui.spec.ts': spec });
  try {
    const res = applyRoleScopedAuthTags({ projectPath: dir, routeAccessSummary: RBAC_SUMMARY, roles: ROLES });
    assert.equal(res.applied, true);
    const out = fs.readFileSync(path.join(generatedDir, 'auth-ui.spec.ts'), 'utf8');
    assert.doesNotMatch(out, /@auth/);
    assert.doesNotMatch(out, /@role:/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('authenticated change-password test is NOT mistaken for a login test', () => {
  // Fills a password but the button says "Update Password" and it lives on a
  // protected route — must keep @auth @role:admin, not be stripped to run public.
  const spec = `import { test, expect } from './__healix-fixture';

test('admin updates their password @ui', async ({ page }) => {
  await page.goto('/admindashboard');
  await page.getByLabel('New Password').fill('newpass123');
  await page.getByRole('button', { name: 'Update Password' }).click();
  await expect(page.getByText('Password updated')).toBeVisible();
});
`;
  const { dir, generatedDir } = makeProject({ 'settings.spec.ts': spec });
  try {
    applyRoleScopedAuthTags({ projectPath: dir, routeAccessSummary: RBAC_SUMMARY, roles: ROLES });
    const out = fs.readFileSync(path.join(generatedDir, 'settings.spec.ts'), 'utf8');
    assert.match(out, /@auth @role:admin/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('protected route without a requiredRole gets @role:any', () => {
  const spec = `import { test, expect } from './__healix-fixture';

test('dashboard shell loads @ui', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading')).toBeVisible();
});
`;
  const { dir, generatedDir } = makeProject({ 'dash.spec.ts': spec });
  try {
    applyRoleScopedAuthTags({
      projectPath: dir,
      routeAccessSummary: { protectedRoutesDetail: [{ path: '/dashboard', requiredRole: null }] },
      roles: ROLES,
    });
    const out = fs.readFileSync(path.join(generatedDir, 'dash.spec.ts'), 'utf8');
    assert.match(out, /@auth @role:any/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('public test touching no protected route is left untouched', () => {
  const spec = `import { test, expect } from './__healix-fixture';

test('home page renders @ui', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
});
`;
  const { dir, generatedDir } = makeProject({ 'public.spec.ts': spec });
  try {
    const res = applyRoleScopedAuthTags({ projectPath: dir, routeAccessSummary: RBAC_SUMMARY, roles: ROLES });
    const out = fs.readFileSync(path.join(generatedDir, 'public.spec.ts'), 'utf8');
    assert.equal(out, spec);
    assert.equal(res.taggedBlocks, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('idempotent: re-running makes no further changes', () => {
  const helper = `export async function openAdminDashboard(page) { await page.goto('/admindashboard'); }`;
  const spec = `import { test, expect } from './__healix-fixture';
import { openAdminDashboard } from './role-actions';
test('View roles @smoke @ui', async ({ page }) => { await openAdminDashboard(page); });
`;
  const { dir, generatedDir } = makeProject({ 'role-actions.ts': helper, 's.spec.ts': spec });
  try {
    applyRoleScopedAuthTags({ projectPath: dir, routeAccessSummary: RBAC_SUMMARY, roles: ROLES });
    const first = fs.readFileSync(path.join(generatedDir, 's.spec.ts'), 'utf8');
    const res2 = applyRoleScopedAuthTags({ projectPath: dir, routeAccessSummary: RBAC_SUMMARY, roles: ROLES });
    const second = fs.readFileSync(path.join(generatedDir, 's.spec.ts'), 'utf8');
    assert.equal(first, second);
    assert.equal(res2.taggedBlocks, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
