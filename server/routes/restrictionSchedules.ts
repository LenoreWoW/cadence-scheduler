/**
 * Restriction Schedules — additional time-window restrictions scoped to a
 * single booking link. The public booking flow rejects slots outside the
 * (daysOfWeek, startHour..endHour) window. There is at most ONE schedule per
 * link; POST replaces the existing row.
 */

import { Router, Response, NextFunction, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

function assertOwnsLink(userId: string, linkId: string): void {
  const row = db.connection.prepare(
    `SELECT id FROM booking_links WHERE id = ? AND user_id = ?`
  ).get(linkId, userId) as any;
  if (!row) throw new AppError('Booking link not found', 404);
}

router.post('/links/:linkId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  assertOwnsLink(req.user!.userId, req.params.linkId);

  const { daysOfWeek, startHour, endHour } = req.body ?? {};
  if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
    throw new AppError('daysOfWeek must be a non-empty array', 400);
  }
  for (const d of daysOfWeek) {
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      throw new AppError('daysOfWeek values must be integers 0-6', 400);
    }
  }
  const sh = Number(startHour);
  const eh = Number(endHour);
  if (!Number.isInteger(sh) || sh < 0 || sh > 23) throw new AppError('Invalid startHour', 400);
  if (!Number.isInteger(eh) || eh < 1 || eh > 24 || eh <= sh) throw new AppError('Invalid endHour', 400);

  // Replace any existing schedule for this link.
  db.connection.prepare(`DELETE FROM restriction_schedules WHERE booking_link_id = ?`).run(req.params.linkId);
  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO restriction_schedules (id, booking_link_id, days_of_week, start_hour, end_hour)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.params.linkId, JSON.stringify(daysOfWeek), sh, eh);

  res.status(201).json({ id, daysOfWeek, startHour: sh, endHour: eh });
}));

router.get('/links/:linkId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  assertOwnsLink(req.user!.userId, req.params.linkId);
  const row = db.connection.prepare(`
    SELECT id, days_of_week, start_hour, end_hour, created_at
    FROM restriction_schedules WHERE booking_link_id = ?
  `).get(req.params.linkId) as any;
  if (!row) return res.json(null);
  let days: number[] = [];
  try { days = JSON.parse(row.days_of_week || '[]'); } catch {}
  res.json({
    id: row.id,
    daysOfWeek: days,
    startHour: row.start_hour,
    endHour: row.end_hour,
    createdAt: row.created_at,
  });
}));

router.delete('/links/:linkId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  assertOwnsLink(req.user!.userId, req.params.linkId);
  db.connection.prepare(`DELETE FROM restriction_schedules WHERE booking_link_id = ?`).run(req.params.linkId);
  res.json({ success: true });
}));

export default router;
