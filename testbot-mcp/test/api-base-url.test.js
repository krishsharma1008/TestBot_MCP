const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveApiBaseURL } = require('../src/pipeline-worker');

// Regression: run 1780931739696-dzd39m. The config form round-trips only
// host+port for non-primary services and drops the detector's per-service
// baseURL, so the backend service arrived with port:5000 but no baseURL.
// apiBaseURL then fell through to the frontend baseURL (:3001) and every
// generated API spec hit the wrong origin.
test('backend service without baseURL: apiBaseURL is reconstructed from host+port', () => {
  const config = {
    baseURL: 'http://localhost:3001',
    services: [
      { role: 'frontend', host: 'localhost', port: 3001, baseURL: 'http://localhost:3001', isPrimary: true },
      { role: 'backend', host: 'localhost', port: 5000 }, // no baseURL — the bug
    ],
  };
  const apiBaseURL = resolveApiBaseURL(config);
  assert.equal(apiBaseURL, 'http://localhost:5000');
  // The backfill must also populate the service in place for other consumers
  // and the persisted pipeline-config.json.
  assert.equal(config.services[1].baseURL, 'http://localhost:5000');
});

test('backend host defaults to localhost when only port is present', () => {
  const config = {
    baseURL: 'http://localhost:3001',
    services: [
      { role: 'frontend', port: 3001 },
      { role: 'backend', port: 8080 },
    ],
  };
  assert.equal(resolveApiBaseURL(config), 'http://localhost:8080');
});

test('explicit backend baseURL is preferred over reconstruction', () => {
  const config = {
    baseURL: 'http://localhost:3001',
    services: [
      { role: 'frontend', port: 3001 },
      { role: 'backend', host: 'localhost', port: 5000, baseURL: 'https://api.internal:5000' },
    ],
  };
  assert.equal(resolveApiBaseURL(config), 'https://api.internal:5000');
});

test('fullstack service is treated as the API origin', () => {
  const config = {
    baseURL: 'http://localhost:3000',
    services: [{ role: 'fullstack', host: 'localhost', port: 4000 }],
  };
  assert.equal(resolveApiBaseURL(config), 'http://localhost:4000');
});

test('single-service / no backend: apiBaseURL falls back to config.baseURL', () => {
  // No backend or fullstack service → same-origin. The generator keeps emitting
  // clean relative paths because apiBaseURL === baseURL.
  const single = { baseURL: 'http://localhost:3000', services: [{ role: 'frontend', port: 3000 }] };
  assert.equal(resolveApiBaseURL(single), 'http://localhost:3000');

  const noServices = { baseURL: 'http://localhost:3000' };
  assert.equal(resolveApiBaseURL(noServices), 'http://localhost:3000');
});
