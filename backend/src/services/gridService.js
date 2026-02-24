const prisma = require('../db');
const AppError = require('../lib/AppError');

async function buildGrid(cycleId, shift, labType, side) {
  const stationWhere = { lab: { labType } };
  if (side !== 'ALL') stationWhere.side = side;

  const [stations, cycle] = await Promise.all([
    prisma.station.findMany({
      where: stationWhere,
      include: {
        lab: true,
        bookings: { where: { cycleId, shift } },
      },
      orderBy: [{ lab: { name: 'asc' } }, { number: 'asc' }],
    }),
    prisma.cycle.findUnique({
      where: { id: cycleId },
      include: { cycleWeeks: { orderBy: { week: 'asc' } } },
    }),
  ]);

  if (!cycle) throw new AppError(404, 'Cycle not found.');

  const weeks = Array.from({ length: 12 }, (_, i) => i + 1);

  const grid = stations.map(station => {
    const bookingMap = new Map();
    for (const b of station.bookings) {
      bookingMap.set(b.week, b.traineeName);
    }
    return {
      stationId: station.id,
      station: `${station.lab.name}-${station.number}`,
      labName: station.lab.name,
      side: station.side,
      availability: weeks.map(w => bookingMap.get(w) || '\u2713'),
    };
  });

  const weekDates = weeks.map(w => {
    const cw = cycle.cycleWeeks.find(cw => cw.week === w);
    return { week: w, startDate: cw?.startDate || null, endDate: cw?.endDate || null };
  });

  return {
    cycleId,
    shift,
    labType,
    side,
    locked: cycle.locked,
    weeks,
    weekDates,
    grid,
  };
}

async function exportGrid(cycleId, shift, labType, side) {
  const data = await buildGrid(cycleId, shift, labType, side);

  const fmtShort = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  const weekHeaders = data.weeks.map(w => {
    const wd = data.weekDates.find(wd => wd.week === w);
    if (wd?.startDate && wd?.endDate) {
      return `W${w} (${fmtShort(wd.startDate)}-${fmtShort(wd.endDate)})`;
    }
    return `W${w}`;
  });

  const header = ['Station', ...weekHeaders].join(',');

  const rows = data.grid.map(row => {
    const cells = row.availability.map(cell => {
      if (cell !== '\u2713') return `"${cell.replace(/"/g, '""')}"`;
      return '\u2713';
    });
    return [row.station, ...cells].join(',');
  });

  return [header, ...rows].join('\n');
}

module.exports = { buildGrid, exportGrid };
