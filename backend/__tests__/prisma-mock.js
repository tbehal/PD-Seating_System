/**
 * Creates a mock Prisma client for service unit tests.
 * Usage: jest.mock('../../src/db', () => require('../prisma-mock').createMockPrisma());
 */
function createMockPrisma() {
  const mockPrisma = {
    cycle: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    cycleWeek: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    station: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    lab: {
      findMany: jest.fn(),
    },
    /**
     * NOTE: This mock does not replicate Prisma's transaction atomicity
     * (no rollback on partial failure). Integration tests cover real
     * transaction behavior.
     *
     * Array form executes sequentially (matching Prisma's behavior) rather
     * than in parallel via Promise.all.
     */
    $transaction: jest.fn(async (arg) => {
      if (typeof arg === 'function') {
        return arg(mockPrisma);
      }
      const results = [];
      for (const operation of arg) {
        results.push(await operation);
      }
      return results;
    }),
    $disconnect: jest.fn(),
  };
  return mockPrisma;
}

module.exports = { createMockPrisma };
