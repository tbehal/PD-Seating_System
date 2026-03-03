/**
 * Reserved test years — each integration test suite uses a unique year
 * to isolate data in the shared test DB. Do NOT reuse these.
 *
 * 2094 — grid.test.js
 * 2095 — bookings.test.js
 * 2096 — analytics.test.js
 * 2097 — registration.test.js
 * 2098 — availability.test.js
 * 2099 — used in analytics.test.js for "no data" (year with no cycles) assertion
 */
const jwt = require('jsonwebtoken');

const TEST_JWT_SECRET = 'test-secret';

function getAuthCookie() {
  const token = jwt.sign({ role: 'admin' }, TEST_JWT_SECRET, { expiresIn: '1h' });
  return `token=${token}`;
}

module.exports = { getAuthCookie };
