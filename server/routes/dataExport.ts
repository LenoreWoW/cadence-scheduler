/**
 * Data export & account deletion (GDPR-style helpers).
 *
 * - POST /export — returns a JSON dump of the caller's data.
 * - DELETE /account — soft-deletes the account by anonymizing PII and
 *   removing keys/tokens. The user is force-logged-out by clearing sessions.
 *   The `confirmEmail` body field must match the user's email to prevent
 *   accidental deletion.
 */

import { Router, Response, NextFunction, Request } from 'express';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

// POST /export — JSON dump
router.post('/export', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  const user = db.connection.prepare(`
    SELECT id, username, name, email, role, title, team_id, timezone, preferred_language, created_at
    FROM users WHERE id = ?
  `).get(userId) as any;
  if (!user) throw new AppError('User not found', 404);

  const meetings = db.connection.prepare(`
    SELECT * FROM meetings WHERE host_id = ? OR user_id = ?
  `).all(userId, userId);

  const bookingLinks = db.connection.prepare(`
    SELECT id, slug, title, description, is_active, created_at FROM booking_links WHERE user_id = ?
  `).all(userId);

  const calendarConnections = db.connection.prepare(`
    SELECT id, provider, calendar_name, sync_enabled, last_sync_at, created_at
    FROM calendar_connections WHERE user_id = ?
  `).all(userId);

  const notifications = db.connection.prepare(`
    SELECT id, type, title, body, read, created_at FROM notifications WHERE user_id = ?
  `).all(userId);

  const stats = db.connection.prepare(`SELECT * FROM user_stats WHERE user_id = ?`).get(userId);

  let achievements: any = null;
  if (stats && (stats as any).unlocked_achievements) {
    try { achievements = JSON.parse((stats as any).unlocked_achievements); } catch {}
  }

  res.json({
    exportedAt: new Date().toISOString(),
    user,
    meetings,
    bookingLinks,
    calendarConnections,
    notifications,
    userStats: stats,
    achievements,
  });
}));

// DELETE /account — anonymize and invalidate sessions
router.delete('/account', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { confirmEmail } = req.body ?? {};

  const user = db.connection.prepare(`SELECT email FROM users WHERE id = ?`).get(userId) as any;
  if (!user) throw new AppError('User not found', 404);

  if (typeof confirmEmail !== 'string' || confirmEmail.toLowerCase() !== (user.email || '').toLowerCase()) {
    throw new AppError('confirmEmail must match your account email', 400);
  }

  const txn = db.connection.transaction(() => {
    // Anonymize user
    db.connection.prepare(`
      UPDATE users SET
        email = NULL,
        name = 'Deleted User',
        avatar = NULL,
        title = NULL,
        ical_feed_token = NULL,
        email_verification_token = NULL,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(userId);

    // Delete tokens / connections
    db.connection.prepare(`DELETE FROM calendar_connections WHERE user_id = ?`).run(userId);
    db.connection.prepare(`DELETE FROM booking_links WHERE user_id = ?`).run(userId);
    db.connection.prepare(`DELETE FROM api_tokens WHERE user_id = ?`).run(userId);
    db.connection.prepare(`DELETE FROM outbound_webhooks WHERE user_id = ?`).run(userId);
    db.connection.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);

    // Anonymize meetings authored by this user
    db.connection.prepare(`
      UPDATE meetings SET
        attendee_name = 'Anonymized',
        attendee_email = '',
        notes = NULL,
        additional_attendees = NULL
      WHERE host_id = ? OR user_id = ?
    `).run(userId, userId);
  });
  txn();

  res.json({ success: true, message: 'Account anonymized. You have been logged out.' });
}));

export default router;
