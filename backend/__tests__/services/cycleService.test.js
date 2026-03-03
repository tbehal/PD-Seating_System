'use strict';

const { createMockPrisma } = require('../prisma-mock');

const mockPrisma = createMockPrisma();

jest.mock('../../src/db', () => mockPrisma);

const cycleService = require('../../src/services/cycleService');

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// listCycles
// ---------------------------------------------------------------------------
describe('listCycles', () => {
  test('returns cycles with parsed courseCodes', async () => {
    mockPrisma.cycle.findMany.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Cycle 1 - 2025',
        year: 2025,
        number: 1,
        locked: false,
        courseCodes: JSON.stringify(['NDC', 'AFK']),
        cycleWeeks: [],
      },
    ]);

    const result = await cycleService.listCycles();

    expect(result).toHaveLength(1);
    expect(result[0].courseCodes).toEqual(['NDC', 'AFK']);
  });

  test('returns empty array when no cycles', async () => {
    mockPrisma.cycle.findMany.mockResolvedValueOnce([]);

    const result = await cycleService.listCycles();

    expect(result).toEqual([]);
  });

  test('handles null courseCodes', async () => {
    mockPrisma.cycle.findMany.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Cycle 1 - 2025',
        year: 2025,
        number: 1,
        locked: false,
        courseCodes: null,
        cycleWeeks: [],
      },
    ]);

    const result = await cycleService.listCycles();

    expect(result[0].courseCodes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createCycle
// ---------------------------------------------------------------------------
describe('createCycle', () => {
  const createdCycleBase = {
    id: 3,
    name: 'Cycle 3 - 2025',
    year: 2025,
    number: 3,
    locked: false,
    courseCodes: null,
    cycleWeeks: Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      cycleId: 3,
      week: i + 1,
      startDate: null,
      endDate: null,
    })),
  };

  test('auto-increments cycle number', async () => {
    mockPrisma.cycle.findFirst.mockResolvedValueOnce({ id: 2, number: 2 });
    mockPrisma.cycle.create.mockResolvedValueOnce({ ...createdCycleBase });

    const result = await cycleService.createCycle(2025);

    expect(mockPrisma.cycle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ number: 3, year: 2025 }),
      }),
    );
    expect(result.number).toBe(3);
  });

  test('starts at 1 when no existing cycle', async () => {
    mockPrisma.cycle.findFirst.mockResolvedValueOnce(null);
    mockPrisma.cycle.create.mockResolvedValueOnce({
      ...createdCycleBase,
      number: 1,
      name: 'Cycle 1 - 2025',
    });

    const result = await cycleService.createCycle(2025);

    expect(mockPrisma.cycle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ number: 1 }),
      }),
    );
    expect(result.number).toBe(1);
  });

  test('creates 12 CycleWeeks', async () => {
    mockPrisma.cycle.findFirst.mockResolvedValueOnce(null);
    mockPrisma.cycle.create.mockResolvedValueOnce({ ...createdCycleBase, number: 1, name: 'Cycle 1 - 2025' });

    await cycleService.createCycle(2025);

    const createCall = mockPrisma.cycle.create.mock.calls[0][0];
    const cycleWeeksCreate = createCall.data.cycleWeeks.create;
    expect(cycleWeeksCreate).toHaveLength(12);
    expect(cycleWeeksCreate[0]).toEqual({ week: 1 });
    expect(cycleWeeksCreate[11]).toEqual({ week: 12 });
  });

  test('serializes courseCodes to JSON', async () => {
    mockPrisma.cycle.findFirst.mockResolvedValueOnce(null);
    mockPrisma.cycle.create.mockResolvedValueOnce({
      ...createdCycleBase,
      number: 1,
      name: 'Cycle 1 - 2025',
      courseCodes: JSON.stringify(['CODE1', 'CODE2']),
    });

    await cycleService.createCycle(2025, ['CODE1', 'CODE2']);

    const createCall = mockPrisma.cycle.create.mock.calls[0][0];
    expect(createCall.data.courseCodes).toBe(JSON.stringify(['CODE1', 'CODE2']));
  });
});

