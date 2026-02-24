const prisma = require('../db');
const AppError = require('../lib/AppError');

async function bookSlots({ cycleId, stationId, shift, weeks, traineeName, contactId }) {
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError(404, 'Cycle not found.');
  if (cycle.locked) throw new AppError(403, 'This cycle is locked. Bookings cannot be modified.');

  const conflicts = await prisma.booking.findMany({
    where: { cycleId, stationId, shift, week: { in: weeks } },
  });

  if (conflicts.length > 0) {
    const conflictWeeks = conflicts.map(c => `Week ${c.week}`).join(', ');
    throw new AppError(409, `Conflict: already booked for ${conflictWeeks}`);
  }

  try {
    await prisma.booking.createMany({
      data: weeks.map(week => ({
        cycleId,
        stationId,
        shift,
        week,
        traineeName,
        contactId: contactId || null,
      })),
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw new AppError(409, 'Slot conflict: one or more weeks were just booked by another user.');
    }
    throw err;
  }

  return { booked: weeks.length };
}

async function unbookSlots({ cycleId, stationId, shift, weeks }) {
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError(404, 'Cycle not found.');
  if (cycle.locked) throw new AppError(403, 'This cycle is locked. Bookings cannot be modified.');

  await prisma.booking.deleteMany({
    where: { cycleId, stationId, shift, week: { in: weeks } },
  });

  return { unbooked: weeks.length };
}

async function findAvailableBlocks({ cycleId, shift, labType, side, startWeek, endWeek, weeksNeeded }) {
  const stationWhere = { lab: { labType } };
  if (side !== 'ALL') stationWhere.side = side;

  const stations = await prisma.station.findMany({
    where: stationWhere,
    include: {
      lab: true,
      bookings: {
        where: { cycleId, shift, week: { gte: startWeek, lte: endWeek } },
      },
    },
    orderBy: [{ lab: { name: 'asc' } }, { number: 'asc' }],
  });

  const results = [];
  let idCounter = 0;

  for (const station of stations) {
    const bookedWeeks = new Set(station.bookings.map(b => b.week));

    for (let w = startWeek; w <= endWeek - weeksNeeded + 1; w++) {
      let blockAvailable = true;
      for (let i = 0; i < weeksNeeded; i++) {
        if (bookedWeeks.has(w + i)) {
          blockAvailable = false;
          break;
        }
      }
      if (blockAvailable) {
        const weekCombination = Array.from({ length: weeksNeeded }, (_, i) => w + i);
        results.push({
          id: `${station.lab.name}-${station.number}-${shift}-${weekCombination.join(',')}-${idCounter++}`,
          stationId: station.id,
          lab: station.lab.name,
          station: station.number,
          side: station.side,
          shift,
          weeks: weekCombination,
        });
      }
    }
  }

  return results;
}

async function resetCycle(cycleId) {
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError(404, 'Cycle not found.');
  if (cycle.locked) throw new AppError(403, 'This cycle is locked. Cannot reset.');

  const result = await prisma.booking.deleteMany({ where: { cycleId } });

  return { cycleName: cycle.name, deletedCount: result.count };
}

module.exports = { bookSlots, unbookSlots, findAvailableBlocks, resetCycle };
