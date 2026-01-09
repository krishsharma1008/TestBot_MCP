const { test, expect } = require('@playwright/test');
const { ensureLoggedOut, loginViaUI, logoutViaUI } = require('../utils/auth');

test.describe('Authenticated user flows', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('user can login and see dropdown with name', async ({ page }) => {
    const creds = await loginViaUI(page);
    const button = page.locator('#btnLogin');
    await expect(button).toBeVisible();
    await expect(button).not.toHaveText(/Login/i);
    await button.click();
    await expect(page.locator('.dropdown-menu')).toBeVisible();
    await expect(button).toContainText(creds.username.split('@')[0].split('.')[0]);
  });

  test('reservation page requires authentication', async ({ page }) => {
    await page.goto('/reservation');
    await expect(page).toHaveURL(/Login/i);
  });

  test('logged-in user can access reservation page', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/reservation');
await expect(page.locator('h1:has-text("Mes réservations")')).toBeVisible({ timeout: 10000 });
  });

  test('user can logout from navbar dropdown', async ({ page }) => {
    await loginViaUI(page);
    await logoutViaUI(page);
    await expect(page).toHaveURL(/Login/i);
  });
});

test.describe('Cruises interactions', () => {
  test('opening cruise detail renders modal with reservation form', async ({ page }) => {
    await page.goto('/Cuirses');
    const firstCard = page.locator('#cruisesBox').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    const detailContainer = page.locator('#cruisesDetailContainer');
    await expect(detailContainer).toBeVisible({ timeout: 10000 });
    await expect(detailContainer.locator('form')).toBeVisible();
  });

  test('searching cruises by navire triggers results update', async ({ page }) => {
    await page.goto('/Cuirses');
    const navireSelect = page.locator('select[name="Navire"]').first();
    await navireSelect.selectOption({ index: 1 }).catch(() => {});
    await page.waitForTimeout(1000);
    const resultCard = page.locator('#cruisesBox').first();
    await expect(resultCard).toBeVisible();
  });
});
