const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

module.exports = async function globalSetup() {
  const testDbPath = path.join(__dirname, '..', 'prisma', 'test.db');

  // Remove stale test DB if present
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Set DATABASE_URL for the migration commands
  const dbUrl = 'file:' + testDbPath;
  const env = { ...process.env, DATABASE_URL: dbUrl };
  const cwd = path.join(__dirname, '..');

  // Run Prisma migrate to create test.db with schema
  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'pipe' });

  // Seed minimal data: 1 lab + 2 stations
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  await prisma.lab.create({
    data: {
      name: 'Lab A',
      labType: 'REGULAR',
      stations: {
        create: [
          { number: 1, side: 'LH' },
          { number: 2, side: 'RH' },
        ],
      },
    },
  });

  // Lab B — REGULAR (second regular lab for multi-lab testing)
  const labB = await prisma.lab.create({
    data: { name: 'Lab B', labType: 'REGULAR' },
  });
  await prisma.station.createMany({
    data: [
      { labId: labB.id, number: 1, side: 'LH' },
      { labId: labB.id, number: 2, side: 'RH' },
    ],
  });

  // Lab D — PRE_EXAM (for labType filter testing)
  const labD = await prisma.lab.create({
    data: { name: 'Lab D', labType: 'PRE_EXAM' },
  });
  await prisma.station.createMany({
    data: [
      { labId: labD.id, number: 1, side: 'LH' },
      { labId: labD.id, number: 2, side: 'RH' },
    ],
  });

  await prisma.$disconnect();
};
