const prisma = require('../db');
const AppError = require('../lib/AppError');

async function listCycles() {
  const cycles = await prisma.cycle.findMany({
    orderBy: [{ year: 'desc' }, { number: 'desc' }],
    include: { cycleWeeks: { orderBy: { week: 'asc' } } },
  });
  return cycles.map(c => ({
    ...c,
    courseCodes: c.courseCodes ? JSON.parse(c.courseCodes) : [],
  }));
}

async function createCycle(year, courseCodes) {
  const latest = await prisma.cycle.findFirst({
    where: { year },
    orderBy: { number: 'desc' },
  });

  const nextNumber = latest ? latest.number + 1 : 1;
  const name = `Cycle ${nextNumber} - ${year}`;

  const cycle = await prisma.cycle.create({
    data: {
      name,
      year,
      number: nextNumber,
      locked: false,
      courseCodes: Array.isArray(courseCodes) && courseCodes.length > 0
        ? JSON.stringify(courseCodes)
        : null,
      cycleWeeks: {
        create: Array.from({ length: 12 }, (_, i) => ({ week: i + 1 })),
      },
    },
    include: { cycleWeeks: { orderBy: { week: 'asc' } } },
  });

  return {
    ...cycle,
    courseCodes: cycle.courseCodes ? JSON.parse(cycle.courseCodes) : [],
  };
}

async function updateWeeks(cycleId, weeks) {
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError(404, 'Cycle not found.');
  if (cycle.locked) throw new AppError(403, 'This cycle is locked. Week dates cannot be modified.');

  for (const w of weeks) {
    if (w.startDate && w.endDate && new Date(w.startDate) > new Date(w.endDate)) {
      throw new AppError(400, `Week ${w.week}: startDate must be <= endDate.`);
    }
  }

  await prisma.$transaction(
    weeks.map(w =>
      prisma.cycleWeek.upsert({
        where: { cycleId_week: { cycleId, week: w.week } },
        update: {
          startDate: w.startDate ? new Date(w.startDate) : null,
          endDate: w.endDate ? new Date(w.endDate) : null,
        },
        create: {
          cycleId,
          week: w.week,
          startDate: w.startDate ? new Date(w.startDate) : null,
          endDate: w.endDate ? new Date(w.endDate) : null,
        },
      })
    )
  );

  return prisma.cycle.findUnique({
    where: { id: cycleId },
    include: { cycleWeeks: { orderBy: { week: 'asc' } } },
  });
}

async function updateCourseCodes(cycleId, courseCodes) {
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError(404, 'Cycle not found.');

  const updated = await prisma.cycle.update({
    where: { id: cycleId },
    data: {
      courseCodes: courseCodes.length > 0 ? JSON.stringify(courseCodes) : null,
    },
  });

  return {
    ...updated,
    courseCodes: updated.courseCodes ? JSON.parse(updated.courseCodes) : [],
  };
}

async function setLocked(cycleId, locked) {
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError(404, 'Cycle not found.');

  return prisma.cycle.update({
    where: { id: cycleId },
    data: { locked },
  });
}

async function deleteCycle(cycleId) {
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError(404, 'Cycle not found.');

  await prisma.$transaction([
    prisma.booking.deleteMany({ where: { cycleId } }),
    prisma.cycleWeek.deleteMany({ where: { cycleId } }),
    prisma.cycle.delete({ where: { id: cycleId } }),
  ]);

  return cycle;
}

module.exports = { listCycles, createCycle, updateWeeks, updateCourseCodes, setLocked, deleteCycle };
