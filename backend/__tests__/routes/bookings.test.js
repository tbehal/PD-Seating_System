const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/db');
const { getAuthCookie } = require('../helpers');

const UNIQUE_YEAR = 2095;

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
      name: `Bookings Test Cycle ${UNIQUE_YEAR}`,
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

  // Get a station to book against
  const station = await prisma.station.findFirst();
  testStationId = station.id;
});

afterAll(async () => {
  if (testCycleId) {
    await prisma.booking.deleteMany({ where: { cycleId: testCycleId } });
    await prisma.cycleWeek.deleteMany({ where: { cycleId: testCycleId } });
    await prisma.cycle.delete({ where: { id: testCycleId } });
  }
  await prisma.$disconnect();
});

describe('Bookings API', () => {
  describe('POST /api/v1/availability/book', () => {
    test('books slot successfully', async () => {
      const res = await request(app)
        .post('/api/v1/availability/book')
        .set('Cookie', getAuthCookie())
        .send({
          cycleId: testCycleId,
          stationId: testStationId,
          shift: 'AM',
          weeks: [1],
          traineeName: 'Test Student',
        })
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.booked).toBe(1);
    });

    test('returns 409 on double-book', async () => {
      // Create a booking inline so this test is self-contained
      await prisma.booking.create({
        data: {
          cycleId: testCycleId,
          stationId: testStationId,
          shift: 'AM',
          week: 10,
          traineeName: 'First Student',
        },
      });

      const res = await request(app)
        .post('/api/v1/availability/book')
        .set('Cookie', getAuthCookie())
        .send({
          cycleId: testCycleId,
          stationId: testStationId,
          shift: 'AM',
          weeks: [10],
          traineeName: 'Another Student',
        })
        .expect(409);

      expect(res.body.error).toBeDefined();

      await prisma.booking.deleteMany({
        where: { cycleId: testCycleId, stationId: testStationId, shift: 'AM', week: 10 },
      });
    });

    test('returns 403 when cycle is locked', async () => {
      await prisma.cycle.update({ where: { id: testCycleId }, data: { locked: true } });

      try {
        const res = await request(app)
          .post('/api/v1/availability/book')
          .set('Cookie', getAuthCookie())
          .send({
            cycleId: testCycleId,
            stationId: testStationId,
            shift: 'PM',
            weeks: [2],
            traineeName: 'Locked Student',
          })
          .expect(403);

        expect(res.body.error).toBeDefined();
      } finally {
        await prisma.cycle.update({ where: { id: testCycleId }, data: { locked: false } });
      }
    });

    test('returns 400 on validation error', async () => {
      // Missing required traineeName
      const res = await request(app)
        .post('/api/v1/availability/book')
        .set('Cookie', getAuthCookie())
        .send({
          cycleId: testCycleId,
          stationId: testStationId,
          shift: 'AM',
          weeks: [3],
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    test('returns 401 without auth cookie', async () => {
      await request(app)
        .post('/api/v1/availability/book')
        .send({
          cycleId: testCycleId,
          stationId: testStationId,
          shift: 'AM',
          weeks: [4],
          traineeName: 'No Auth',
        })
        .expect(401);
    });
  });

  describe('POST /api/v1/availability/unbook', () => {
    test('unbooks slot successfully', async () => {
      // Create a booking inline so this test is self-contained
      await prisma.booking.create({
        data: {
          cycleId: testCycleId,
          stationId: testStationId,
          shift: 'AM',
          week: 11,
          traineeName: 'Unbook Me',
        },
      });

      const res = await request(app)
        .post('/api/v1/availability/unbook')
        .set('Cookie', getAuthCookie())
        .send({
          cycleId: testCycleId,
          stationId: testStationId,
          shift: 'AM',
          weeks: [11],
        })
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.unbooked).toBe(1);
    });

    test('returns 403 when cycle is locked', async () => {
      // First book a slot so there is something to unbook
      await prisma.booking.create({
        data: {
          cycleId: testCycleId,
          stationId: testStationId,
          shift: 'PM',
          week: 5,
          traineeName: 'Locked Unbook',
        },
      });

      await prisma.cycle.update({ where: { id: testCycleId }, data: { locked: true } });

      try {
        const res = await request(app)
          .post('/api/v1/availability/unbook')
          .set('Cookie', getAuthCookie())
          .send({
            cycleId: testCycleId,
            stationId: testStationId,
            shift: 'PM',
            weeks: [5],
          })
          .expect(403);

        expect(res.body.error).toBeDefined();
      } finally {
        await prisma.cycle.update({ where: { id: testCycleId }, data: { locked: false } });
        // Clean up the booking we created
        await prisma.booking.deleteMany({
          where: { cycleId: testCycleId, stationId: testStationId, shift: 'PM', week: 5 },
        });
      }
    });
  });

  describe('POST /api/v1/availability/find', () => {
    test('returns available blocks', async () => {
      const res = await request(app)
        .post('/api/v1/availability/find')
        .set('Cookie', getAuthCookie())
        .send({
          cycleId: testCycleId,
          shift: 'AM',
          labType: 'REGULAR',
          side: 'ALL',
          startWeek: 1,
          endWeek: 6,
          weeksNeeded: 2,
        })
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.count).toBeDefined();
    });

    test('returns 400 on bad input', async () => {
      // Missing required cycleId
      const res = await request(app)
        .post('/api/v1/availability/find')
        .set('Cookie', getAuthCookie())
        .send({
          shift: 'AM',
          labType: 'REGULAR',
          side: 'ALL',
          startWeek: 1,
          endWeek: 6,
          weeksNeeded: 2,
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/v1/availability/reset', () => {
    test('resets all bookings', async () => {
      // Create a booking to verify it gets deleted
      await prisma.booking.create({
        data: {
          cycleId: testCycleId,
          stationId: testStationId,
          shift: 'AM',
          week: 7,
          traineeName: 'Reset Me',
        },
      });

      const res = await request(app)
        .post('/api/v1/availability/reset')
        .set('Cookie', getAuthCookie())
        .send({ cycleId: testCycleId })
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.deletedCount).toBe('number');
      expect(res.body.data.deletedCount).toBeGreaterThanOrEqual(1);
    });

    test('returns 403 when cycle is locked', async () => {
      await prisma.cycle.update({ where: { id: testCycleId }, data: { locked: true } });

      try {
        const res = await request(app)
          .post('/api/v1/availability/reset')
          .set('Cookie', getAuthCookie())
          .send({ cycleId: testCycleId })
          .expect(403);

        expect(res.body.error).toBeDefined();
      } finally {
        await prisma.cycle.update({ where: { id: testCycleId }, data: { locked: false } });
      }
    });

    test('returns 404 for non-existent cycle', async () => {
      const res = await request(app)
        .post('/api/v1/availability/reset')
        .set('Cookie', getAuthCookie())
        .send({ cycleId: 999999 })
        .expect(404);

      expect(res.body.error).toBeDefined();
    });
  });
});
