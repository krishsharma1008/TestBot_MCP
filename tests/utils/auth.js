const DEFAULT_CREDENTIALS = {
  username: process.env.PLAYWRIGHT_TEST_USER || 'shreyes.desai@zapcg.com',
  password: process.env.PLAYWRIGHT_TEST_PASS || 'TestCred!23',
};

async function ensureLoggedOut(page) {
  await page.goto('/');
  const logoutLink = page.locator('a[href*="Login/deconnect"]');
  if (await logoutLink.count()) {
    await page.locator('#btnLogin').click();
    await logoutLink.click();
    await page.waitForURL(/Login/i, { timeout: 5000 }).catch(() => {});
  }
}

async function loginViaUI(page, overrides = {}) {
  const creds = { ...DEFAULT_CREDENTIALS, ...overrides };
  await page.goto('/Login');
  await page.fill('input[name="username"]', creds.username);
  await page.fill('input[name="password"]', creds.password);
  await Promise.all([
    page.waitForURL(/(Home|reservation)/i),
    page.click('button[type="submit"]'),
  ]);
  return creds;
}

async function logoutViaUI(page) {
  await page.goto('/');
  const dropdown = page.locator('#btnLogin');
  if (await dropdown.count() && (await dropdown.textContent()).trim() !== 'Login') {
    await dropdown.click();
    await page.click('a[href*="Login/deconnect"]');
    await page.waitForURL(/Login/i, { timeout: 5000 }).catch(() => {});
  }
}

module.exports = {
  DEFAULT_CREDENTIALS,
  ensureLoggedOut,
  loginViaUI,
  logoutViaUI,
};
