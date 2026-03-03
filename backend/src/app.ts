import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import config from './config';
import pinoHttp from 'pino-http';
import logger from './logger';
import { requireAuth } from './middleware/auth';
import errorHandler from './middleware/errorHandler';

import cyclesRouter from './routes/cycles';
import gridRouter from './routes/grid';
import bookingsRouter from './routes/bookings';
import contactsRouter from './routes/contacts';
import registrationRouter from './routes/registration';
import analyticsRouter from './routes/analytics';
import authRouter from './routes/auth';

const app = express();

// Security headers
app.use(helmet());

// CORS — restrict origins based on environment
const allowedOrigins =
  config.nodeEnv === 'production'
    ? ([process.env['FRONTEND_URL']].filter(Boolean) as string[])
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

// Request logging (skip health checks)
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === '/api/health' },
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        };
      },
    },
  }),
);

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
app.get('/api/health', (_req: Request, res: Response) => {
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

export = app;
