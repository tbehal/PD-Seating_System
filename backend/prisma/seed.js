const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Lab definitions: { name, labType, totalStations, lhStations[] }
// lhStations are 1-indexed station numbers that are LH; all others are RH
const LABS = [
  { name: 'Lab A',  labType: 'REGULAR',  totalStations: 38, lhStations: [1, 38] },
  { name: 'Lab B',  labType: 'REGULAR',  totalStations: 31, lhStations: [25] },
  { name: 'Lab C',  labType: 'REGULAR',  totalStations: 14, lhStations: [7] },
  { name: 'Lab E',  labType: 'REGULAR',  totalStations: 15, lhStations: [14] },
  { name: 'Lab B9', labType: 'PRE_EXAM', totalStations: 20, lhStations: [10, 11] },
  { name: 'Lab D',  labType: 'PRE_EXAM', totalStations: 15, lhStations: [1] },
];

async function main() {
  console.log('Seeding database...');

  // Upsert labs and stations
  for (const labDef of LABS) {
    const lab = await prisma.lab.upsert({
      where: { name: labDef.name },
      update: { labType: labDef.labType },
      create: { name: labDef.name, labType: labDef.labType },
    });

    console.log(`  Lab: ${lab.name} (id=${lab.id}, type=${lab.labType})`);

    const lhSet = new Set(labDef.lhStations);

    for (let num = 1; num <= labDef.totalStations; num++) {
      const side = lhSet.has(num) ? 'LH' : 'RH';
      await prisma.station.upsert({
        where: { labId_number: { labId: lab.id, number: num } },
        update: { side },
        create: { labId: lab.id, number: num, side },
      });
    }

    console.log(`    -> ${labDef.totalStations} stations (LH: ${labDef.lhStations.join(', ')})`);
  }

  // Upsert initial cycle
  const cycle = await prisma.cycle.upsert({
    where: { year_number: { year: 2026, number: 1 } },
    update: {},
    create: {
      name: 'Cycle 1 - 2026',
      year: 2026,
      number: 1,
      locked: false,
    },
  });

  console.log(`  Cycle: ${cycle.name} (id=${cycle.id}, locked=${cycle.locked})`);

  // Create 12 CycleWeek records for the initial cycle
  for (let week = 1; week <= 12; week++) {
    await prisma.cycleWeek.upsert({
      where: { cycleId_week: { cycleId: cycle.id, week } },
      update: {},
      create: { cycleId: cycle.id, week },
    });
  }
  console.log(`    -> 12 CycleWeek records created for ${cycle.name}`);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
