const prisma = require('../db');
const AppError = require('../lib/AppError');
const hubspot = require('../hubspot');

function ensureHubSpot() {
  if (!hubspot.apiKey) {
    throw new AppError(503, 'HubSpot API key not configured. Please set HUBSPOT_API_KEY.');
  }
}

function filterShiftCodes(courseCodes, shift) {
  const shiftCodes = courseCodes.filter(code => {
    const upper = code.toUpperCase();
    if (shift === 'AM') return upper.includes('-AM') || upper.includes('_AM') || upper.endsWith('AM');
    return upper.includes('-PM') || upper.includes('_PM') || upper.endsWith('PM');
  });
  return shiftCodes.length > 0 ? shiftCodes : courseCodes;
}

async function getRegistrationList(cycleId, shift, refresh) {
  ensureHubSpot();

  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError(404, 'Cycle not found.');

  const courseCodes = cycle.courseCodes ? JSON.parse(cycle.courseCodes) : [];
  if (courseCodes.length === 0) {
    return {
      rows: [],
      meta: { totalStudents: 0, shift, fetchedAt: new Date().toISOString(), noCodes: true },
    };
  }

  const codesToUse = filterShiftCodes(courseCodes, shift);
  const cacheKey = `${cycleId}_${shift}`;

  if (refresh) {
    hubspot.clearRegistrationCache(cacheKey);
  }

  return hubspot.buildRegistrationList(codesToUse, shift, cacheKey);
}

async function exportRegistrationCsv(cycleId, shift) {
  ensureHubSpot();

  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError(404, 'Cycle not found.');

  const courseCodes = cycle.courseCodes ? JSON.parse(cycle.courseCodes) : [];
  if (courseCodes.length === 0) {
    throw new AppError(400, 'No course codes configured for this cycle.');
  }

  const codesToUse = filterShiftCodes(courseCodes, shift);
  const cacheKey = `${cycleId}_${shift}`;
  const result = await hubspot.buildRegistrationList(codesToUse, shift, cacheKey);

  const headers = [
    'Seat #', 'First Name', 'Last Name', 'Email', 'Phone', 'Student ID',
    'Course Start Date', 'Course End Date', 'Registration Date',
    'Payment Status', 'Outstanding', 'Cycle Count',
    'Roadmap', 'AFK', 'ACJ',
  ];

  const csvRows = [headers.join(',')];
  for (const row of result.rows) {
    csvRows.push([
      row.seatNumber,
      `"${(row.firstName || '').replace(/"/g, '""')}"`,
      `"${(row.lastName || '').replace(/"/g, '""')}"`,
      `"${(row.email || '').replace(/"/g, '""')}"`,
      `"${(row.phone || '').replace(/"/g, '""')}"`,
      `"${(row.studentId || '').replace(/"/g, '""')}"`,
      row.courseStartDate ? new Date(row.courseStartDate).toLocaleDateString('en-US') : '',
      row.courseEndDate ? new Date(row.courseEndDate).toLocaleDateString('en-US') : '',
      row.registrationDate ? new Date(row.registrationDate).toLocaleDateString('en-US') : '',
      `"${(row.paymentStatus || '').replace(/"/g, '""')}"`,
      row.outstanding || 0,
      row.cycleCount || 0,
      row.hasRoadmap ? 'Yes' : 'No',
      row.hasAFK ? 'Yes' : 'No',
      row.hasACJ ? 'Yes' : 'No',
    ].join(','));
  }

  return {
    csv: csvRows.join('\n'),
    cycleName: (cycle.name || `cycle-${cycleId}`).replace(/\s+/g, '-'),
  };
}

module.exports = { getRegistrationList, exportRegistrationCsv };