// ---------------------------------------------------------------------------
// updateWeeks
// ---------------------------------------------------------------------------
describe('updateWeeks', () => {
  const weeks = [
    { week: 1, startDate: '2025-01-06', endDate: '2025-01-10' },
    { week: 2, startDate: '2025-01-13', endDate: '2025-01-17' },
  ];

  const updatedCycle = {
    id: 1,
    name: 'Cycle 1 - 2025',
    year: 2025,
    number: 1,
    locked: false,
    courseCodes: null,
    cycleWeeks: [],
  };

  test('upserts week dates successfully', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({ id: 1, locked: false });
    mockPrisma.cycleWeek.upsert.mockResolvedValue({ id: 1, cycleId: 1, week: 1 });
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(updatedCycle);

    const result = await cycleService.updateWeeks(1, weeks);

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.cycleWeek.upsert).toHaveBeenCalledTimes(2);
    expect(result).toEqual(updatedCycle);
  });

  test('throws 404 when cycle not found', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(null);

    await expect(cycleService.updateWeeks(999, weeks)).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining('Cycle not found'),
    });
  });

  test('throws 403 when cycle is locked', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({ id: 1, locked: true });

    await expect(cycleService.updateWeeks(1, weeks)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/locked/i),
    });
  });

  test('throws 400 when startDate > endDate', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({ id: 1, locked: false });

    const badWeeks = [{ week: 1, startDate: '2025-01-20', endDate: '2025-01-10' }];

    await expect(cycleService.updateWeeks(1, badWeeks)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/startDate/i),
    });
  });
});

// ---------------------------------------------------------------------------
// updateCourseCodes
// ---------------------------------------------------------------------------
describe('updateCourseCodes', () => {
  test('updates course codes successfully', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({ id: 1, locked: false });
    mockPrisma.cycle.update.mockResolvedValueOnce({
      id: 1,
      name: 'Cycle 1 - 2025',
      year: 2025,
      number: 1,
      locked: false,
      courseCodes: JSON.stringify(['NDC', 'ACJ']),
    });

    const result = await cycleService.updateCourseCodes(1, ['NDC', 'ACJ']);

    expect(mockPrisma.cycle.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { courseCodes: JSON.stringify(['NDC', 'ACJ']) },
    });
    expect(result.courseCodes).toEqual(['NDC', 'ACJ']);
  });

  test('throws 404 when cycle not found', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(null);

    await expect(cycleService.updateCourseCodes(999, ['NDC'])).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining('Cycle not found'),
    });
  });
});

// ---------------------------------------------------------------------------
// setLocked
// ---------------------------------------------------------------------------
describe('setLocked', () => {
  test('sets locked to true', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({ id: 1, locked: false });
    mockPrisma.cycle.update.mockResolvedValueOnce({ id: 1, locked: true });

    await cycleService.setLocked(1, true);

    expect(mockPrisma.cycle.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { locked: true },
    });
  });

  test('throws 404 when cycle not found', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(null);

    await expect(cycleService.setLocked(999, true)).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining('Cycle not found'),
    });
  });
});

// ---------------------------------------------------------------------------
// deleteCycle
// ---------------------------------------------------------------------------
describe('deleteCycle', () => {
  test('deletes unlocked cycle', async () => {
    const cycle = { id: 1, name: 'Cycle 1 - 2025', locked: false };
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(cycle);
    mockPrisma.cycle.delete.mockResolvedValueOnce(cycle);

    const result = await cycleService.deleteCycle(1);

    expect(mockPrisma.cycle.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toEqual(cycle);
  });

  test('throws 404 when cycle not found', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(null);

    await expect(cycleService.deleteCycle(999)).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining('Cycle not found'),
    });
  });

  test('throws 403 when cycle is locked', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({ id: 1, name: 'Cycle 1 - 2025', locked: true });

    await expect(cycleService.deleteCycle(1)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/locked/i),
    });
  });
});
