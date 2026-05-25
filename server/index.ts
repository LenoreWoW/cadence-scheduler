/**
 * Cadence - Backend Server
 * Express.js + SQLite + JWT Authentication
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { db } from './database';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import meetingRoutes from './routes/meetings';
import teamRoutes from './routes/teams';
import emailRoutes from './routes/email';
import bookingLinkRoutes from './routes/bookingLinks';
import analyticsRoutes from './routes/analytics';
import leaderboardRoutes from './routes/leaderboard';
import roundRobinRoutes from './routes/roundRobin';
import calendarRoutes from './routes/calendar';
import { initReminderScheduler } from './jobs/reminderScheduler';
import { initCalendarSyncScheduler } from './jobs/calendarSyncJob';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Security Middleware — Helmet with explicit CSP for the API
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", FRONTEND_URL],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    // OAuth redirect flows need COEP disabled so external providers can render in the browser.
    crossOriginEmbedderPolicy: false,
  })
);

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));

// Global rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Login (stricter)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);

// Register (stricter still — open endpoint, prevent account flooding)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registration attempts. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/register', registerLimiter);

// Body Parsing
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));
app.use(cookieParser());

// Request Logging
app.use(requestLogger);

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/booking-links', bookingLinkRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/round-robin', roundRobinRoutes);
app.use('/api/calendar', calendarRoutes);

// 404 Handler
app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use(errorHandler);

async function startServer() {
  try {
    await db.initialize();
    console.log('✅ Database initialized');

    initReminderScheduler();
    initCalendarSyncScheduler();

    app.listen(PORT, () => {
      console.log(`🚀 Cadence server running on port ${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
