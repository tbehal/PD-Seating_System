'use strict';

const { createMockPrisma } = require('../prisma-mock');

const mockPrisma = createMockPrisma();

jest.mock('../../src/db', () => mockPrisma);

jest.mock('../../src/hubspot', () => ({
  apiKey: 'test-api-key',
  buildRegistrationList: jest.fn(),
  clearRegistrationCache: jest.fn(),
}));

const hubspot = require('../../src/hubspot');
const registrationService = require('../../src/services/registrationService');

beforeEach(() => {
  jest.clearAllMocks();
  hubspot.apiKey = 'test-api-key';
});

// ---------------------------------------------------------------------------
// getRegistrationList
// ---------------------------------------------------------------------------
describe('getRegistrationList', () => {
  test('throws 503 when HubSpot API key not configured', async () => {
    hubspot.apiKey = '';

    await expect(registrationService.getRegistrationList(1, 'AM', false)).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/HubSpot API key not configured/i),
    });
  });

  test('throws 404 when cycle not found', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(null);

    await expect(registrationService.getRegistrationList(99, 'AM', false)).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringMatching(/Cycle not found/i),
    });
  });

  test('returns empty result when cycle has no courseCodes', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Cycle 1 - 2026',
      courseCodes: null,
    });

    const result = await registrationService.getRegistrationList(1, 'AM', false);

    expect(result.rows).toEqual([]);
    expect(result.meta.noCodes).toBe(true);
    expect(hubspot.buildRegistrationList).not.toHaveBeenCalled();
  });

  test('calls hubspot with correct shift-filtered course codes', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Cycle 1 - 2026',
      courseCodes: JSON.stringify(['NDC-AM', 'NDC-PM']),
    });

    const mockResult = {
      rows: [],
      meta: { totalStudents: 0, shift: 'AM', fetchedAt: '2026-01-01' },
    };
    hubspot.buildRegistrationList.mockResolvedValueOnce(mockResult);

    const result = await registrationService.getRegistrationList(1, 'AM', false);

    expect(hubspot.buildRegistrationList).toHaveBeenCalledWith(
      ['NDC-AM'],
      'AM',
      '1_AM',
    );
    expect(result).toEqual(mockResult);
  });

  test('uses all codes when no shift-specific codes match', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({
      id: 2,
      name: 'Cycle 2 - 2026',
      courseCodes: JSON.stringify(['CODE1', 'CODE2']),
    });

    const mockResult = {
      rows: [],
      meta: { totalStudents: 0, shift: 'AM', fetchedAt: '2026-01-01' },
    };
    hubspot.buildRegistrationList.mockResolvedValueOnce(mockResult);

    await registrationService.getRegistrationList(2, 'AM', false);

    expect(hubspot.buildRegistrationList).toHaveBeenCalledWith(
      ['CODE1', 'CODE2'],
      'AM',
      '2_AM',
    );
  });

  test('clears cache when refresh is true', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({
      id: 3,
      name: 'Cycle 3 - 2026',
      courseCodes: JSON.stringify(['NDC-AM']),
    });

    hubspot.buildRegistrationList.mockResolvedValueOnce({
      rows: [],
      meta: { totalStudents: 0, shift: 'AM', fetchedAt: '2026-01-01' },
    });

    await registrationService.getRegistrationList(3, 'AM', true);

    expect(hubspot.clearRegistrationCache).toHaveBeenCalledWith('3_AM');
  });

  test('does not clear cache when refresh is false', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({
      id: 4,
      name: 'Cycle 4 - 2026',
      courseCodes: JSON.stringify(['NDC-AM']),
    });

    hubspot.buildRegistrationList.mockResolvedValueOnce({
      rows: [],
      meta: { totalStudents: 0, shift: 'AM', fetchedAt: '2026-01-01' },
    });

    await registrationService.getRegistrationList(4, 'AM', false);

    expect(hubspot.clearRegistrationCache).not.toHaveBeenCalled();
  });

  test('does not false-match codes that end in AM but lack a separator', async () => {
    // 'EXAM-PREP' should NOT be matched as an AM code — endsWith('AM') was too greedy
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({
      id: 5,
      name: 'Cycle 5 - 2026',
      courseCodes: JSON.stringify(['EXAM-PREP', 'NDC-AM']),
    });

    hubspot.buildRegistrationList.mockResolvedValueOnce({
      rows: [],
      meta: { totalStudents: 0, shift: 'AM', fetchedAt: '2026-01-01' },
    });

    await registrationService.getRegistrationList(5, 'AM', false);

    // Only 'NDC-AM' should be passed — 'EXAM-PREP' must be excluded
    expect(hubspot.buildRegistrationList).toHaveBeenCalledWith(
      ['NDC-AM'],
      'AM',
      '5_AM',
    );
  });
});

