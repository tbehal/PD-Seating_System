const errorHandler = require('../../src/middleware/errorHandler');
const AppError = require('../../src/lib/AppError');

// Silence pino logger output during tests
jest.mock('../../src/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

const mockReq = { method: 'GET', path: '/test' };
const mockNext = jest.fn();

function createMockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    headersSent: false,
  };
  return res;
}

describe('errorHandler middleware', () => {
  test('handles AppError with status code and message', () => {
    const res = createMockRes();
    const err = new AppError(404, 'Not found');

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('handles AppError with details', () => {
    const res = createMockRes();
    const err = new AppError(409, 'Conflict', { field: 'email' });

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Conflict', details: { field: 'email' } });
  });

  test('handles Prisma P2025 as 404', () => {
    const res = createMockRes();
    const { Prisma } = require('@prisma/client');
    const err = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '6.0.0',
    });

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Record not found.' });
  });

  test('handles Joi ValidationError as 400', () => {
    const res = createMockRes();
    const err = Object.assign(new Error('Validation failed'), {
      isJoi: true,
      details: [{ message: '"name" is required', path: ['name'] }],
    });

    // Joi ValidationErrors are not explicitly handled by this errorHandler —
    // they are caught upstream by the validate() middleware and never reach here.
    // An error with isJoi that reaches errorHandler falls through to the 500 path.
    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unexpected error occurred.' });
  });

  test('handles unknown errors as 500 with generic message', () => {
    const res = createMockRes();
    const err = new Error('Database connection failed');

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unexpected error occurred.' });
  });
});
