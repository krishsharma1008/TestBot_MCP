/**
 * Bug Fix #3 — Hallucinated test guard (feature-existence rule)
 *
 * Verifies the feature-keyword extractor that the openai-generator uses
 * to reject generated tests referencing UI features not present in
 * the discovered sourceContext (e.g. "Empty Cart State" for a dashboard
 * app with no cart).
 *
 * The full validator lives in openai-generator.ts (TypeScript / webapp).
 * These tests verify the plain-JS equivalent of the keyword-detection
 * logic so the MCP test suite can cover it without a TS build step.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// ── Replicate the exact logic from openai-generator.ts ──────────────────────

const FEATURE_KEYWORDS = [
  'cart', 'checkout', 'basket', 'wishlist', 'shopping bag',
  'order history', 'order summary', 'empty cart', 'add to cart',
  'payment', 'coupon', 'promo code', 'loyalty', 'reward',
];

/**
 * Returns an array of violation messages for any test title that references a
 * FEATURE_KEYWORD absent from the project's known text (routes + source files
 * + assertable text).
 */
function checkFeatureHallucinations(generatedContent, sourceContext) {
  if (!sourceContext) return [];

  const knownText = [
    ...(sourceContext.routePaths || []),
    ...(sourceContext.files || []).map(f => f.file),
    ...(sourceContext.assertableText || []),
  ].join(' ').toLowerCase();

  // For compound keywords (e.g. "empty cart"), the feature is considered
  // grounded if ANY meaningful component word (>3 chars) appears in knownText.
  // This prevents false positives like "empty cart" firing on an e-commerce
  // app that has /cart in its routes — "cart" is a sufficient signal.
  function isKeywordGrounded(kw) {
    if (knownText.includes(kw)) return true;
    const words = kw.split(' ').filter(w => w.length > 3);
    return words.length > 0 && words.some(w => knownText.includes(w));
  }

  const errors = [];
  const titlePattern = /(?:test(?:\.describe)?\s*\(\s*['"`])([^'"`]{6,120})/g;
  let m;
  while ((m = titlePattern.exec(generatedContent)) !== null) {
    const title = m[1].toLowerCase();
    for (const kw of FEATURE_KEYWORDS) {
      if (title.includes(kw) && !isKeywordGrounded(kw)) {
        errors.push(
          `Test title "${m[1]}" references feature "${kw}" which is not present in any ` +
          `discovered route, source file, or observed element. ` +
          `Remove this test or replace it with a feature that exists in OBSERVED_FLOWS/sourceContext.`,
        );
        break;
      }
    }
  }
  return errors;
}

// ─── sourceContext fixtures ───────────────────────────────────────────────────

const DASHBOARD_SOURCE_CONTEXT = {
  routePaths: ['/dashboard', '/dashboard/settings', '/dashboard/analytics', '/login'],
  files: [
    { file: 'src/app/dashboard/page.tsx' },
    { file: 'src/app/dashboard/settings/page.tsx' },
    { file: 'src/app/login/page.tsx' },
  ],
  assertableText: ['Analytics', 'Settings', 'Welcome back', 'Sign in'],
};

const ECOMMERCE_SOURCE_CONTEXT = {
  routePaths: ['/products', '/cart', '/checkout', '/wishlist'],
  files: [
    { file: 'src/pages/cart.tsx' },
    { file: 'src/pages/checkout.tsx' },
  ],
  assertableText: ['Add to cart', 'Checkout', 'Your cart'],
};

// ─── tests ───────────────────────────────────────────────────────────────────

test('hallucination-guard: flags "Empty Cart State" test for a dashboard app (no cart)', () => {
  const generated = `
    test('Empty Cart State displays correct message', async ({ page }) => {
      await page.goto('/cart');
      await expect(page.getByText('Your cart is empty')).toBeVisible();
    });
  `;

  const errors = checkFeatureHallucinations(generated, DASHBOARD_SOURCE_CONTEXT);

  assert.ok(errors.length > 0, 'should flag the cart test on a dashboard app');
  assert.match(errors[0], /cart/, 'error should mention "cart"');
  assert.match(errors[0], /not present in any discovered route/, 'error should explain why');
});

test('hallucination-guard: flags checkout test for a dashboard app', () => {
  const generated = `
    test.describe('Checkout flow', () => {
      test('user can complete checkout', async ({ page }) => {
        await page.goto('/checkout');
      });
    });
  `;

  const errors = checkFeatureHallucinations(generated, DASHBOARD_SOURCE_CONTEXT);
  assert.ok(errors.length > 0, 'should flag checkout on a dashboard app with no checkout route');
});

test('hallucination-guard: does NOT flag cart tests on a real e-commerce app', () => {
  const generated = `
    test('Empty Cart State shows placeholder', async ({ page }) => {
      await page.goto('/cart');
      await expect(page.getByText('Your cart is empty')).toBeVisible();
    });
    test('Add to cart updates item count', async ({ page }) => {
      await page.goto('/products');
      await page.getByRole('button', { name: 'Add to cart' }).first().click();
    });
  `;

  const errors = checkFeatureHallucinations(generated, ECOMMERCE_SOURCE_CONTEXT);
  assert.equal(errors.length, 0, 'should NOT flag cart tests when the app actually has a cart');
});

test('hallucination-guard: does NOT flag non-feature-keyword tests (e.g. login, settings)', () => {
  const generated = `
    test('Login form shows validation error for empty email', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('button', { name: 'Sign in' }).click();
    });
    test('Settings page renders', async ({ page }) => {
      await page.goto('/dashboard/settings');
    });
  `;

  const errors = checkFeatureHallucinations(generated, DASHBOARD_SOURCE_CONTEXT);
  assert.equal(errors.length, 0, 'login and settings tests should pass on a dashboard app');
});

test('hallucination-guard: returns no errors when sourceContext is missing (graceful)', () => {
  const generated = `
    test('Empty Cart State', async ({ page }) => { await page.goto('/cart'); });
  `;

  // No sourceContext — validator must not crash, must silently skip
  const errors = checkFeatureHallucinations(generated, null);
  assert.equal(errors.length, 0, 'should skip check gracefully when no sourceContext');
});

test('hallucination-guard: flags wishlist test on a plain blog app', () => {
  const blogSourceContext = {
    routePaths: ['/posts', '/about', '/contact'],
    files: [{ file: 'src/pages/posts/index.tsx' }, { file: 'src/pages/about.tsx' }],
    assertableText: ['Latest posts', 'About us'],
  };

  const generated = `
    test('Wishlist saves items across sessions', async ({ page }) => {
      await page.goto('/wishlist');
    });
  `;

  const errors = checkFeatureHallucinations(generated, blogSourceContext);
  assert.ok(errors.length > 0, 'should flag wishlist test on a blog with no wishlist route');
});
