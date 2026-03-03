'use strict';

const { Prisma } = require('@prisma/client');
const { createMockPrisma } = require('../prisma-mock');

const mockPrisma = createMockPrisma();

jest.mock('../../src/db', () => mockPrisma);

const bookingService = require('../../src/services/bookingService');

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// bookSlots
// ---------------------------------------------------------------------------
describe('bookSlots', () => {
  const baseInput = {
    cycleId: 1,
    stationId: 10,
    shift: 'AM',
    weeks: [1, 2, 3],
    traineeName: 'Alice',
    contactId: 'hs-001',
  };

  test('books slots successfully', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({ id: 1, locked: false });
    mockPrisma.booking.findMany.mockResolvedValueOnce([]);
    mockPrisma.booking.createMany.mockResolvedValueOnce({ count: 3 });

    const result = await bookingService.bookSlots(baseInput);

    expect(result).toEqual({ booked: 3 });
    expect(mockPrisma.booking.createMany).toHaveBeenCalledWith({
      data: [
        { cycleId: 1, stationId: 10, shift: 'AM', week: 1, traineeName: 'Alice', contactId: 'hs-001' },
        { cycleId: 1, stationId: 10, shift: 'AM', week: 2, traineeName: 'Alice', contactId: 'hs-001' },
        { cycleId: 1, stationId: 10, shift: 'AM', week: 3, traineeName: 'Alice', contactId: 'hs-001' },
      ],
    });
  });

  test('throws 404 when cycle not found', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(null);

    await expect(bookingService.bookSlots(baseInput)).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining('Cycle not found'),
    });
  });

  test('throws 403 when cycle is locked', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({ id: 1, locked: true });

    await expect(bookingService.bookSlots(baseInput)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/locked/i),
    });
  });

  test('throws 409 when slots already booked', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({ id: 1, locked: false });
    mockPrisma.booking.findMany.mockResolvedValueOnce([
      { week: 1 },
      { week: 2 },
    ]);

    await expect(bookingService.bookSlots(baseInput)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/Conflict/i),
    });
  });

  test('throws 409 on P2002 unique constraint error', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({ id: 1, locked: false });
    mockPrisma.booking.findMany.mockResolvedValueOnce([]);

    const p2002Error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '0.0.0' },
    );
    mockPrisma.booking.createMany.mockRejectedValueOnce(p2002Error);

    await expect(bookingService.bookSlots(baseInput)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/just booked by another user/i),
    });
  });
});

// ---------------------------------------------------------------------------
// unbookSlots
// ---------------------------------------------------------------------------
describe('unbookSlots', () => {
  const baseInput = {
    cycleId: 1,
    stationId: 10,
    shift: 'AM',
    weeks: [1, 2],
  };

  test('unbooks slots successfully', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({ id: 1, locked: false });
    // Intentionally different from weeks.length (2) to prove the service uses
    // weeks.length, NOT deleteMany.count, as the source of the unbooked count.
    mockPrisma.booking.deleteMany.mockResolvedValueOnce({ count: 999 });

    const result = await bookingService.unbookSlots(baseInput);

    // Still 2 — because the service returns weeks.length, not deleteMany.count
    expect(result).toEqual({ unbooked: 2 });
    expect(mockPrisma.booking.deleteMany).toHaveBeenCalledWith({
      where: { cycleId: 1, stationId: 10, shift: 'AM', week: { in: [1, 2] } },
    });
  });

  test('throws 404 when cycle not found', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(null);

    await expect(bookingService.unbookSlots(baseInput)).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining('Cycle not found'),
    });
  });

  test('throws 403 when cycle is locked', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({ id: 1, locked: true });

    await expect(bookingService.unbookSlots(baseInput)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/locked/i),
    });
  });
});

// ---------------------------------------------------------------------------
// findAvailableBlocks
// ---------------------------------------------------------------------------
describe('findAvailableBlocks', () => {
  const baseInput = {
    cycleId: 1,
    shift: 'AM',
    labType: 'REGULAR',
    side: 'ALL',
    startWeek: 1,
    endWeek: 4,
    weeksNeeded: 2,
  };

  test('returns available blocks for empty schedule', async () => {
    mockPrisma.station.findMany.mockResolvedValueOnce([
      {
        id: 10,
        number: 1,
        side: 'LH',
        lab: { name: 'Lab A', labType: 'REGULAR' },
        bookings: [],
      },
    ]);

    const blocks = await bookingService.findAvailableBlocks(baseInput);

    // With no bookings, startWeek=1, endWeek=4, weeksNeeded=2 → starts at 1,2,3
    expect(blocks.length).toBe(3);
    expect(blocks[0].stationId).toBe(10);
    expect(blocks[0].lab).toBe('Lab A');
    expect(blocks[0].side).toBe('LH');
    expect(blocks[0].weeks).toEqual([1, 2]);
    expect(blocks[1].weeks).toEqual([2, 3]);
    expect(blocks[2].weeks).toEqual([3, 4]);
  });

  test('excludes weeks with existing bookings', async () => {
    mockPrisma.station.findMany.mockResolvedValueOnce([
      {
        id: 10,
        number: 1,
        side: 'LH',
        lab: { name: 'Lab A', labType: 'REGULAR' },
        // Week 3 is booked — no block starting at 2 or 3 can be length-2
        bookings: [{ week: 3 }],
      },
    ]);

    const blocks = await bookingService.findAvailableBlocks(baseInput);

    // Valid starts: 1 ([1,2] — no conflict), 2 ([2,3] — week 3 conflict), 3 ([3,4] — week 3 conflict)
    // Only [1,2] is conflict-free
    expect(blocks.length).toBe(1);
    expect(blocks[0].weeks).toEqual([1, 2]);
  });

  test('filters by side when not ALL', async () => {
    mockPrisma.station.findMany.mockResolvedValueOnce([]);

    await bookingService.findAvailableBlocks({ ...baseInput, side: 'LH' });

    expect(mockPrisma.station.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ side: 'LH' }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// resetCycle
// ---------------------------------------------------------------------------
describe('resetCycle', () => {
  test('resets and returns count', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Cycle 1 - 2025',
      locked: false,
    });
    mockPrisma.booking.deleteMany.mockResolvedValueOnce({ count: 5 });

    const result = await bookingService.resetCycle(1);

    expect(result).toEqual({ cycleName: 'Cycle 1 - 2025', deletedCount: 5 });
    expect(mockPrisma.booking.deleteMany).toHaveBeenCalledWith({ where: { cycleId: 1 } });
  });

  test('throws 404 when cycle not found', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(null);

    await expect(bookingService.resetCycle(999)).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining('Cycle not found'),
    });
  });

  test('throws 403 when cycle is locked', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({ id: 1, name: 'Cycle 1 - 2025', locked: true });

    await expect(bookingService.resetCycle(1)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/locked/i),
    });
  });
});
