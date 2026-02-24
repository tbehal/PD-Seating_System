const path = require('path');
const fs = require('fs');

module.exports = async function globalTeardown() {
  const testDbPath = path.join(__dirname, '..', 'prisma', 'test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  // Also clean up WAL/SHM files left by SQLite
  for (const suffix of ['-journal', '-wal', '-shm']) {
    const f = testDbPath + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
};
