/**
 * Date Overrides — per-date availability tweaks. Public booking flow consults
 * the override for (host_id, date) before falling back to normal availability.
 */

import { Router, Response, NextFunction, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validHour(h: any): number | null {
  if (h === undefined || h === null) return null;
  const n = Number(h);
  if (!Number.isInteger(n) || n < 0 || n > 24) {
    throw new AppError('Invalid hour value', 400);
  }
  return n;
}

// Upsert by (user, date) — table has unique index on (user_id, date)
router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { date, startHour, endHour, available, note } = req.body ?? {};
  if (typeof date !== 'string' || !DATE_RE.test(date)) {
    throw new AppError('Invalid date (YYYY-MM-DD required)', 400);
  }
  const sh = validHour(startHour);
  const eh = validHour(endHour);
  if (sh !== null && eh !== null && eh <= sh) {
    throw new AppError('endHour must be greater than startHour', 400);
  }
  const isAvailable = available === undefined ? 1 : (available ? 1 : 0);
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 500)) {
    throw new AppError('note must be a string up to 500 characters', 400);
  }

  const existing = db.connection.prepare(
    `SELECT id FROM date_overrides WHERE user_id = ? AND date = ?`
  ).get(req.user!.userId, date) as any;

  if (existing) {
    db.connection.prepare(`
      UPDATE date_overrides SET
        start_hour = ?, end_hour = ?, available = ?, note = ?
      WHERE id = ?
    `).run(sh, eh, isAvailable, note ?? null, existing.id);
    return res.json({ id: existing.id, date, startHour: sh, endHour: eh, available: !!isAvailable, note: note ?? null, updated: true });
  }

  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO date_overrides (id, user_id, date, start_hour, end_hour, available, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user!.userId, date, sh, eh, isAvailable, note ?? null);

  res.status(201).json({ id, date, startHour: sh, endHour: eh, available: !!isAvailable, note: note ?? null });
}));

// List overrides within a range — default next 90 days
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
  const defaultTo = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = (req.query.to as string) || defaultTo;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    throw new AppError('Invalid date range', 400);
  }
  const rows = db.connection.prepare(`
    SELECT id, date, start_hour, end_hour, available, note, created_at
    FROM date_overrides
    WHERE user_id = ? AND date >= ? AND date <= ?
    ORDER BY date ASC
  `).all(req.user!.userId, from, to) as any[];

  res.json(rows.map(r => ({
    id: r.id,
    date: r.date,
    startHour: r.start_hour,
    endHour: r.end_hour,
    available: !!r.available,
    note: r.note,
    createdAt: r.created_at,
  })));
}));

// Delete
router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = db.connection.prepare(
    `DELETE FROM date_overrides WHERE id = ? AND user_id = ?`
  ).run(req.params.id, req.user!.userId);
  if (result.changes === 0) throw new AppError('Override not found', 404);
  res.json({ success: true });
}));

export default router;
