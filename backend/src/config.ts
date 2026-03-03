import 'dotenv/config';

interface Config {
  port: string | number;
  databaseUrl: string | undefined;
  hubspotApiKey: string;
  jwtSecret: string;
  adminPasswordHash: string;
  nodeEnv: string;
  cookieSecure: boolean;
}

const config: Config = {
  port: process.env.PORT || 5001,
  databaseUrl: process.env.DATABASE_URL,
  hubspotApiKey: process.env.HUBSPOT_API_KEY || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-do-not-use-in-prod',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  cookieSecure: process.env.NODE_ENV === 'production',
};

if (config.nodeEnv === 'production') {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_PASSWORD_HASH'] as const;
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    process.stderr.write(`FATAL: Missing required environment variables: ${missing.join(', ')}\n`);
    process.exit(1);
  }
}

export = config;
