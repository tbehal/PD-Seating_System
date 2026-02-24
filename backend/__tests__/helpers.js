const jwt = require('jsonwebtoken');

const TEST_JWT_SECRET = 'test-secret';

function getAuthCookie() {
  const token = jwt.sign({ role: 'admin' }, TEST_JWT_SECRET, { expiresIn: '1h' });
  return `token=${token}`;
}

module.exports = { getAuthCookie };
