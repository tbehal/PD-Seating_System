import config from './config';
import app from './app';
import logger from './logger';

// For Vercel serverless
if (process.env['NODE_ENV'] === 'production') {
  module.exports = app;
} else {
  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Scheduler backend listening');
  });
}
