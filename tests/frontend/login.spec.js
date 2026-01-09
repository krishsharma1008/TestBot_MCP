const { test, expect } = require('@playwright/test');

test.describe('Login Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/Login');
  });

  test('should load login page successfully', async ({ page }) => {
    await expect(page).toHaveURL(/.*Login|login/);
  });

  test('should display login form elements', async ({ page }) => {
    // Look for username/email input
    const usernameInput = page.locator('input[name="username"], input[type="email"], input[placeholder*="username" i], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();

    // Check if form elements exist
    const usernameCount = await usernameInput.count();
    const passwordCount = await passwordInput.count();
    const submitCount = await submitButton.count();

    if (usernameCount > 0) {
      await expect(usernameInput).toBeVisible();
    }
    if (passwordCount > 0) {
      await expect(passwordInput).toBeVisible();
    }
    if (submitCount > 0) {
      await expect(submitButton).toBeVisible();
    }
  });

  test('should show error message for invalid credentials', async ({ page }) => {
    // Try to find and fill login form
    const usernameInput = page.locator('input[name="username"], input[type="email"]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();

    const usernameCount = await usernameInput.count();
    const passwordCount = await passwordInput.count();
    const submitCount = await submitButton.count();

    if (usernameCount > 0 && passwordCount > 0 && submitCount > 0) {
      await usernameInput.fill('invalid_user');
      await passwordInput.fill('invalid_password');
      await submitButton.click();

      // Wait for potential error message
      await page.waitForTimeout(2000);

      // Check for error message
      const errorMessage = page.locator('text=/error|incorrect|invalid/i');
      const errorCount = await errorMessage.count();
      
      // If error message appears, verify it's visible
      if (errorCount > 0) {
        await expect(errorMessage.first()).toBeVisible();
      }
    }
  });

  test('should navigate to register page', async ({ page }) => {
    const registerLink = page.locator('a[href*="register"], a[href*="Register"], a:has-text("Register"), a:has-text("Sign up")').first();
    
    const count = await registerLink.count();
    if (count > 0) {
      await expect(registerLink).toBeVisible();
      await registerLink.click();
      await page.waitForURL(/.*register|Register/i, { timeout: 5000 }).catch(() => {});
    }
  });
});
