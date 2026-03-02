const config = require('./config');
const app = require('./app');

// For Vercel serverless
if (process.env.NODE_ENV === 'production') {
  module.exports = app;
} else {
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Scheduler backend listening on ${config.port}`);
  });
}