// ---------------------------------------------------------------------------
// exportRegistrationCsv
// ---------------------------------------------------------------------------
describe('exportRegistrationCsv', () => {
  test('throws 503 when no HubSpot API key', async () => {
    hubspot.apiKey = '';

    await expect(registrationService.exportRegistrationCsv(1, 'AM')).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/HubSpot API key not configured/i),
    });
  });

  test('throws 404 when cycle not found', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce(null);

    await expect(registrationService.exportRegistrationCsv(99, 'AM')).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringMatching(/Cycle not found/i),
    });
  });

  test('throws 400 when no course codes configured', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Cycle 1 - 2026',
      courseCodes: null,
    });

    await expect(registrationService.exportRegistrationCsv(1, 'AM')).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/No course codes/i),
    });
  });

  test('generates CSV with correct headers and data row', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({
      id: 5,
      name: 'Cycle 5 2026',
      courseCodes: JSON.stringify(['NDC-AM']),
    });

    hubspot.buildRegistrationList.mockResolvedValueOnce({
      rows: [
        {
          seatNumber: 1,
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@test.com',
          phone: '555-1234',
          studentId: 'S001',
          courseStartDate: '2026-01-06',
          courseEndDate: '2026-03-27',
          registrationDate: '2025-12-15',
          paymentStatus: 'Paid in Full',
          outstanding: 0,
          cycleCount: 2,
          hasRoadmap: true,
          hasAFK: false,
          hasACJ: false,
          examDate: '2026-04-01',
          contactId: 'c1',
          dealId: 'd1',
        },
      ],
      meta: { totalStudents: 1, shift: 'AM', fetchedAt: '2026-01-01' },
    });

    const { csv, cycleName } = await registrationService.exportRegistrationCsv(5, 'AM');

    const lines = csv.split('\n');

    // Header line check
    expect(lines[0]).toBe(
      'Seat #,First Name,Last Name,Email,Phone,Student ID,Course Start Date,Course End Date,Registration Date,Payment Status,Outstanding,Cycle Count,Roadmap,AFK,ACJ,Exam Date',
    );

    // Data row checks
    expect(lines[1]).toContain('1,');
    expect(lines[1]).toContain('"Alice"');
    expect(lines[1]).toContain('"Smith"');
    expect(lines[1]).toContain('"alice@test.com"');
    expect(lines[1]).toContain('"555-1234"');
    expect(lines[1]).toContain('"S001"');
    expect(lines[1]).toContain('"Paid in Full"');
    expect(lines[1]).toContain('0,');
    expect(lines[1]).toContain('2,');
    expect(lines[1]).toContain('Yes');
    expect(lines[1]).toContain('No');

    // cycleName: spaces replaced with hyphens
    expect(cycleName).toBe('Cycle-5-2026');
  });

  test('escapes double quotes in CSV string fields', async () => {
    mockPrisma.cycle.findUnique.mockResolvedValueOnce({
      id: 6,
      name: 'Cycle 6 2026',
      courseCodes: JSON.stringify(['NDC-AM']),
    });

    hubspot.buildRegistrationList.mockResolvedValueOnce({
      rows: [
        {
          seatNumber: 1,
          firstName: 'O"Brien',
          lastName: 'Test',
          email: 'obrien@test.com',
          phone: '',
          studentId: '',
          courseStartDate: null,
          courseEndDate: null,
          registrationDate: null,
          paymentStatus: 'Paid in Full',
          outstanding: 0,
          cycleCount: 1,
          hasRoadmap: false,
          hasAFK: false,
          hasACJ: false,
          examDate: null,
          contactId: 'c2',
          dealId: 'd2',
        },
      ],
      meta: { totalStudents: 1, shift: 'AM', fetchedAt: '2026-01-01' },
    });

    const { csv } = await registrationService.exportRegistrationCsv(6, 'AM');

    const dataLine = csv.split('\n')[1];

    // Double quote inside field value must be escaped as ""
    expect(dataLine).toContain('"O""Brien"');
  });
});
