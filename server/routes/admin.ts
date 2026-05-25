/**
 * Admin-only diagnostics + bulk operations.
 */

import { Router, Response, NextFunction, Request } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

const adminOnly = [authenticateToken, requireRole('admin')];

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

// GET /health — DB / app diagnostics
router.get('/health', ...adminOnly, asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  let pageCount = 0, pageSize = 0;
  try {
    pageCount = (db.connection.prepare(`PRAGMA page_count`).get() as any).page_count || 0;
    pageSize = (db.connection.prepare(`PRAGMA page_size`).get() as any).page_size || 0;
  } catch {}
  const dbSizeBytes = pageCount * pageSize;

  const tables = [
    'users', 'teams', 'meetings', 'booking_links', 'team_booking_links',
    'sessions', 'activity_logs', 'notifications',
    'departments', 'resources', 'resource_bookings',
    'meeting_attachments', 'outbound_webhooks', 'webhook_deliveries',
    'api_tokens', 'challenges', 'user_challenge_progress',
    'team_invitations', 'calendar_connections',
  ];
  const rowCounts: Record<string, number> = {};
  for (const t of tables) {
    try {
      const r = db.connection.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as any;
      rowCounts[t] = r.c;
    } catch {
      rowCounts[t] = -1; // table missing
    }
  }

  // Last reminder run — derive from the most recently set reminder_24h_sent / 1h_sent timestamps.
  let lastReminderRun: string | null = null;
  try {
    const r = db.connection.prepare(`
      SELECT MAX(reminder_24h_sent) as a, MAX(reminder_1h_sent) as b FROM meetings
    `).get() as any;
    const candidates = [r.a, r.b].filter(Boolean);
    if (candidates.length) {
      lastReminderRun = candidates.sort().reverse()[0];
    }
  } catch {}

  // Webhook status distribution (last 7 days)
  let webhookStatus: Record<string, number> = {};
  try {
    const rows = db.connection.prepare(`
      SELECT
        CASE
          WHEN status_code >= 200 AND status_code < 300 THEN 'success'
          WHEN status_code >= 300 AND status_code < 500 THEN 'client_error'
          WHEN status_code >= 500 THEN 'server_error'
          ELSE 'no_response'
        END as bucket,
        COUNT(*) as c
      FROM webhook_deliveries
      WHERE delivered_at >= datetime('now', '-7 days')
      GROUP BY bucket
    `).all() as any[];
    for (const r of rows) webhookStatus[r.bucket] = r.c;
  } catch {}

  res.json({
    timestamp: new Date().toISOString(),
    db: {
      sizeBytes: dbSizeBytes,
      pageCount,
      pageSize,
    },
    rowCounts,
    lastReminderRun,
    schedulerStatus: 'running', // best-effort signal — present implies the process is alive.
    webhookStatusLast7Days: webhookStatus,
  });
}));

// POST /users/bulk-import — admin-only, creates users with temp password + reset token.
router.post('/users/bulk-import', ...adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { users } = req.body ?? {};
  if (!Array.isArray(users) || users.length === 0) throw new AppError('users array required', 400);
  if (users.length > 500) throw new AppError('Max 500 users per import', 400);

  const results: any[] = [];

  for (const u of users) {
    const { name, username, email, role, teamId } = u ?? {};
    try {
      if (typeof name !== 'string' || name.length < 1 || name.length > 100) throw new Error('Invalid name');
      if (typeof username !== 'string' || !USERNAME_RE.test(username)) throw new Error('Invalid username');
      if (!['admin', 'manager', 'subordinate', 'guest'].includes(role)) throw new Error('Invalid role');

      const exists = db.connection.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
      if (exists) throw new Error('Username taken');

      const tempPwd = crypto.randomBytes(12).toString('base64').replace(/[/+=]/g, '').slice(0, 16);
      const passwordHash = await bcrypt.hash(tempPwd, 12);
      const userId = uuidv4();
      const resetToken = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
      const resetExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const txn = db.connection.transaction(() => {
        db.connection.prepare(`
          INSERT INTO users (id, username, password_hash, name, email, role, team_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, username, passwordHash, name, email || null, role, teamId || null);
        db.connection.prepare(`
          INSERT INTO user_availability (id, user_id) VALUES (?, ?)
        `).run(uuidv4(), userId);
        db.connection.prepare(`
          INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)
        `).run(resetToken, userId, resetExpiry);
      });
      txn();

      results.push({
        username,
        success: true,
        userId,
        tempPassword: tempPwd,
        resetToken,
      });
    } catch (e: any) {
      results.push({ username: username || '(unknown)', success: false, error: e?.message || 'failed' });
    }
  }

  res.json({
    total: users.length,
    successCount: results.filter(r => r.success).length,
    failureCount: results.filter(r => !r.success).length,
    results,
  });
}));

export default router;
