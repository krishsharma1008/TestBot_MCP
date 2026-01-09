const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const AJAX_HEADERS = { 'X-Requested-With': 'XMLHttpRequest' };
const CONTACT_LOG = path.join(__dirname, '..', '..', 'website', 'public', 'storage', 'contact_submissions.log');

async function fetchCruises(request) {
  const response = await request.post('/cuirses/search', {
    headers: AJAX_HEADERS,
    form: { action: 'searchByPort', value: 'ALL' },
  });
  expect(response.ok()).toBeTruthy();
const responseData = await response.text();
const cruises = JSON.parse(responseData);
  expect(Array.isArray(cruises)).toBeTruthy();
  expect(cruises.length).toBeGreaterThan(0);
  return cruises;
}

function readContactLog() {
  if (!fs.existsSync(CONTACT_LOG)) {
    return [];
  }
  const text = fs.readFileSync(CONTACT_LOG, 'utf-8').trim();
  return text ? text.split('\n') : [];
}

test.describe('Cruise Catalog APIs', () => {
  test('search endpoint returns cruises for ALL ports', async ({ request }) => {
    const cruises = await fetchCruises(request);
    expect(cruises[0]).toHaveProperty('idCroisiere');
  });

  test('cruise detail returns itinerary and rom data', async ({ request }) => {
    const cruises = await fetchCruises(request);
    const cruiseId = cruises[0].idCroisiere;
    const response = await request.post('/cuirses/cruiseDetail', {
      headers: AJAX_HEADERS,
      form: { value: cruiseId },
    });
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(payload).toHaveProperty('croisiere');
    expect(payload.croisiere).toHaveProperty('nameCroisier');
    expect(Array.isArray(payload.rom)).toBeTruthy();
  });

  test('checkSession reports false when not authenticated', async ({ request }) => {
    const response = await request.post('/cuirses/checkSession');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toBe(false);
  });

  test('cruise detail handles burst traffic', async ({ request }) => {
    const cruises = await fetchCruises(request);
    const cruiseId = cruises[0].idCroisiere;
    const burst = Array.from({ length: 5 }, () =>
      request.post('/cuirses/cruiseDetail', {
        headers: AJAX_HEADERS,
        form: { value: cruiseId },
      }),
    );
    const responses = await Promise.all(burst);
    responses.forEach((resp) => expect(resp.ok()).toBeTruthy());
  });
});

test.describe('Contact handlers', () => {
  test('real handler rejects incomplete payload', async ({ request }) => {
    const response = await request.post('/php/send-email.php', {
      form: { name: '', email: 'invalid', message: '' },
    });
    expect(response.status()).toBe(422);
    const text = await response.text();
    expect(text).toContain('Name is required');
  });

  test('real handler accepts valid payload and logs entry', async ({ request }) => {
    const before = readContactLog();
    const uniqueMessage = `API contact ${Date.now()}`;
    const response = await request.post('/php/send-email.php', {
      form: {
        name: 'API Tester',
        email: 'api@test.com',
        subject: 'Automation',
        message: uniqueMessage,
      },
    });
    expect(response.ok()).toBeTruthy();
    const after = readContactLog();
    expect(after.length).toBeGreaterThan(before.length);
    expect(after[after.length - 1]).toContain(uniqueMessage);
  });

  test('mock handler echoes payload for fast verification', async ({ request }) => {
    const payload = {
      name: 'Mock Bot',
      email: 'mock@test.com',
      message: 'Hello from API tests',
    };
    const response = await request.post('/php/send-email-mock.php', {
      form: payload,
    });
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json.handler).toBe('mock');
    expect(json.message).toBe(payload.message);
  });
});
