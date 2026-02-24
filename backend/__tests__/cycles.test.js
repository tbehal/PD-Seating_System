const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { getAuthCookie } = require('./helpers');

afterAll(async () => {
  // Clean up test cycles
  await prisma.booking.deleteMany({ where: { cycle: { year: 2099 } } });
  await prisma.cycleWeek.deleteMany({ where: { cycle: { year: 2099 } } });
  await prisma.cycle.deleteMany({ where: { year: 2099 } });
  await prisma.$disconnect();
});

describe('Cycles API', () => {
  let createdCycleId;

  test('POST /api/v1/cycles auto-creates 12 CycleWeek records with null dates', async () => {
    // Clean up any leftover 2099 cycles from prior runs
    await prisma.booking.deleteMany({ where: { cycle: { year: 2099 } } });
    await prisma.cycleWeek.deleteMany({ where: { cycle: { year: 2099 } } });
    await prisma.cycle.deleteMany({ where: { year: 2099 } });

    const res = await request(app)
      .post('/api/v1/cycles')
      .set('Cookie', getAuthCookie())
      .send({ year: 2099 })
      .expect(201);

    createdCycleId = res.body.data.id;
    expect(res.body.data.name).toBe('Cycle 1 - 2099');
    expect(res.body.data.cycleWeeks).toHaveLength(12);

    // All weeks should have null dates
    for (const cw of res.body.data.cycleWeeks) {
      expect(cw.startDate).toBeNull();
      expect(cw.endDate).toBeNull();
    }
    // Weeks should be 1-12
    const weekNumbers = res.body.data.cycleWeeks.map(cw => cw.week);
    expect(weekNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test('GET /api/v1/cycles returns cycles with cycleWeeks array', async () => {
    const res = await request(app)
      .get('/api/v1/cycles')
      .set('Cookie', getAuthCookie())
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const cycle = res.body.data.find(c => c.id === createdCycleId);
    expect(cycle).toBeDefined();
    expect(cycle.cycleWeeks).toHaveLength(12);
  });

  test('PATCH /api/v1/cycles/:id/weeks upserts dates correctly', async () => {
    const res = await request(app)
      .patch(`/api/v1/cycles/${createdCycleId}/weeks`)
      .set('Cookie', getAuthCookie())
      .send({
        weeks: [
          { week: 1, startDate: '2099-01-06', endDate: '2099-01-10' },
          { week: 2, startDate: '2099-01-13', endDate: '2099-01-17' },
        ],
      })
      .expect(200);

    const w1 = res.body.data.cycleWeeks.find(cw => cw.week === 1);
    const w2 = res.body.data.cycleWeeks.find(cw => cw.week === 2);
    const w3 = res.body.data.cycleWeeks.find(cw => cw.week === 3);

    expect(w1.startDate).toContain('2099-01-06');
    expect(w1.endDate).toContain('2099-01-10');
    expect(w2.startDate).toContain('2099-01-13');
    expect(w2.endDate).toContain('2099-01-17');
    expect(w3.startDate).toBeNull();
  });

  test('PATCH /api/v1/cycles/:id/weeks rejects locked cycle (403), invalid date order (400), invalid week (400)', async () => {
    // Lock the cycle first
    await request(app).patch(`/api/v1/cycles/${createdCycleId}/lock`).set('Cookie', getAuthCookie()).expect(200);

    // 403 — locked
    const lockedRes = await request(app)
      .patch(`/api/v1/cycles/${createdCycleId}/weeks`)
      .set('Cookie', getAuthCookie())
      .send({ weeks: [{ week: 1, startDate: '2099-01-06', endDate: '2099-01-10' }] })
      .expect(403);
    expect(lockedRes.body.error).toMatch(/locked/i);

    // Unlock for remaining checks
    await request(app).patch(`/api/v1/cycles/${createdCycleId}/unlock`).set('Cookie', getAuthCookie()).expect(200);

    // 400 — invalid date order (start > end)
    const dateRes = await request(app)
      .patch(`/api/v1/cycles/${createdCycleId}/weeks`)
      .set('Cookie', getAuthCookie())
      .send({ weeks: [{ week: 1, startDate: '2099-01-20', endDate: '2099-01-10' }] })
      .expect(400);
    expect(dateRes.body.error).toMatch(/startDate/i);

    // 400 — invalid week number (Joi catches week > 12)
    const weekRes = await request(app)
      .patch(`/api/v1/cycles/${createdCycleId}/weeks`)
      .set('Cookie', getAuthCookie())
      .send({ weeks: [{ week: 13, startDate: '2099-01-06', endDate: '2099-01-10' }] })
      .expect(400);
    expect(weekRes.body.error).toBe('Validation failed.');
    expect(weekRes.body.details).toBeDefined();
  });
});
