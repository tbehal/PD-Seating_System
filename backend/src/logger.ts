import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport:
    process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:mm:ss' } }
      : undefined,
});

export = logger;
