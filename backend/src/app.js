const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { requireAuth } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const cyclesRouter = require('./routes/cycles');
const gridRouter = require('./routes/grid');
const bookingsRouter = require('./routes/bookings');
const contactsRouter = require('./routes/contacts');
const registrationRouter = require('./routes/registration');
const analyticsRouter = require('./routes/analytics');
const authRouter = require('./routes/auth');

const app = express();

// Security headers
app.use(helmet());

// CORS — restrict origins based on environment
const allowedOrigins =
  config.nodeEnv === 'production'
    ? [process.env.FRONTEND_URL].filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

// Body parsing + cookies
app.use(express.json());
app.use(cookieParser());

// Rate limiters (skip in test environment)
if (config.nodeEnv !== 'test') {
  app.use(
    '/api/',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please try again later.' },
    }),
  );

  app.use(
    '/api/v1/availability/contacts',
    rateLimit({
      windowMs: 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'HubSpot rate limit protection. Please wait a moment.' },
    }),
  );
}

// Public routes (no auth required)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);

// Protected routes — versioned under /api/v1
const v1 = express.Router();
v1.use('/cycles', cyclesRouter);
v1.use('/cycles', registrationRouter);
v1.use('/availability', gridRouter);
v1.use('/availability', bookingsRouter);
v1.use('/availability', contactsRouter);
v1.use('/analytics', analyticsRouter);
app.use('/api/v1', requireAuth, v1);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
