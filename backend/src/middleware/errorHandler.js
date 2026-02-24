const AppError = require('../lib/AppError');

function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    console.error(`[${req.method} ${req.path}]`, err.message);
    const body = { error: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  // Prisma errors
  if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found.' });
  if (err.code === 'P2002') return res.status(409).json({ error: 'Duplicate record.' });
  if (err.code === 'P2003') return res.status(400).json({ error: 'Referenced record does not exist.' });

  // Unexpected errors — log full stack trace
  console.error(`[${req.method} ${req.path}] Unexpected error:`, err);

  return res.status(500).json({ error: 'An unexpected error occurred.' });
}

module.exports = errorHandler;
