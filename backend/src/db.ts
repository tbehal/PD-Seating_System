import { PrismaClient } from '@prisma/client';
import logger from './logger';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug({ duration: e.duration, query: e.query }, 'Prisma query');
  });
}

prisma.$on('warn', (e) => {
  logger.warn({ message: e.message }, 'Prisma warning');
});

prisma.$on('error', (e) => {
  logger.error({ message: e.message }, 'Prisma error');
});

export = prisma;
