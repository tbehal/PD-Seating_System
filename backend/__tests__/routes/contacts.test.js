const request = require('supertest');
const app = require('../../src/app');
const hubspot = require('../../src/hubspot');
const { getAuthCookie } = require('../helpers');

let originalApiKey;

beforeEach(() => {
  originalApiKey = hubspot.apiKey;
  hubspot.apiKey = '';
});

afterEach(() => {
  hubspot.apiKey = originalApiKey;
});

describe('Contacts API', () => {
  test('returns 401 without auth cookie on search', async () => {
    const res = await request(app)
      .get('/api/v1/availability/contacts/search?q=test')
      .expect(401);

    expect(res.body.error).toMatch(/authentication/i);
  });

  test('returns 400 when q param is missing', async () => {
    const res = await request(app)
      .get('/api/v1/availability/contacts/search')
      .set('Cookie', getAuthCookie())
      .expect(400);

    expect(res.body.error).toBe('Validation failed.');
    expect(res.body.details).toBeDefined();
    expect(res.body.details.q).toBeDefined();
  });

  test('returns 503 when HubSpot is not configured', async () => {
    const res = await request(app)
      .get('/api/v1/availability/contacts/search?q=test')
      .set('Cookie', getAuthCookie())
      .expect(503);

    expect(res.body.error).toMatch(/HubSpot/i);
  });

  test('returns 401 without auth cookie on contact lookup', async () => {
    const res = await request(app)
      .get('/api/v1/availability/contacts/12345')
      .expect(401);

    expect(res.body.error).toMatch(/authentication/i);
  });

  test('returns 503 when fetching contact without HubSpot configured', async () => {
    const res = await request(app)
      .get('/api/v1/availability/contacts/12345')
      .set('Cookie', getAuthCookie())
      .expect(503);

    expect(res.body.error).toMatch(/HubSpot/i);
  });
});
