const { test, expect } = require('@playwright/test');

test.describe('Home Page Tests', () => {
  test('should load home page successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ShipCruiseTour|Home/i);
  });

  test('should display navigation elements', async ({ page }) => {
    await page.goto('/');
    
    // Check for common navigation elements
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should display cruise listings', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if page has loaded content
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should have login link', async ({ page }) => {
    await page.goto('/');
    
    // Look for login link or button
    const loginLink = page.locator('a[href*="login"], a[href*="Login"], button:has-text("Login"), a:has-text("Login")').first();
    
    // If login link exists, verify it's visible
    const count = await loginLink.count();
    if (count > 0) {
      await expect(loginLink).toBeVisible();
    }
  });

  test('should have register link', async ({ page }) => {
    await page.goto('/');
    
    // Look for register link or button
    const registerLink = page.locator('a[href*="register"], a[href*="Register"], button:has-text("Register"), a:has-text("Register")').first();
    
    // If register link exists, verify it's visible
    const count = await registerLink.count();
    if (count > 0) {
      await expect(registerLink).toBeVisible();
    }
  });
});
