import prisma from '../db';
import AppError from '../lib/AppError';
import type { CycleWithWeeks } from '../types';

interface WeekInput {
  week: number;
  startDate?: string | null;
  endDate?: string | null;
}

async function listCycles(): Promise<CycleWithWeeks[]> {
  const cycles = await prisma.cycle.findMany({
    orderBy: [{ year: 'desc' }, { number: 'desc' }],
    include: { cycleWeeks: { orderBy: { week: 'asc' } } },
  });
  return cycles.map((c) => ({
    ...c,
    courseCodes: c.courseCodes ? (JSON.parse(c.courseCodes) as string[]) : [],
  }));
}

async function createCycle(year: number, courseCodes?: string[]): Promise<CycleWithWeeks> {
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
      courseCodes:
        Array.isArray(courseCodes) && courseCodes.length > 0 ? JSON.stringify(courseCodes) : null,
      cycleWeeks: {
        create: Array.from({ length: 12 }, (_, i) => ({ week: i + 1 })),
      },
    },
    include: { cycleWeeks: { orderBy: { week: 'asc' } } },
  });

  return {
    ...cycle,
    courseCodes: cycle.courseCodes ? (JSON.parse(cycle.courseCodes) as string[]) : [],
  };
}

async function updateWeeks(cycleId: number, weeks: WeekInput[]) {
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError(404, 'Cycle not found.');
  if (cycle.locked) throw new AppError(403, 'This cycle is locked. Week dates cannot be modified.');

  for (const w of weeks) {
    if (w.startDate && w.endDate && new Date(w.startDate) > new Date(w.endDate)) {
      throw new AppError(400, `Week ${w.week}: startDate must be <= endDate.`);
    }
  }

  await prisma.$transaction(
    weeks.map((w) =>
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
      }),
    ),
  );

  return prisma.cycle.findUnique({
    where: { id: cycleId },
    include: { cycleWeeks: { orderBy: { week: 'asc' } } },
  });
}

async function updateCourseCodes(cycleId: number, courseCodes: string[]) {
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
    courseCodes: updated.courseCodes ? (JSON.parse(updated.courseCodes) as string[]) : [],
  };
}

async function setLocked(cycleId: number, locked: boolean) {
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError(404, 'Cycle not found.');

  return prisma.cycle.update({
    where: { id: cycleId },
    data: { locked },
  });
}

async function deleteCycle(cycleId: number) {
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError(404, 'Cycle not found.');
  if (cycle.locked) throw new AppError(403, 'Cannot delete a locked cycle. Unlock it first.');

  await prisma.cycle.delete({ where: { id: cycleId } });

  return cycle;
}

export { listCycles, createCycle, updateWeeks, updateCourseCodes, setLocked, deleteCycle };
