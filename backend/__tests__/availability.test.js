const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { getAuthCookie } = require('./helpers');

let testCycleId;

beforeAll(async () => {
  // Clean up any leftover data from prior runs
  const old = await prisma.cycle.findFirst({ where: { year: 2098, number: 1 } });
  if (old) {
    await prisma.booking.deleteMany({ where: { cycleId: old.id } });
    await prisma.cycleWeek.deleteMany({ where: { cycleId: old.id } });
    await prisma.cycle.delete({ where: { id: old.id } });
  }

  // Create a test cycle with week dates and a booking for export
  const cycle = await prisma.cycle.create({
    data: {
      name: 'Avail Test Cycle',
      year: 2098,
      number: 1,
      locked: false,
      cycleWeeks: {
        create: Array.from({ length: 12 }, (_, i) => ({
          week: i + 1,
          startDate: i === 0 ? new Date('2098-01-06') : null,
          endDate: i === 0 ? new Date('2098-01-10') : null,
        })),
      },
    },
  });
  testCycleId = cycle.id;

  // Book a station for the export test
  const station = await prisma.station.findFirst();
  await prisma.booking.create({
    data: {
      cycleId: testCycleId,
      stationId: station.id,
      shift: 'AM',
      week: 1,
      traineeName: 'Test Student',
    },
  });
});

afterAll(async () => {
  // Clean up
  if (testCycleId) {
    await prisma.booking.deleteMany({ where: { cycleId: testCycleId } });
    await prisma.cycleWeek.deleteMany({ where: { cycleId: testCycleId } });
    await prisma.cycle.delete({ where: { id: testCycleId } });
  }
  await prisma.$disconnect();
});

describe('Availability API', () => {
  test('POST /api/v1/availability/grid includes weekDates array', async () => {
    const res = await request(app)
      .post('/api/v1/availability/grid')
      .set('Cookie', getAuthCookie())
      .send({ cycleId: testCycleId, shift: 'AM', labType: 'REGULAR', side: 'ALL' })
      .expect(200);

    expect(res.body.data.weekDates).toBeDefined();
    expect(res.body.data.weekDates).toHaveLength(12);

    // Week 1 should have the dates we set
    const w1 = res.body.data.weekDates.find(wd => wd.week === 1);
    expect(w1.startDate).toContain('2098-01-06');
    expect(w1.endDate).toContain('2098-01-10');

    // Week 2 should be null
    const w2 = res.body.data.weekDates.find(wd => wd.week === 2);
    expect(w2.startDate).toBeNull();
  });

  test('GET /api/v1/availability/export CSV is grid-format with week date headers', async () => {
    const res = await request(app)
      .get(`/api/v1/availability/export?cycleId=${testCycleId}&shift=AM&labType=REGULAR&side=ALL`)
      .set('Cookie', getAuthCookie())
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);

    const lines = res.text.split('\n');
    const header = lines[0];

    // Header should have Station + week columns with date ranges
    expect(header).toContain('Station');
    expect(header).toContain('W1 (Jan 6-Jan 10)');
    expect(header).toContain('W2');

    // Data rows should have station labels and cell values
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const dataRow = lines[1];
    expect(dataRow).toMatch(/^Lab A-/); // starts with station label
    expect(dataRow).toContain('Test Student'); // booked name in week 1
  });
});
