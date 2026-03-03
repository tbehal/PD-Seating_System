'use strict';

const { createMockPrisma } = require('../prisma-mock');

const mockPrisma = createMockPrisma();

jest.mock('../../src/db', () => mockPrisma);

const gridService = require('../../src/services/gridService');

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal cycle object with 12 cycleWeeks.
 * Only week 1 gets real dates by default; rest are null.
 */
function makeCycle(overrides = {}) {
  const cycleWeeks = Array.from({ length: 12 }, (_, i) => {
    const week = i + 1;
    if (week === 1) {
      return {
        week: 1,
        startDate: new Date('2026-01-06T00:00:00.000Z'),
        endDate: new Date('2026-01-10T00:00:00.000Z'),
      };
    }
    if (week === 2) {
      return { week: 2, startDate: new Date('2026-01-13T00:00:00.000Z'), endDate: new Date('2026-01-17T00:00:00.000Z') };
    }
    return { week, startDate: null, endDate: null };
  });

  return {
    id: 1,
    locked: false,
    cycleWeeks,
    ...overrides,
  };
}

/**
 * Build a station mock with optional bookings.
 */
function makeStation({ id = 1, number = 1, side = 'LH', labName = 'Lab A', labType = 'REGULAR', bookings = [] } = {}) {
  return {
    id,
    number,
    side,
    lab: { name: labName, labType },
    bookings,
  };
}

// ---------------------------------------------------------------------------
// buildGrid
// ---------------------------------------------------------------------------
describe('buildGrid', () => {
  test('returns correct grid shape with station rows', async () => {
    const station = makeStation({
      id: 1,
      number: 1,
      bookings: [{ week: 1, traineeName: 'Alice' }],
    });
    const cycle = makeCycle();

    mockPrisma.station.findMany.mockResolvedValueOnce([station]);
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(cycle);

    const result = await gridService.buildGrid(1, 'AM', 'REGULAR', 'ALL');

    expect(result).toMatchObject({
      cycleId: 1,
      shift: 'AM',
      labType: 'REGULAR',
      side: 'ALL',
      locked: false,
    });

    // weeks is always 1-12
    expect(result.weeks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    // weekDates has 12 entries
    expect(result.weekDates).toHaveLength(12);
    expect(result.weekDates[0]).toMatchObject({ week: 1 });
    expect(result.weekDates[0].startDate).toEqual(new Date('2026-01-06T00:00:00.000Z'));

    // grid has one row
    expect(result.grid).toHaveLength(1);
    expect(result.grid[0].station).toBe('Lab A-1');
    expect(result.grid[0].stationId).toBe(1);
    expect(result.grid[0].labName).toBe('Lab A');
    expect(result.grid[0].side).toBe('LH');

    // week 1 is booked → Alice, week 2 onwards → ✓
    expect(result.grid[0].availability[0]).toBe('Alice');
    expect(result.grid[0].availability[1]).toBe('\u2713');
    expect(result.grid[0].availability[11]).toBe('\u2713');
    expect(result.grid[0].availability).toHaveLength(12);
  });

  test('maps booked weeks to trainee name and free weeks to check mark', async () => {
    const stations = [
      makeStation({ id: 1, number: 1, bookings: [{ week: 3, traineeName: 'Bob' }] }),
      makeStation({ id: 2, number: 2, bookings: [] }),
    ];
    const cycle = makeCycle();

    mockPrisma.station.findMany.mockResolvedValueOnce(stations);
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(cycle);

    const result = await gridService.buildGrid(1, 'PM', 'REGULAR', 'ALL');

    // Station 1: week 3 booked, rest free
    const row1 = result.grid[0];
    expect(row1.availability[0]).toBe('\u2713'); // week 1
    expect(row1.availability[1]).toBe('\u2713'); // week 2
    expect(row1.availability[2]).toBe('Bob');    // week 3
    expect(row1.availability[3]).toBe('\u2713'); // week 4

    // Station 2: all free
    const row2 = result.grid[1];
    row2.availability.forEach((cell) => {
      expect(cell).toBe('\u2713');
    });
  });

  test('throws 404 when cycle not found', async () => {
    mockPrisma.station.findMany.mockResolvedValueOnce([]);
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(null);

    await expect(gridService.buildGrid(999, 'AM', 'REGULAR', 'ALL')).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining('Cycle not found'),
    });
  });

  test('filters by side when side is not ALL', async () => {
    mockPrisma.station.findMany.mockResolvedValueOnce([]);
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(makeCycle());

    await gridService.buildGrid(1, 'AM', 'REGULAR', 'LH');

    expect(mockPrisma.station.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ side: 'LH' }),
      }),
    );
  });

  test('does not add side filter when side is ALL', async () => {
    mockPrisma.station.findMany.mockResolvedValueOnce([]);
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(makeCycle());

    await gridService.buildGrid(1, 'AM', 'REGULAR', 'ALL');

    const callArgs = mockPrisma.station.findMany.mock.calls[0][0];
    expect(callArgs.where).not.toHaveProperty('side');
  });
});

