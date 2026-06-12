'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const DashboardLauncher = require('../src/dashboard-launcher');

// All tests exercise the public API — shouldOpenBrowser() — which internally
// exercises the module-private resolveBoolean(). No real HTTP/process spawning
// happens. We never open a browser; the dashboard dir won't be found.

// ---------------------------------------------------------------------------
// shouldOpenBrowser — option object controls (no env vars needed)
// ---------------------------------------------------------------------------

test('shouldOpenBrowser returns false when headless=true (explicit boolean)', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: true }), false);
});

test('shouldOpenBrowser returns false when headless=1 (numeric truthy)', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: 1 }), false);
});

test('shouldOpenBrowser returns false when headless="true" (string)', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: 'true' }), false);
});

test('shouldOpenBrowser returns false when headless="1"', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: '1' }), false);
});

test('shouldOpenBrowser returns false when headless="yes"', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: 'yes' }), false);
});

test('shouldOpenBrowser returns false when headless="on"', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: 'on' }), false);
});

test('shouldOpenBrowser headless=false and openBrowser=false → returns false', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: false, openBrowser: false }), false);
});

test('shouldOpenBrowser headless=false and openBrowser=true → returns true', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: false, openBrowser: true }), true);
});

test('shouldOpenBrowser headless=false and openBrowser="false" → returns false', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: false, openBrowser: 'false' }), false);
});

test('shouldOpenBrowser headless=false and openBrowser="0" → returns false', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: false, openBrowser: '0' }), false);
});

test('shouldOpenBrowser headless=false and openBrowser="no" → returns false', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: false, openBrowser: 'no' }), false);
});

test('shouldOpenBrowser headless=false and openBrowser="off" → returns false', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: false, openBrowser: 'off' }), false);
});

test('shouldOpenBrowser headless=false and openBrowser="yes" → returns true', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: false, openBrowser: 'yes' }), true);
});

test('shouldOpenBrowser headless=false and openBrowser="on" → returns true', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: false, openBrowser: 'on' }), true);
});

test('shouldOpenBrowser headless=false and openBrowser="1" → returns true', () => {
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: false, openBrowser: '1' }), true);
});

test('shouldOpenBrowser headless=0 (falsy number) → proceeds to openBrowser check', () => {
  // resolveBoolean(0, fallback) → false, so headless=false → check openBrowser
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: 0, openBrowser: true }), true);
  assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: 0, openBrowser: false }), false);
});

// ---------------------------------------------------------------------------
// shouldOpenBrowser — env var fallbacks (HEALIX_HEADLESS and HEALIX_AUTO_OPEN_BROWSER)
// ---------------------------------------------------------------------------

test('shouldOpenBrowser reads HEALIX_HEADLESS=false from env', () => {
  const prevHeadless = process.env.HEALIX_HEADLESS;
  const prevOpen = process.env.HEALIX_AUTO_OPEN_BROWSER;
  try {
    process.env.HEALIX_HEADLESS = 'false';
    process.env.HEALIX_AUTO_OPEN_BROWSER = 'true';
    assert.equal(DashboardLauncher.shouldOpenBrowser({}), true);
  } finally {
    if (prevHeadless === undefined) delete process.env.HEALIX_HEADLESS;
    else process.env.HEALIX_HEADLESS = prevHeadless;
    if (prevOpen === undefined) delete process.env.HEALIX_AUTO_OPEN_BROWSER;
    else process.env.HEALIX_AUTO_OPEN_BROWSER = prevOpen;
  }
});

test('shouldOpenBrowser returns false when HEALIX_HEADLESS=true and no options override', () => {
  const prev = process.env.HEALIX_HEADLESS;
  try {
    process.env.HEALIX_HEADLESS = 'true';
    assert.equal(DashboardLauncher.shouldOpenBrowser({}), false);
  } finally {
    if (prev === undefined) delete process.env.HEALIX_HEADLESS;
    else process.env.HEALIX_HEADLESS = prev;
  }
});

test('shouldOpenBrowser option.headless overrides HEALIX_HEADLESS env var', () => {
  const prev = process.env.HEALIX_HEADLESS;
  try {
    process.env.HEALIX_HEADLESS = 'false'; // env says not headless
    // but explicit option says headless=true → should return false
    assert.equal(DashboardLauncher.shouldOpenBrowser({ headless: true }), false);
  } finally {
    if (prev === undefined) delete process.env.HEALIX_HEADLESS;
    else process.env.HEALIX_HEADLESS = prev;
  }
});

test('shouldOpenBrowser HEALIX_AUTO_OPEN_BROWSER=false when headless=false → returns false', () => {
  const prevHeadless = process.env.HEALIX_HEADLESS;
  const prevOpen = process.env.HEALIX_AUTO_OPEN_BROWSER;
  try {
    process.env.HEALIX_HEADLESS = 'false';
    process.env.HEALIX_AUTO_OPEN_BROWSER = 'false';
    assert.equal(DashboardLauncher.shouldOpenBrowser({}), false);
  } finally {
    if (prevHeadless === undefined) delete process.env.HEALIX_HEADLESS;
    else process.env.HEALIX_HEADLESS = prevHeadless;
    if (prevOpen === undefined) delete process.env.HEALIX_AUTO_OPEN_BROWSER;
    else process.env.HEALIX_AUTO_OPEN_BROWSER = prevOpen;
  }
});

// ---------------------------------------------------------------------------
// shouldOpenBrowser — default behavior (no options, no env vars)
// ---------------------------------------------------------------------------

test('shouldOpenBrowser defaults to headless=true (returns false) when env vars unset', () => {
  const prevHeadless = process.env.HEALIX_HEADLESS;
  const prevOpen = process.env.HEALIX_AUTO_OPEN_BROWSER;
  delete process.env.HEALIX_HEADLESS;
  delete process.env.HEALIX_AUTO_OPEN_BROWSER;
  try {
    // Default: headless=true fallback, so shouldOpenBrowser → false
    assert.equal(DashboardLauncher.shouldOpenBrowser({}), false);
  } finally {
    if (prevHeadless !== undefined) process.env.HEALIX_HEADLESS = prevHeadless;
    if (prevOpen !== undefined) process.env.HEALIX_AUTO_OPEN_BROWSER = prevOpen;
  }
});

test('shouldOpenBrowser returns false when called with no arguments', () => {
  const prevHeadless = process.env.HEALIX_HEADLESS;
  const prevOpen = process.env.HEALIX_AUTO_OPEN_BROWSER;
  delete process.env.HEALIX_HEADLESS;
  delete process.env.HEALIX_AUTO_OPEN_BROWSER;
  try {
    assert.equal(DashboardLauncher.shouldOpenBrowser(), false);
  } finally {
    if (prevHeadless !== undefined) process.env.HEALIX_HEADLESS = prevHeadless;
    if (prevOpen !== undefined) process.env.HEALIX_AUTO_OPEN_BROWSER = prevOpen;
  }
});

// ---------------------------------------------------------------------------
// open() — dashboard dir not found path (returns reportPath)
// ---------------------------------------------------------------------------

test('open() returns reportPath string when dashboard dir is not found', async () => {
  // No dashboard dir exists under test environment — triggers the "not found" path
  // which returns reportPath. We pass a fake report path (doesn't need to exist
  // because the dashboardDir check short-circuits before reading the report).
  const fakePath = '/nonexistent/report.json';
  const result = await DashboardLauncher.open(fakePath, { headless: true });
  assert.equal(result, fakePath);
});
