const prisma = require('../db');
const AppError = require('../lib/AppError');
const registrationService = require('./registrationService');

async function resolveCycles(year, cycleId) {
  if (cycleId) {
    const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new AppError(404, 'Cycle not found.');
    return [cycle];
  }
  const cycles = await prisma.cycle.findMany({ where: { year } });
  if (cycles.length === 0) throw new AppError(404, 'No cycles found for the given year.');
  return cycles;
}

async function getSeatingAnalytics(year, cycleId = null) {
  const cycles = await resolveCycles(year, cycleId);
  const cycleIds = cycles.map(c => c.id);
  const numCycles = cycles.length;

  const stations = await prisma.station.findMany({ include: { lab: true } });
  const totalStationsCount = stations.length;

  const bookings = await prisma.booking.findMany({
    where: { cycleId: { in: cycleIds } },
    select: { week: true, shift: true, stationId: true },
  });

  const weekOccupancy = Array.from({ length: 12 }, (_, i) => {
    const week = i + 1;
    const totalSlots = totalStationsCount * 2 * numCycles;
    const booked = bookings.filter(b => b.week === week).length;
    return {
      week,
      totalSlots,
      booked,
      percent: totalSlots > 0 ? Math.round((booked / totalSlots) * 1000) / 10 : 0,
    };
  });

  const labMap = new Map();
  for (const station of stations) {
    const name = station.lab.name;
    if (!labMap.has(name)) labMap.set(name, []);
    labMap.get(name).push(station.id);
  }

  // Cross-tabulation matrix: lab → week → booked count (for frontend filtering)
  const bookingMatrix = {};
  const labStationCounts = {};
  for (const [labName, stationIds] of labMap.entries()) {
    const stationIdSet = new Set(stationIds);
    labStationCounts[labName] = stationIds.length;
    bookingMatrix[labName] = {};
    for (let w = 1; w <= 12; w++) {
      bookingMatrix[labName][w] = bookings.filter(b => stationIdSet.has(b.stationId) && b.week === w).length;
    }
  }

  const labOccupancy = Array.from(labMap.entries()).map(([labName, stationIds]) => {
    const stationIdSet = new Set(stationIds);
    const totalSlots = stationIds.length * 12 * 2 * numCycles;
    const booked = bookings.filter(b => stationIdSet.has(b.stationId)).length;
    return {
      lab: labName,
      totalSlots,
      booked,
      percent: totalSlots > 0 ? Math.round((booked / totalSlots) * 1000) / 10 : 0,
    };
  });

  const shiftOccupancy = ['AM', 'PM'].map(shift => {
    const totalSlots = totalStationsCount * 12 * numCycles;
    const booked = bookings.filter(b => b.shift === shift).length;
    return {
      shift,
      totalSlots,
      booked,
      percent: totalSlots > 0 ? Math.round((booked / totalSlots) * 1000) / 10 : 0,
    };
  });

  const totalSlots = totalStationsCount * 12 * 2 * numCycles;
  const totalBooked = bookings.length;
  const summary = {
    totalSlots,
    totalBooked,
    overallPercent: totalSlots > 0 ? Math.round((totalBooked / totalSlots) * 1000) / 10 : 0,
    numCycles,
  };

  return { weekOccupancy, labOccupancy, shiftOccupancy, summary, bookingMatrix, labStationCounts };
}

async function getRegistrationAnalytics(year, shift, cycleId = null) {
  const cycles = await resolveCycles(year, cycleId);

  const shifts = shift === 'BOTH' ? ['AM', 'PM'] : [shift];
  const tasks = cycles.flatMap(cycle => shifts.map(s => ({ cycle, shift: s })));
  const results = await Promise.allSettled(
    tasks.map(t => registrationService.getRegistrationList(t.cycle.id, t.shift, false))
  );

  const allRows = [];
  const warnings = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      allRows.push(...result.value.rows);
    } else {
      const err = result.reason;
      const msg = err.statusCode === 503
        ? 'HubSpot API not configured'
        : (err.message || 'Unknown error');
      warnings.push({ cycleId: tasks[i].cycle.id, cycleName: tasks[i].cycle.name, shift: tasks[i].shift, error: msg });
    }
  }

  const seen = new Set();
  const deduped = allRows.filter(row => {
    const key = row.contactId || `${(row.firstName || '').toLowerCase()}_${(row.lastName || '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const totalStudents = deduped.length;

  const paymentCounts = new Map();
  for (const row of deduped) {
    const status = row.paymentStatus || 'Unknown';
    paymentCounts.set(status, (paymentCounts.get(status) || 0) + 1);
  }
  const paymentDistribution = Array.from(paymentCounts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const cycleCounts = new Map();
  for (const row of deduped) {
    const n = row.cycleCount ?? 0;
    cycleCounts.set(n, (cycleCounts.get(n) || 0) + 1);
  }
  const cycleCountDistribution = Array.from(cycleCounts.entries())
    .map(([cycleNumber, count]) => ({ cycleNumber, count }))
    .sort((a, b) => a.cycleNumber - b.cycleNumber);

  const programCounts = {
    roadmap: deduped.filter(r => r.hasRoadmap).length,
    afk: deduped.filter(r => r.hasAFK).length,
    acj: deduped.filter(r => r.hasACJ).length,
  };

  return { totalStudents, paymentDistribution, cycleCountDistribution, programCounts, warnings };
}

module.exports = { getSeatingAnalytics, getRegistrationAnalytics };
