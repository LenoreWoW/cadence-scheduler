/**
 * In-app notifications + per-user notification preferences.
 *
 * Notifications are short, durable records produced by other parts of the
 * system (booking requested, cancelled, rescheduled, sync failure) and shown
 * in the bell-icon dropdown. Preferences let users disable specific reminder
 * channels.
 */

import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// ---- Notifications ----

router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const unreadOnly = req.query.unread === 'true';
  const limit = Math.min(parseInt(String(req.query.limit ?? '50')) || 50, 200);

  const rows = db.connection.prepare(
    unreadOnly
      ? `SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC LIMIT ?`
      : `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
  ).all(userId, limit) as any[];

  const unreadCount = (db.connection.prepare(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0`
  ).get(userId) as any).count;

  res.json({
    unreadCount,
    notifications: rows.map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      link: r.link,
      read: !!r.read,
      createdAt: r.created_at,
    })),
  });
});

router.post('/:id/read', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = db.connection.prepare(
    `UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`
  ).run(req.params.id, userId);
  if (result.changes === 0) throw new AppError('Notification not found', 404);
  res.json({ success: true });
});

router.post('/read-all', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  db.connection.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`).run(userId);
  res.json({ success: true });
});

router.delete('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = db.connection.prepare(
    `DELETE FROM notifications WHERE id = ? AND user_id = ?`
  ).run(req.params.id, userId);
  if (result.changes === 0) throw new AppError('Notification not found', 404);
  res.json({ success: true });
});

// ---- Preferences ----

const DEFAULT_PREFS = {
  attendeeReminders: true,
  hostReminders: true,
  bookingApproved: true,
  bookingCancelled: true,
};

router.get('/prefs', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const row = db.connection.prepare(`SELECT * FROM notification_prefs WHERE user_id = ?`).get(userId) as any;
  if (!row) {
    return res.json(DEFAULT_PREFS);
  }
  res.json({
    attendeeReminders: !!row.attendee_reminders,
    hostReminders: !!row.host_reminders,
    bookingApproved: !!row.booking_approved,
    bookingCancelled: !!row.booking_cancelled,
  });
});

router.put('/prefs', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const incoming = req.body ?? {};

  const toBool = (v: unknown, key: keyof typeof DEFAULT_PREFS): number => {
    if (typeof v === 'boolean') return v ? 1 : 0;
    return DEFAULT_PREFS[key] ? 1 : 0;
  };

  const attendee = toBool(incoming.attendeeReminders, 'attendeeReminders');
  const host = toBool(incoming.hostReminders, 'hostReminders');
  const approved = toBool(incoming.bookingApproved, 'bookingApproved');
  const cancelled = toBool(incoming.bookingCancelled, 'bookingCancelled');

  db.connection.prepare(`
    INSERT INTO notification_prefs (user_id, attendee_reminders, host_reminders, booking_approved, booking_cancelled, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      attendee_reminders = excluded.attendee_reminders,
      host_reminders = excluded.host_reminders,
      booking_approved = excluded.booking_approved,
      booking_cancelled = excluded.booking_cancelled,
      updated_at = excluded.updated_at
  `).run(userId, attendee, host, approved, cancelled);

  res.json({
    attendeeReminders: !!attendee,
    hostReminders: !!host,
    bookingApproved: !!approved,
    bookingCancelled: !!cancelled,
  });
});

export default router;
