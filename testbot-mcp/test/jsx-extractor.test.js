'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { extractElementsFromSource } = require('../src/source-extractors/jsx-extractor');

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function extract(source, filePath = '/project/src/components/Page.tsx') {
  return extractElementsFromSource(filePath, source);
}

// ---------------------------------------------------------------------------
// Basic button / link extraction
// ---------------------------------------------------------------------------

test('extracts button with text label', () => {
  const els = extract('<button>Submit</button>');
  assert.equal(els.length, 1);
  assert.equal(els[0].role, 'button');
  assert.equal(els[0].accessibleName, 'Submit');
  assert.equal(els[0].isDynamic, false);
});

test('extracts button with aria-label', () => {
  const els = extract('<button aria-label="Close dialog">×</button>');
  assert.equal(els.length, 1);
  assert.equal(els[0].role, 'button');
  assert.equal(els[0].accessibleName, 'Close dialog');
});

test('extracts anchor link', () => {
  const els = extract('<a href="/about">About</a>');
  assert.equal(els.length, 1);
  assert.equal(els[0].role, 'link');
  assert.equal(els[0].accessibleName, 'About');
  assert.equal(els[0].attributes.href, '/about');
});

test('extracts img with alt', () => {
  const els = extract('<img src="/logo.png" alt="Company Logo" />');
  assert.equal(els.length, 1);
  assert.equal(els[0].role, 'image');
  assert.equal(els[0].accessibleName, 'Company Logo');
});

// ---------------------------------------------------------------------------
// Heading extraction
// ---------------------------------------------------------------------------

test('extracts h1 as heading', () => {
  const els = extract('<h1>Welcome to App</h1>');
  const heading = els.find((e) => e.role === 'heading');
  assert.ok(heading);
  assert.equal(heading.accessibleName, 'Welcome to App');
  assert.equal(heading.attributes.level, 1);
});

test('extracts h2-h6 with correct levels', () => {
  const els = extract('<h2>Section</h2><h3>Sub</h3><h4>Sub-sub</h4>');
  const h2 = els.find((e) => e.attributes.level === 2);
  const h3 = els.find((e) => e.attributes.level === 3);
  const h4 = els.find((e) => e.attributes.level === 4);
  assert.ok(h2 && h2.accessibleName === 'Section');
  assert.ok(h3 && h3.accessibleName === 'Sub');
  assert.ok(h4 && h4.accessibleName === 'Sub-sub');
});

// ---------------------------------------------------------------------------
// Input extraction
// ---------------------------------------------------------------------------

test('extracts text input via placeholder', () => {
  const els = extract('<input type="text" placeholder="Enter your email" />');
  const input = els.find((e) => e.role === 'textbox');
  assert.ok(input);
  assert.equal(input.accessibleName, 'Enter your email');
  assert.equal(input.attributes.type, 'text');
});

test('extracts password input as textbox', () => {
  const els = extract('<input type="password" placeholder="Password" />');
  const input = els.find((e) => e.role === 'textbox');
  assert.ok(input);
  assert.equal(input.accessibleName, 'Password');
});

test('extracts checkbox input', () => {
  const els = extract('<input type="checkbox" aria-label="Accept terms" />');
  const cb = els.find((e) => e.role === 'checkbox');
  assert.ok(cb);
  assert.equal(cb.accessibleName, 'Accept terms');
});

test('extracts radio input', () => {
  const els = extract('<input type="radio" aria-label="Option A" />');
  const radio = els.find((e) => e.role === 'radio');
  assert.ok(radio);
  assert.equal(radio.accessibleName, 'Option A');
});

test('extracts submit button from input type=submit', () => {
  const els = extract('<input type="submit" value="Send" aria-label="Send form" />');
  const btn = els.find((e) => e.role === 'button');
  assert.ok(btn);
  assert.equal(btn.accessibleName, 'Send form');
});

test('hidden input is not extracted (no role)', () => {
  const els = extract('<input type="hidden" name="csrf" value="token123" />');
  assert.equal(els.filter((e) => e.attributes.name === 'csrf').length, 0);
});

// ---------------------------------------------------------------------------
// Input wrapped inside label
// ---------------------------------------------------------------------------

test('extracts checkbox name from wrapping label text', () => {
  const source = `
    <label>
      <input type="checkbox" />
      <span>Remember me</span>
    </label>
  `;
  const els = extract(source);
  const cb = els.find((e) => e.role === 'checkbox');
  assert.ok(cb, 'should find a checkbox');
  assert.ok(cb.accessibleName.includes('Remember me'), `got: ${cb.accessibleName}`);
});

// ---------------------------------------------------------------------------
// Form controls — select/textarea
// ---------------------------------------------------------------------------

test('extracts select as combobox', () => {
  const els = extract('<select aria-label="Country"><option>US</option></select>');
  const sel = els.find((e) => e.role === 'combobox');
  assert.ok(sel);
  assert.equal(sel.accessibleName, 'Country');
});

test('extracts textarea as textbox', () => {
  const els = extract('<textarea placeholder="Enter your message" />');
  const ta = els.find((e) => e.role === 'textbox');
  assert.ok(ta);
  assert.equal(ta.accessibleName, 'Enter your message');
});

// ---------------------------------------------------------------------------
// Landmark roles
// ---------------------------------------------------------------------------

test('extracts nav landmark', () => {
  const els = extract('<nav aria-label="Main navigation">content</nav>');
  const nav = els.find((e) => e.role === 'navigation');
  assert.ok(nav);
  assert.equal(nav.accessibleName, 'Main navigation');
});

test('extracts main landmark', () => {
  const els = extract('<main aria-label="Main content">content</main>');
  const main = els.find((e) => e.role === 'main');
  assert.ok(main);
});

