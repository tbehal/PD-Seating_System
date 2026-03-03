'use strict';

const { createMockPrisma } = require('../prisma-mock');
const { makeCycle, makeRegistrationRow, makeRegistrationResult } = require('../factories');

const mockPrisma = createMockPrisma();

jest.mock('../../src/db', () => mockPrisma);

jest.mock('../../src/services/registrationService', () => ({
  getRegistrationList: jest.fn(),
}));

const analyticsService = require('../../src/services/analyticsService');
const registrationService = require('../../src/services/registrationService');

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Local helper — kept here because its param signature (named destructuring)
// and minimal shape (no number/side/bookings) are specific to analytics tests.
// ---------------------------------------------------------------------------

function makeStation({ id = 1, labName = 'Lab A', labType = 'REGULAR' } = {}) {
  return {
    id,
    lab: { name: labName, labType },
  };
}

// ---------------------------------------------------------------------------
// getSeatingAnalytics
// ---------------------------------------------------------------------------
describe('getSeatingAnalytics', () => {
  test('calculates week occupancy percentages', async () => {
    const cycles = [makeCycle()];
    const stations = [
      makeStation({ id: 1, labName: 'Lab A' }),
      makeStation({ id: 2, labName: 'Lab A' }),
    ];
    // 2 bookings on week 1, both AM
    const bookings = [
      { week: 1, shift: 'AM', stationId: 1 },
      { week: 1, shift: 'AM', stationId: 2 },
    ];

    mockPrisma.cycle.findMany.mockResolvedValueOnce(cycles);
    mockPrisma.station.findMany.mockResolvedValueOnce(stations);
    mockPrisma.booking.findMany.mockResolvedValueOnce(bookings);

    const result = await analyticsService.getSeatingAnalytics(2026);

    expect(result.weekOccupancy).toHaveLength(12);

    const week1 = result.weekOccupancy[0];
    expect(week1.week).toBe(1);
    expect(week1.booked).toBe(2);
    // totalSlots = 2 stations * 2 shifts * 1 cycle = 4
    expect(week1.totalSlots).toBe(4);
    expect(week1.percent).toBe(50);

    // Week 2 has no bookings
    const week2 = result.weekOccupancy[1];
    expect(week2.booked).toBe(0);
    expect(week2.percent).toBe(0);
  });

  test('calculates lab occupancy', async () => {
    const cycles = [makeCycle()];
    const stations = [
      makeStation({ id: 1, labName: 'Lab A' }),
      makeStation({ id: 2, labName: 'Lab B' }),
    ];
    const bookings = [{ week: 1, shift: 'AM', stationId: 1 }];

    mockPrisma.cycle.findMany.mockResolvedValueOnce(cycles);
    mockPrisma.station.findMany.mockResolvedValueOnce(stations);
    mockPrisma.booking.findMany.mockResolvedValueOnce(bookings);

    const result = await analyticsService.getSeatingAnalytics(2026);

    expect(result.labOccupancy).toHaveLength(2);

    const labA = result.labOccupancy.find((l) => l.lab === 'Lab A');
    expect(labA).toBeDefined();
    expect(labA.booked).toBe(1);
    // totalSlots for Lab A: 1 station * 12 weeks * 2 shifts * 1 cycle = 24
    expect(labA.totalSlots).toBe(24);
    expect(labA.percent).toBeGreaterThan(0);

    const labB = result.labOccupancy.find((l) => l.lab === 'Lab B');
    expect(labB.booked).toBe(0);
    expect(labB.percent).toBe(0);
  });

  test('calculates shift occupancy split between AM and PM', async () => {
    const cycles = [makeCycle()];
    const stations = [makeStation({ id: 1, labName: 'Lab A' })];
    const bookings = [
      { week: 1, shift: 'AM', stationId: 1 },
      { week: 2, shift: 'PM', stationId: 1 },
      { week: 3, shift: 'PM', stationId: 1 },
    ];

    mockPrisma.cycle.findMany.mockResolvedValueOnce(cycles);
    mockPrisma.station.findMany.mockResolvedValueOnce(stations);
    mockPrisma.booking.findMany.mockResolvedValueOnce(bookings);

    const result = await analyticsService.getSeatingAnalytics(2026);

    expect(result.shiftOccupancy).toHaveLength(2);

    const am = result.shiftOccupancy.find((s) => s.shift === 'AM');
    const pm = result.shiftOccupancy.find((s) => s.shift === 'PM');
    expect(am.booked).toBe(1);
    expect(pm.booked).toBe(2);
    // totalSlots per shift = 1 station * 12 weeks * 1 cycle = 12
    expect(am.totalSlots).toBe(12);
    expect(pm.totalSlots).toBe(12);
  });

  test('generates bookingMatrix with lab names as keys and per-week counts', async () => {
    const cycles = [makeCycle()];
    const stations = [
      makeStation({ id: 1, labName: 'Lab A' }),
      makeStation({ id: 2, labName: 'Lab A' }),
      makeStation({ id: 3, labName: 'Lab B' }),
    ];
    const bookings = [
      { week: 1, shift: 'AM', stationId: 1 },
      { week: 1, shift: 'PM', stationId: 2 },
      { week: 2, shift: 'AM', stationId: 3 },
    ];

    mockPrisma.cycle.findMany.mockResolvedValueOnce(cycles);
    mockPrisma.station.findMany.mockResolvedValueOnce(stations);
    mockPrisma.booking.findMany.mockResolvedValueOnce(bookings);

    const result = await analyticsService.getSeatingAnalytics(2026);

    expect(result.bookingMatrix).toHaveProperty('Lab A');
    expect(result.bookingMatrix).toHaveProperty('Lab B');
    expect(result.bookingMatrix['Lab A'][1]).toBe(2);
    expect(result.bookingMatrix['Lab A'][2]).toBe(0);
    expect(result.bookingMatrix['Lab B'][1]).toBe(0);
    expect(result.bookingMatrix['Lab B'][2]).toBe(1);
    expect(Object.keys(result.bookingMatrix['Lab A'])).toHaveLength(12);
  });

  test('throws 404 when no cycles found for the given year', async () => {
    mockPrisma.cycle.findMany.mockResolvedValueOnce([]);

    await expect(analyticsService.getSeatingAnalytics(2026)).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringMatching(/no cycles found/i),
    });
  });

  test('resolves a single cycle via findUnique when cycleId is provided', async () => {
    const cycle = makeCycle({ id: 5, name: 'Cycle 5 - 2026' });
    const stations = [makeStation({ id: 1, labName: 'Lab A' })];

    mockPrisma.cycle.findUnique.mockResolvedValueOnce(cycle);
    mockPrisma.station.findMany.mockResolvedValueOnce(stations);
    mockPrisma.booking.findMany.mockResolvedValueOnce([]);

    const result = await analyticsService.getSeatingAnalytics(2026, 5);

    expect(mockPrisma.cycle.findUnique).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(mockPrisma.cycle.findMany).not.toHaveBeenCalled();
    expect(result.summary.numCycles).toBe(1);
  });

  test('throws 404 when the provided cycleId does not exist', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(null);

    await expect(analyticsService.getSeatingAnalytics(2026, 999)).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringMatching(/cycle not found/i),
    });
  });
});