// ---------------------------------------------------------------------------
// exportGrid
// ---------------------------------------------------------------------------
describe('exportGrid', () => {
  test('generates CSV string with headers and data rows', async () => {
    const station = makeStation({
      id: 1,
      number: 1,
      bookings: [{ week: 1, traineeName: 'Alice' }],
    });
    const cycle = makeCycle();

    mockPrisma.station.findMany.mockResolvedValueOnce([station]);
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(cycle);

    const csv = await gridService.exportGrid(1, 'AM', 'REGULAR', 'ALL');
    const lines = csv.split('\n');

    // First line is the header
    expect(lines[0]).toMatch(/^Station,/);
    expect(lines[0]).toContain('W1');

    // Second line is the data row for Lab A-1
    expect(lines[1]).toMatch(/^Lab A-1,/);
  });

  test('includes date ranges in week headers when cycleWeeks have dates', async () => {
    const station = makeStation({ id: 1, number: 1, bookings: [] });
    const cycle = makeCycle(); // week 1 has Jan 6 - Jan 10, week 2 has Jan 13 - Jan 17

    mockPrisma.station.findMany.mockResolvedValueOnce([station]);
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(cycle);

    const csv = await gridService.exportGrid(1, 'AM', 'REGULAR', 'ALL');
    const header = csv.split('\n')[0];

    // Week 1 should have date range
    expect(header).toContain('W1 (Jan 6-Jan 10)');
    // Week 2 should also have date range
    expect(header).toContain('W2 (Jan 13-Jan 17)');
    // Week 3 has null dates → just W3
    expect(header).toContain('W3,');
  });

  test('escapes double quotes in trainee names', async () => {
    const station = makeStation({
      id: 1,
      number: 1,
      bookings: [{ week: 1, traineeName: 'John "JD" Doe' }],
    });
    const cycle = makeCycle();

    mockPrisma.station.findMany.mockResolvedValueOnce([station]);
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(cycle);

    const csv = await gridService.exportGrid(1, 'AM', 'REGULAR', 'ALL');
    const dataRow = csv.split('\n')[1];

    // Double quotes inside CSV strings must be escaped as ""
    expect(dataRow).toContain('"John ""JD"" Doe"');
  });

  test('free cells appear as check mark without quotes', async () => {
    const station = makeStation({ id: 1, number: 1, bookings: [] });
    const cycle = makeCycle();

    mockPrisma.station.findMany.mockResolvedValueOnce([station]);
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(cycle);

    const csv = await gridService.exportGrid(1, 'AM', 'REGULAR', 'ALL');
    const dataRow = csv.split('\n')[1];

    // All cells after station name should be ✓ (not quoted)
    const cells = dataRow.split(',');
    // First cell is station label, rest should be ✓
    cells.slice(1).forEach((cell) => {
      expect(cell).toBe('\u2713');
    });
  });
});