test('extracts header as banner', () => {
  const els = extract('<header aria-label="Site header">header content</header>');
  const h = els.find((e) => e.role === 'banner');
  assert.ok(h);
});

test('extracts footer as contentinfo', () => {
  const els = extract('<footer aria-label="Footer">footer content</footer>');
  const f = els.find((e) => e.role === 'contentinfo');
  assert.ok(f);
});

// ---------------------------------------------------------------------------
// Dynamic / conditional content
// ---------------------------------------------------------------------------

test('marks aria-label with JSX expression as isDynamic', () => {
  const els = extract('<button aria-label={buttonLabel}>Click</button>');
  const btn = els.find((e) => e.role === 'button');
  assert.ok(btn);
  assert.equal(btn.isDynamic, true);
});

test('marks static aria-label as non-dynamic', () => {
  const els = extract('<button aria-label={"Close"}>X</button>');
  const btn = els.find((e) => e.role === 'button');
  assert.ok(btn);
  assert.equal(btn.isDynamic, false);
  assert.equal(btn.accessibleName, 'Close');
});

test('detects conditional rendering pattern', () => {
  const source = `{items.length === 0 && (
    <button>Add first item</button>
  )}`;
  const els = extract(source);
  const btn = els.find((e) => e.role === 'button');
  assert.ok(btn);
  assert.ok(btn.conditional && btn.conditional.includes('items'), `got: ${btn.conditional}`);
});

// ---------------------------------------------------------------------------
// Custom component names — design-system heuristic
// ---------------------------------------------------------------------------

test('treats PrimaryButton custom component as button role', () => {
  const els = extract('<PrimaryButton>Buy now</PrimaryButton>');
  const btn = els.find((e) => e.role === 'button');
  assert.ok(btn, 'PrimaryButton should be mapped to button role');
  assert.equal(btn.accessibleName, 'Buy now');
});

test('treats Title-prefixed custom component as heading role', () => {
  const els = extract('<TitleBar>Dashboard</TitleBar>');
  const h = els.find((e) => e.role === 'heading');
  assert.ok(h, 'TitleBar should be mapped to heading role');
  assert.equal(h.accessibleName, 'Dashboard');
});

// ---------------------------------------------------------------------------
// Text-bearing tags
// ---------------------------------------------------------------------------

test('extracts paragraph text as role=text', () => {
  const els = extract('<p>Welcome to the application.</p>');
  const t = els.find((e) => e.role === 'text');
  assert.ok(t);
  assert.equal(t.accessibleName, 'Welcome to the application.');
});

test('skips empty paragraph (no usable name)', () => {
  const els = extract('<p></p>');
  assert.equal(els.filter((e) => e.role === 'text').length, 0);
});

// ---------------------------------------------------------------------------
// Comment stripping
// ---------------------------------------------------------------------------

test('strips single-line comments before parsing', () => {
  const source = `
    // This is a comment with <button>fake button</button>
    <button>Real button</button>
  `;
  const els = extract(source);
  const btns = els.filter((e) => e.role === 'button');
  // Should only find the real button, not the commented one
  assert.equal(btns.length, 1);
  assert.equal(btns[0].accessibleName, 'Real button');
});

test('strips block comments before parsing', () => {
  const source = `
    /* <button>commented out</button> */
    <button>Visible button</button>
  `;
  const els = extract(source);
  const btns = els.filter((e) => e.role === 'button');
  assert.equal(btns.length, 1);
  assert.equal(btns[0].accessibleName, 'Visible button');
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test('returns empty array for empty source', () => {
  assert.deepEqual(extract(''), []);
});

test('returns empty array for null/undefined source', () => {
  assert.deepEqual(extractElementsFromSource('/file.tsx', null), []);
  assert.deepEqual(extractElementsFromSource('/file.tsx', undefined), []);
});

test('skips meta, script, style, head tags', () => {
  const source = `
    <meta charset="utf-8" />
    <script>const x = 1;</script>
    <style>.foo { color: red; }</style>
    <button>Keep me</button>
  `;
  const els = extract(source);
  assert.equal(els.filter((e) => e.role === 'button').length, 1);
  assert.equal(els.filter((e) => e.role === null).length, 0);
});

test('data-testid ends up in attributes.testId', () => {
  const els = extract('<button data-testid="submit-btn">Submit</button>');
  const btn = els.find((e) => e.role === 'button');
  assert.ok(btn);
  assert.equal(btn.attributes.testId, 'submit-btn');
});

test('id attribute ends up in attributes.id', () => {
  const els = extract('<button id="my-btn">Go</button>');
  const btn = els.find((e) => e.role === 'button');
  assert.ok(btn);
  assert.equal(btn.attributes.id, 'my-btn');
});

test('loading attribute preserved on image', () => {
  const els = extract('<img src="/pic.jpg" alt="Photo" loading="lazy" />');
  const img = els.find((e) => e.role === 'image');
  assert.ok(img);
  assert.equal(img.attributes.loading, 'lazy');
});

test('multiple elements extracted from same source', () => {
  const source = `
    <h1>Page title</h1>
    <nav aria-label="Main">nav</nav>
    <button>Click me</button>
    <a href="/products">Products</a>
    <input type="text" placeholder="Search" />
  `;
  const els = extract(source);
  assert.ok(els.some((e) => e.role === 'heading'));
  assert.ok(els.some((e) => e.role === 'navigation'));
  assert.ok(els.some((e) => e.role === 'button'));
  assert.ok(els.some((e) => e.role === 'link'));
  assert.ok(els.some((e) => e.role === 'textbox'));
});
