const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/db');
const { getAuthCookie } = require('../helpers');

const UNIQUE_YEAR = 2094;

let testCycleId;
let testStationId;

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
      name: `Grid Test Cycle ${UNIQUE_YEAR}`,
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

  // Use the first station from setup.js (Lab A, REGULAR, LH side)
  const station = await prisma.station.findFirst({ include: { lab: true } });
  testStationId = station.id;

  // Create a booking so the grid has real data to show
  await prisma.booking.create({
    data: {
      cycleId: testCycleId,
      stationId: testStationId,
      shift: 'AM',
      week: 3,
      traineeName: 'Grid Test Student',
    },
  });
});

afterAll(async () => {
  if (testCycleId) {
    await prisma.booking.deleteMany({ where: { cycleId: testCycleId } });
    await prisma.cycleWeek.deleteMany({ where: { cycleId: testCycleId } });
    await prisma.cycle.delete({ where: { id: testCycleId } });
  }
  await prisma.$disconnect();
});

describe('Grid API', () => {
  describe('POST /api/v1/availability/grid', () => {
    test('returns grid data with correct structure', async () => {
      const res = await request(app)
        .post('/api/v1/availability/grid')
        .set('Cookie', getAuthCookie())
        .send({
          cycleId: testCycleId,
          shift: 'AM',
          labType: 'REGULAR',
          side: 'ALL',
        })
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.message).toBeDefined();

      const { data } = res.body;
      expect(data.cycleId).toBe(testCycleId);
      expect(data.shift).toBe('AM');
      expect(data.labType).toBe('REGULAR');
      expect(data.side).toBe('ALL');
      expect(typeof data.locked).toBe('boolean');
      expect(Array.isArray(data.weeks)).toBe(true);
      expect(data.weeks).toHaveLength(12);
      expect(Array.isArray(data.weekDates)).toBe(true);
      expect(data.weekDates).toHaveLength(12);
      expect(Array.isArray(data.grid)).toBe(true);
    });

    test('grid rows have correct shape and reflect booking data', async () => {
      const res = await request(app)
        .post('/api/v1/availability/grid')
        .set('Cookie', getAuthCookie())
        .send({
          cycleId: testCycleId,
          shift: 'AM',
          labType: 'REGULAR',
          side: 'ALL',
        })
        .expect(200);

      const { grid } = res.body.data;
      expect(grid.length).toBeGreaterThan(0);

      const row = grid[0];
      expect(typeof row.stationId).toBe('number');
      expect(typeof row.station).toBe('string');
      expect(typeof row.labName).toBe('string');
      expect(typeof row.side).toBe('string');
      expect(Array.isArray(row.availability)).toBe(true);
      expect(row.availability).toHaveLength(12);

      // Week 3 should be the trainee name we booked, not the checkmark
      const bookedRow = grid.find((r) => r.stationId === testStationId);
      expect(bookedRow).toBeDefined();
      expect(bookedRow.availability[2]).toBe('Grid Test Student'); // week 3 = index 2
    });

    test('respects side query parameter filter', async () => {
      const res = await request(app)
        .post('/api/v1/availability/grid')
        .set('Cookie', getAuthCookie())
        .send({
          cycleId: testCycleId,
          shift: 'AM',
          labType: 'REGULAR',
          side: 'LH',
        })
        .expect(200);

      const { grid } = res.body.data;
      // Every row returned should be LH side only
      for (const row of grid) {
        expect(row.side).toBe('LH');
      }
    });

    test('returns only PRE_EXAM stations when labType is PRE_EXAM', async () => {
      const res = await request(app)
        .post('/api/v1/availability/grid')
        .set('Cookie', getAuthCookie())
        .send({
          cycleId: testCycleId,
          shift: 'AM',
          labType: 'PRE_EXAM',
          side: 'ALL',
        })
        .expect(200);

      const { grid } = res.body.data;
      // Lab D (PRE_EXAM) has 2 stations — all rows must belong to a PRE_EXAM lab
      expect(grid.length).toBeGreaterThan(0);
      for (const row of grid) {
        expect(row.labName).toBe('Lab D');
      }
    });

    test('returns 404 when cycle does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/availability/grid')
        .set('Cookie', getAuthCookie())
        .send({
          cycleId: 999999,
          shift: 'AM',
          labType: 'REGULAR',
          side: 'ALL',
        })
        .expect(404);

      expect(res.body.error).toBeDefined();
    });

    test('returns 400 on validation error — missing required field', async () => {
      // Missing `shift`
      const res = await request(app)
        .post('/api/v1/availability/grid')
        .set('Cookie', getAuthCookie())
        .send({
          cycleId: testCycleId,
          labType: 'REGULAR',
          side: 'ALL',
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    test('returns 400 when shift is not AM or PM', async () => {
      const res = await request(app)
        .post('/api/v1/availability/grid')
        .set('Cookie', getAuthCookie())
        .send({
          cycleId: testCycleId,
          shift: 'NIGHT',
          labType: 'REGULAR',
          side: 'ALL',
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    test('returns 401 without auth cookie', async () => {
      await request(app)
        .post('/api/v1/availability/grid')
        .send({
          cycleId: testCycleId,
          shift: 'AM',
          labType: 'REGULAR',
          side: 'ALL',
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/availability/export', () => {
    test('returns CSV content type with correct headers', async () => {
      const res = await request(app)
        .get('/api/v1/availability/export')
        .set('Cookie', getAuthCookie())
        .query({
          cycleId: testCycleId,
          shift: 'AM',
          labType: 'REGULAR',
          side: 'ALL',
        })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.headers['content-disposition']).toMatch(
        new RegExp(`cycle-${testCycleId}-AM-REGULAR-export\\.csv`),
      );
    });

    test('CSV body contains station and week headers', async () => {
      const res = await request(app)
        .get('/api/v1/availability/export')
        .set('Cookie', getAuthCookie())
        .query({
          cycleId: testCycleId,
          shift: 'AM',
          labType: 'REGULAR',
          side: 'ALL',
        })
        .expect(200);

      const lines = res.text.split('\n');
      // First line is the header row
      expect(lines[0]).toMatch(/Station/);
      expect(lines[0]).toMatch(/W1/);
      expect(lines[0]).toMatch(/W12/);
      // Should have at least header + 1 data row (Lab A has 2 stations)
      expect(lines.length).toBeGreaterThan(1);
    });

    test('returns 404 when cycle does not exist', async () => {
      const res = await request(app)
        .get('/api/v1/availability/export')
        .set('Cookie', getAuthCookie())
        .query({
          cycleId: 999999,
          shift: 'AM',
          labType: 'REGULAR',
          side: 'ALL',
        })
        .expect(404);

      expect(res.body.error).toBeDefined();
    });

    test('returns 400 on validation error — missing required query param', async () => {
      // Missing `labType`
      const res = await request(app)
        .get('/api/v1/availability/export')
        .set('Cookie', getAuthCookie())
        .query({
          cycleId: testCycleId,
          shift: 'AM',
          side: 'ALL',
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    test('returns 401 without auth cookie', async () => {
      await request(app)
        .get('/api/v1/availability/export')
        .query({
          cycleId: testCycleId,
          shift: 'AM',
          labType: 'REGULAR',
          side: 'ALL',
        })
        .expect(401);
    });
  });
});
