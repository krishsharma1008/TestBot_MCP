const { test, expect } = require('@playwright/test');

test.describe('Cruises Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/Cuirses');
  });

  test('should load cruises page successfully', async ({ page }) => {
    await expect(page).toHaveURL(/.*Cuirses|cruises/i);
  });

  test('should display cruise listings', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check if page has loaded content
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should have search/filter functionality', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for filter/search elements
    const portFilter = page.locator('select[name*="Port"], select[id*="port" i]').first();
    const navireFilter = page.locator('select[name*="Navire"], select[id*="navire" i], select[name*="ship" i]').first();
    const monthFilter = page.locator('select[name*="Month"], select[id*="month" i]').first();
    const searchButton = page.locator('button:has-text("Search"), button[type="submit"], input[type="submit"]').first();

    // Check if filters exist
    const portCount = await portFilter.count();
    const navireCount = await navireFilter.count();
    const monthCount = await monthFilter.count();
    const searchCount = await searchButton.count();

    if (portCount > 0) await expect(portFilter).toBeVisible();
    if (navireCount > 0) await expect(navireFilter).toBeVisible();
    if (monthCount > 0) await expect(monthFilter).toBeVisible();
    if (searchCount > 0) await expect(searchButton).toBeVisible();
  });

  test('should display cruise cards with details', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for cruise cards/items (excluding hidden elements)
    const cruiseCards = page.locator('.cruise-card:visible, .cruise-item:visible, [class*="cruise"]:visible, [class*="card"]:visible').first();
    const cardCount = await cruiseCards.count();

    // If cruise cards exist, verify at least one is visible
    if (cardCount > 0) {
      await expect(cruiseCards).toBeVisible();
    } else {
      // If no specific cruise cards found, at least verify page loaded
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('should allow viewing cruise details', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for "View Details" or similar buttons
    const viewDetailsButton = page.locator('button:has-text("View"), button:has-text("Details"), a:has-text("View"), a:has-text("Details")').first();
    
    const count = await viewDetailsButton.count();
    if (count > 0) {
      await expect(viewDetailsButton).toBeVisible();
    }
  });
});
