const assert = require('node:assert/strict');
const test = require('node:test');

const AutoDetector = require('../src/auto-detector');

test('detectPort returns 3000 for a Create React App project (react-scripts)', () => {
  const detector = new AutoDetector();
  const pkg = {
    scripts: { start: 'react-scripts start', build: 'react-scripts build' },
    dependencies: { 'react-scripts': '5.0.1', react: '18.2.0' },
  };
  // No env/playwright/script port hints, language is javascript — without the
  // react-scripts branch this would fall through to the 8000 fallback.
  assert.equal(detector.detectPort(pkg, null, null, { language: 'javascript' }), 3000);
});

test('detectPort honors react-scripts in devDependencies', () => {
  const detector = new AutoDetector();
  const pkg = {
    scripts: { start: 'react-scripts start' },
    devDependencies: { 'react-scripts': '5.0.1' },
  };
  assert.equal(detector.detectPort(pkg, null, null, { language: 'javascript' }), 3000);
});

test('detectPort prefers explicit script/env port hints over framework default', () => {
  const detector = new AutoDetector();
  const pkg = {
    scripts: { start: 'react-scripts start' },
    dependencies: { 'react-scripts': '5.0.1' },
  };
  assert.equal(detector.detectPort(pkg, { PORT: '3005' }, null, { language: 'javascript' }), 3005);
});

test('detectPort still falls back to 8000 when nothing matches', () => {
  const detector = new AutoDetector();
  const pkg = { scripts: { start: 'node server.js' }, dependencies: {} };
  assert.equal(detector.detectPort(pkg, null, null, { language: 'javascript' }), 8000);
});