// ---------------------------------------------------------------------------
// getRegistrationAnalytics
// ---------------------------------------------------------------------------
describe('getRegistrationAnalytics', () => {
  test('aggregates student rows across multiple cycles', async () => {
    const cycles = [
      makeCycle({ id: 1, name: 'Cycle 1 - 2026' }),
      makeCycle({ id: 2, name: 'Cycle 2 - 2026' }),
    ];
    const rows1 = [
      makeRegistrationRow({ contactId: 'hs-001', paymentStatus: 'Paid' }),
      makeRegistrationRow({ contactId: 'hs-002', paymentStatus: 'Unpaid' }),
    ];
    const rows2 = [makeRegistrationRow({ contactId: 'hs-003', paymentStatus: 'Paid' })];

    mockPrisma.cycle.findMany.mockResolvedValueOnce(cycles);
    registrationService.getRegistrationList
      .mockResolvedValueOnce(makeRegistrationResult(rows1, 'AM'))
      .mockResolvedValueOnce(makeRegistrationResult(rows2, 'AM'));

    const result = await analyticsService.getRegistrationAnalytics(2026, 'AM');

    expect(result.totalStudents).toBe(3);
    expect(result.warnings).toHaveLength(0);
  });

  test('deduplicates students by contactId across cycles', async () => {
    const cycles = [
      makeCycle({ id: 1, name: 'Cycle 1 - 2026' }),
      makeCycle({ id: 2, name: 'Cycle 2 - 2026' }),
    ];
    const sharedRow = makeRegistrationRow({ contactId: 'hs-001' });

    mockPrisma.cycle.findMany.mockResolvedValueOnce(cycles);
    registrationService.getRegistrationList
      .mockResolvedValueOnce(makeRegistrationResult([sharedRow], 'AM'))
      .mockResolvedValueOnce(makeRegistrationResult([sharedRow], 'AM'));

    const result = await analyticsService.getRegistrationAnalytics(2026, 'AM');

    // Only 1 unique student despite appearing in 2 cycles
    expect(result.totalStudents).toBe(1);
  });

  test('adds a warning when registrationService rejects for a cycle', async () => {
    const cycles = [
      makeCycle({ id: 1, name: 'Cycle 1 - 2026' }),
      makeCycle({ id: 2, name: 'Cycle 2 - 2026' }),
    ];
    const goodRow = makeRegistrationRow({ contactId: 'hs-001' });

    mockPrisma.cycle.findMany.mockResolvedValueOnce(cycles);
    registrationService.getRegistrationList
      .mockResolvedValueOnce(makeRegistrationResult([goodRow], 'AM'))
      .mockRejectedValueOnce(new Error('HubSpot timeout'));

    const result = await analyticsService.getRegistrationAnalytics(2026, 'AM');

    expect(result.totalStudents).toBe(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].cycleId).toBe(2);
    expect(result.warnings[0].cycleName).toBe('Cycle 2 - 2026');
    expect(result.warnings[0].shift).toBe('AM');
    expect(result.warnings[0].error).toBeTruthy();
  });

  test('uses special error message when HubSpot is not configured (503)', async () => {
    const cycles = [makeCycle({ id: 1, name: 'Cycle 1 - 2026' })];
    const hubspotError = Object.assign(new Error('HubSpot not reachable'), { statusCode: 503 });

    mockPrisma.cycle.findMany.mockResolvedValueOnce(cycles);
    registrationService.getRegistrationList.mockRejectedValueOnce(hubspotError);

    const result = await analyticsService.getRegistrationAnalytics(2026, 'AM');

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].error).toBe('HubSpot API not configured');
  });

  test('expands BOTH shift by calling registrationService for AM and PM separately', async () => {
    const cycles = [makeCycle({ id: 1, name: 'Cycle 1 - 2026' })];
    const amRow = makeRegistrationRow({ contactId: 'hs-001' });
    const pmRow = makeRegistrationRow({ contactId: 'hs-002' });

    mockPrisma.cycle.findMany.mockResolvedValueOnce(cycles);
    registrationService.getRegistrationList
      .mockResolvedValueOnce(makeRegistrationResult([amRow], 'AM'))
      .mockResolvedValueOnce(makeRegistrationResult([pmRow], 'PM'));

    const result = await analyticsService.getRegistrationAnalytics(2026, 'BOTH');

    expect(registrationService.getRegistrationList).toHaveBeenCalledTimes(2);
    expect(registrationService.getRegistrationList).toHaveBeenCalledWith(1, 'AM', false);
    expect(registrationService.getRegistrationList).toHaveBeenCalledWith(1, 'PM', false);
    expect(result.totalStudents).toBe(2);
  });

  test('computes paymentDistribution sorted by count descending', async () => {
    const cycles = [makeCycle({ id: 1 })];
    const rows = [
      makeRegistrationRow({ contactId: 'hs-001', paymentStatus: 'Paid' }),
      makeRegistrationRow({ contactId: 'hs-002', paymentStatus: 'Paid' }),
      makeRegistrationRow({ contactId: 'hs-003', paymentStatus: 'Unpaid' }),
    ];

    mockPrisma.cycle.findMany.mockResolvedValueOnce(cycles);
    registrationService.getRegistrationList.mockResolvedValueOnce(makeRegistrationResult(rows, 'AM'));

    const result = await analyticsService.getRegistrationAnalytics(2026, 'AM');

    expect(result.paymentDistribution).toHaveLength(2);
    expect(result.paymentDistribution[0].status).toBe('Paid');
    expect(result.paymentDistribution[0].count).toBe(2);
    expect(result.paymentDistribution[1].status).toBe('Unpaid');
    expect(result.paymentDistribution[1].count).toBe(1);
  });

  test('computes programCounts from deduplicated rows', async () => {
    const cycles = [makeCycle({ id: 1 })];
    const rows = [
      makeRegistrationRow({ contactId: 'hs-001', hasRoadmap: true, hasAFK: false, hasACJ: false }),
      makeRegistrationRow({ contactId: 'hs-002', hasRoadmap: true, hasAFK: true, hasACJ: false }),
      makeRegistrationRow({ contactId: 'hs-003', hasRoadmap: false, hasAFK: false, hasACJ: true }),
    ];

    mockPrisma.cycle.findMany.mockResolvedValueOnce(cycles);
    registrationService.getRegistrationList.mockResolvedValueOnce(makeRegistrationResult(rows, 'AM'));

    const result = await analyticsService.getRegistrationAnalytics(2026, 'AM');

    expect(result.programCounts.roadmap).toBe(2);
    expect(result.programCounts.afk).toBe(1);
    expect(result.programCounts.acj).toBe(1);
  });

  test('throws 404 when no cycles found for the given year', async () => {
    mockPrisma.cycle.findMany.mockResolvedValueOnce([]);

    await expect(analyticsService.getRegistrationAnalytics(2026, 'AM')).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringMatching(/no cycles found/i),
    });
  });
});
