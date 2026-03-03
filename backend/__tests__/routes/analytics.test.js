const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/db');
const hubspot = require('../../src/hubspot');
const { getAuthCookie } = require('../helpers');

const UNIQUE_YEAR = 2096;

let testCycleId;

beforeAll(async () => {
  // Clean up any leftover data from prior runs
  const old = await prisma.cycle.findFirst({ where: { year: UNIQUE_YEAR, number: 1 } });
  if (old) {
    await prisma.booking.deleteMany({ where: { cycleId: old.id } });
    await prisma.cycleWeek.deleteMany({ where: { cycleId: old.id } });
    await prisma.cycle.delete({ where: { id: old.id } });
  }

  // Create test cycle with 12 cycleWeeks
  const cycle = await prisma.cycle.create({
    data: {
      name: `Analytics Test Cycle ${UNIQUE_YEAR}`,
      year: UNIQUE_YEAR,
      number: 1,
      locked: false,
      cycleWeeks: {
        create: Array.from({ length: 12 }, (_, i) => ({
          week: i + 1,
          startDate: null,
          endDate: null,
        })),
      },
    },
  });
  testCycleId = cycle.id;
});

afterAll(async () => {
  if (testCycleId) {
    await prisma.booking.deleteMany({ where: { cycleId: testCycleId } });
    await prisma.cycleWeek.deleteMany({ where: { cycleId: testCycleId } });
    await prisma.cycle.delete({ where: { id: testCycleId } });
  }
  await prisma.$disconnect();
});

describe('Analytics API', () => {
  describe('GET /api/v1/analytics/seating', () => {
    test('returns seating analytics', async () => {
      const res = await request(app)
        .get(`/api/v1/analytics/seating?year=${UNIQUE_YEAR}`)
        .set('Cookie', getAuthCookie())
        .expect(200);

      const { data } = res.body;
      expect(data).toBeDefined();
      expect(data.weekOccupancy).toBeDefined();
      expect(Array.isArray(data.weekOccupancy)).toBe(true);
      expect(data.labOccupancy).toBeDefined();
      expect(Array.isArray(data.labOccupancy)).toBe(true);
      expect(data.shiftOccupancy).toBeDefined();
      expect(Array.isArray(data.shiftOccupancy)).toBe(true);
      expect(data.summary).toBeDefined();
      expect(typeof data.summary.totalSlots).toBe('number');
      expect(typeof data.summary.totalBooked).toBe('number');
    });

    test('returns 400 when year is missing', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/seating')
        .set('Cookie', getAuthCookie())
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    test('returns 404 when no cycles exist for year', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/seating?year=2099')
        .set('Cookie', getAuthCookie())
        .expect(404);

      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/v1/analytics/registration', () => {
    test('returns 200 with warnings when HubSpot API key is not configured', async () => {
      // Save/restore inline with try/finally: this test is isolated within the describe block
      // and does not need beforeEach/afterEach since no other tests in this suite depend on HubSpot.
      const savedApiKey = hubspot.apiKey;
      hubspot.apiKey = '';
      try {
      const res = await request(app)
        .get(`/api/v1/analytics/registration?year=${UNIQUE_YEAR}&shift=AM`)
        .set('Cookie', getAuthCookie())
        .expect(200);

      // Registration analytics uses Promise.allSettled — failures become warnings, not HTTP errors.
      // The response is 200 with an empty student set and warnings indicating HubSpot is unavailable.
      const { data } = res.body;
      expect(data).toBeDefined();
      expect(typeof data.totalStudents).toBe('number');
      expect(Array.isArray(data.warnings)).toBe(true);
      expect(data.warnings.length).toBeGreaterThan(0);
      expect(data.warnings[0].error).toMatch(/hubspot/i);
      } finally {
        hubspot.apiKey = savedApiKey;
      }
    });

    test('returns 400 when shift param is missing', async () => {
      const res = await request(app)
        .get(`/api/v1/analytics/registration?year=${UNIQUE_YEAR}`)
        .set('Cookie', getAuthCookie())
        .expect(400);

      expect(res.body.error).toBeDefined();
    });
  });
});
