const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_PASSWORD_HASH = '';

// Point Prisma at the test database
process.env.DATABASE_URL = 'file:' + path.join(__dirname, '..', 'prisma', 'test.db');
