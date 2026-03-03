const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/db');
const hubspot = require('../../src/hubspot');
const { getAuthCookie } = require('../helpers');

const UNIQUE_YEAR = 2097;

let testCycleId;
let originalApiKey;

beforeAll(async () => {
  // Clean up any leftover data from prior runs
  const old = await prisma.cycle.findFirst({ where: { year: UNIQUE_YEAR, number: 1 } });
  if (old) {
    await prisma.booking.deleteMany({ where: { cycleId: old.id } });
    await prisma.cycleWeek.deleteMany({ where: { cycleId: old.id } });
    await prisma.cycle.delete({ where: { id: old.id } });
  }

  const cycle = await prisma.cycle.create({
    data: {
      name: 'Reg Test Cycle',
      year: UNIQUE_YEAR,
      number: 1,
      locked: false,
      courseCodes: JSON.stringify(['NDC-TEST']),
      cycleWeeks: {
        create: Array.from({ length: 12 }, (_, i) => ({ week: i + 1 })),
      },
    },
  });
  testCycleId = cycle.id;
});

beforeEach(() => {
  originalApiKey = hubspot.apiKey;
  hubspot.apiKey = '';
});

afterEach(() => {
  hubspot.apiKey = originalApiKey;
});

afterAll(async () => {
  if (testCycleId) {
    await prisma.booking.deleteMany({ where: { cycleId: testCycleId } });
    await prisma.cycleWeek.deleteMany({ where: { cycleId: testCycleId } });
    await prisma.cycle.delete({ where: { id: testCycleId } });
  }
  await prisma.$disconnect();
});

describe('Registration API', () => {
  test('returns 401 without auth cookie', async () => {
    const res = await request(app)
      .get(`/api/v1/cycles/${testCycleId}/registration?shift=AM`)
      .expect(401);

    expect(res.body.error).toMatch(/authentication/i);
  });

  test('returns 503 when HubSpot is not configured', async () => {
    const res = await request(app)
      .get(`/api/v1/cycles/${testCycleId}/registration?shift=AM`)
      .set('Cookie', getAuthCookie())
      .expect(503);

    expect(res.body.error).toMatch(/HubSpot/i);
  });

  test('returns 503 even for non-existent cycle when HubSpot not configured', async () => {
    const res = await request(app)
      .get('/api/v1/cycles/999999/registration?shift=AM')
      .set('Cookie', getAuthCookie())
      .expect(503);

    expect(res.body.error).toMatch(/HubSpot/i);
  });

  test('returns 400 for non-integer cycleId param', async () => {
    const res = await request(app)
      .get('/api/v1/cycles/abc/registration?shift=AM')
      .set('Cookie', getAuthCookie())
      .expect(400);

    expect(res.body.error).toBe('Validation failed.');
    expect(res.body.details).toBeDefined();
    expect(res.body.details.cycleId).toBeDefined();
  });

  test('export returns 401 without auth cookie', async () => {
    const res = await request(app)
      .get(`/api/v1/cycles/${testCycleId}/registration/export?shift=AM`)
      .expect(401);

    expect(res.body.error).toMatch(/authentication/i);
  });

  test('export returns 503 when HubSpot is not configured', async () => {
    const res = await request(app)
      .get(`/api/v1/cycles/${testCycleId}/registration/export?shift=AM`)
      .set('Cookie', getAuthCookie())
      .expect(503);

    expect(res.body.error).toMatch(/HubSpot/i);
  });
});
