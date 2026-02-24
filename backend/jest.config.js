module.exports = {
  testEnvironment: 'node',
  globalSetup: './__tests__/setup.js',
  globalTeardown: './__tests__/teardown.js',
  setupFiles: ['./__tests__/env-setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
};
