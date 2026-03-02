require('dotenv').config();

const config = {
  port: process.env.PORT || 5001,
  databaseUrl: process.env.DATABASE_URL,
  hubspotApiKey: process.env.HUBSPOT_API_KEY || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-do-not-use-in-prod',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  cookieSecure: process.env.NODE_ENV === 'production',
};

if (config.nodeEnv === 'production') {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_PASSWORD_HASH'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

module.exports = config;
