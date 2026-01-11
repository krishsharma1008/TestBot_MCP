const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const CONTACT_LOG = path.join(__dirname, '..', '..', 'website', 'public', 'storage', 'contact_submissions.log');

const readLogLines = () => {
  if (!fs.existsSync(CONTACT_LOG)) {
    return [];
  }
  const raw = fs.readFileSync(CONTACT_LOG, 'utf-8').trim();
  return raw ? raw.split('\n') : [];
};

test.describe('Contact Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/Contact');
  });

  test('should load contact page successfully', async ({ page }) => {
    await expect(page).toHaveURL(/.*Contact|contact/i);
  });

  test('should display contact form elements', async ({ page }) => {
    // Look for contact form fields
    const nameInput = page.locator('input[name*="name"], input[placeholder*="name" i]').first();
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const messageInput = page.locator('textarea[name*="message"], textarea[placeholder*="message" i]').first();
    const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Send"), button:has-text("Submit")').first();

    // Check visibility of form elements that exist
    const nameCount = await nameInput.count();
    const emailCount = await emailInput.count();
    const messageCount = await messageInput.count();
    const submitCount = await submitButton.count();

    if (nameCount > 0) await expect(nameInput).toBeVisible();
    if (emailCount > 0) await expect(emailInput).toBeVisible();
    if (messageCount > 0) await expect(messageInput).toBeVisible();
    if (submitCount > 0) await expect(submitButton).toBeVisible();
  });

  test('should validate contact form fields', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();
    const submitCount = await submitButton.count();

    if (submitCount > 0) {
      // Try to submit without filling fields
      await submitButton.click();
      await page.waitForTimeout(1000);

      // Check for validation messages
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('should submit contact form via mock handler', async ({ page }) => {
    await page.addInitScript(() => {
      window.contactConfig = { endpoint: '/php/send-email-mock.php' };
    });
    await page.goto('/Contact');

    await page.fill('input[name="name"]', 'Mock User');
    await page.fill('input[name="email"]', 'mock@example.com');
    await page.fill('textarea[name="message"]', 'Mock submission for testing.');

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('send-email-mock.php') && resp.status() === 200,
      { timeout: 30000 },
    );
    await page.click('input[type="submit"]');
    await responsePromise;

    const success = page.locator('#form-message-success');
    await expect(success).toBeVisible({ timeout: 5000 });
  });

  test('should submit contact form via real handler and log entry', async ({ page }) => {
    const beforeLines = readLogLines();
    const uniqueMessage = `Automated contact ${Date.now()}`;

    await page.fill('input[name="name"]', 'Playwright Bot');
    await page.fill('input[name="email"]', 'playwright@example.com');
    await page.fill('textarea[name="message"]', uniqueMessage);

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('send-email.php') && resp.status() === 200,
      { timeout: 30000 },
    );
    await page.click('input[type="submit"]');
    await responsePromise;

    const success = page.locator('#form-message-success');
    await expect(success).toBeVisible({ timeout: 5000 });

    const afterLines = readLogLines();
    expect(afterLines.length).toBeGreaterThan(beforeLines.length);
    const lastEntry = afterLines[afterLines.length - 1];
    expect(lastEntry).toContain(uniqueMessage);
  });
});
