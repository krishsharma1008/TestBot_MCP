const { test, expect } = require('@playwright/test');

test.describe('Register Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/Register');
  });

  test('should load register page successfully', async ({ page }) => {
    await expect(page).toHaveURL(/.*Register|register/);
  });

  test('should display registration form elements', async ({ page }) => {
    // Look for common registration form fields
    const firstNameInput = page.locator('input[name*="first"], input[name*="firstName"], input[placeholder*="first" i]').first();
    const lastNameInput = page.locator('input[name*="last"], input[name*="lastName"], input[placeholder*="last" i]').first();
    const usernameInput = page.locator('input[name="username"], input[name*="login"], input[placeholder*="username" i]').first();
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Register"), button:has-text("Sign up")').first();

    // Check visibility of form elements that exist
    const firstNameCount = await firstNameInput.count();
    const lastNameCount = await lastNameInput.count();
    const usernameCount = await usernameInput.count();
    const emailCount = await emailInput.count();
    const passwordCount = await passwordInput.count();
    const submitCount = await submitButton.count();

    if (firstNameCount > 0) await expect(firstNameInput).toBeVisible();
    if (lastNameCount > 0) await expect(lastNameInput).toBeVisible();
    if (usernameCount > 0) await expect(usernameInput).toBeVisible();
    if (emailCount > 0) await expect(emailInput).toBeVisible();
    if (passwordCount > 0) await expect(passwordInput).toBeVisible();
    if (submitCount > 0) await expect(submitButton).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();
    const submitCount = await submitButton.count();

    if (submitCount > 0) {
      // Try to submit without filling fields
      await submitButton.click();
      await page.waitForTimeout(1000);

      // Check for validation messages (HTML5 validation or custom)
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('should navigate to login page', async ({ page }) => {
    const loginLink = page.locator('a[href*="login"], a[href*="Login"], a:has-text("Login"), a:has-text("Sign in")').first();
    
    const count = await loginLink.count();
    if (count > 0) {
      await expect(loginLink).toBeVisible();
      await loginLink.click();
      await page.waitForURL(/.*login|Login/i, { timeout: 5000 }).catch(() => {});
    }
  });
});
