/**
 * Travel Schedules — track periods when a user is in a different timezone so
 * the public booking page can label slot times in their "current" tz. Same
 * CRUD pattern as OOO.
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

function validateTimezone(tz: string): void {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 80) {
    throw new AppError('Invalid timezone', 400);
  }
  try {
    // Intl throws RangeError on unknown IANA tz strings.
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
  } catch {
    throw new AppError(`Unknown timezone: ${tz}`, 400);
  }
}

router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { startDate, endDate, timezone, note } = req.body ?? {};
  if (typeof startDate !== 'string' || !DATE_RE.test(startDate)) {
    throw new AppError('Invalid startDate', 400);
  }
  if (typeof endDate !== 'string' || !DATE_RE.test(endDate)) {
    throw new AppError('Invalid endDate', 400);
  }
  if (new Date(`${endDate}T00:00:00Z`) < new Date(`${startDate}T00:00:00Z`)) {
    throw new AppError('endDate must be on or after startDate', 400);
  }
  validateTimezone(timezone);
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 500)) {
    throw new AppError('note must be a string up to 500 characters', 400);
  }

  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO travel_schedules (id, user_id, start_date, end_date, timezone, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.user!.userId, startDate, endDate, timezone, note ?? null);

  res.status(201).json({ id, startDate, endDate, timezone, note: note ?? null });
}));

router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.connection.prepare(`
    SELECT id, start_date, end_date, timezone, note, created_at
    FROM travel_schedules
    WHERE user_id = ? AND end_date >= ?
    ORDER BY start_date ASC
  `).all(req.user!.userId, today) as any[];

  res.json(rows.map(r => ({
    id: r.id,
    startDate: r.start_date,
    endDate: r.end_date,
    timezone: r.timezone,
    note: r.note,
    createdAt: r.created_at,
  })));
}));

router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = db.connection.prepare(
    `DELETE FROM travel_schedules WHERE id = ? AND user_id = ?`
  ).run(req.params.id, req.user!.userId);
  if (result.changes === 0) throw new AppError('Travel schedule not found', 404);
  res.json({ success: true });
}));

/**
 * Helper for the booking flow: returns the user's effective timezone on the
 * given date. If a travel_schedules row covers `date`, that wins; otherwise
 * we return the user's default timezone column.
 */
export function getActiveTimezone(userId: string, dateYYYYMMDD: string): string | null {
  try {
    const travel = db.connection.prepare(`
      SELECT timezone FROM travel_schedules
      WHERE user_id = ? AND start_date <= ? AND end_date >= ?
      ORDER BY created_at DESC LIMIT 1
    `).get(userId, dateYYYYMMDD, dateYYYYMMDD) as any;
    if (travel?.timezone) return travel.timezone;
    const user = db.connection.prepare(`SELECT timezone FROM users WHERE id = ?`).get(userId) as any;
    return user?.timezone || null;
  } catch {
    return null;
  }
}

export default router;
