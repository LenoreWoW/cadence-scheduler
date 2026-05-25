/**
 * Out-of-Office periods. Each user can have multiple overlapping periods. The
 * public booking endpoint queries getActiveOOO before slot allocation; if a
 * delegate is set, bookings get re-routed; otherwise the slot is refused.
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

router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { startDate, endDate, delegateUserId, note } = req.body ?? {};
  if (typeof startDate !== 'string' || !DATE_RE.test(startDate)) {
    throw new AppError('Invalid startDate (YYYY-MM-DD)', 400);
  }
  if (typeof endDate !== 'string' || !DATE_RE.test(endDate)) {
    throw new AppError('Invalid endDate (YYYY-MM-DD)', 400);
  }
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  if (end < start) {
    throw new AppError('endDate must be on or after startDate', 400);
  }
  const days = Math.floor((end - start) / (24 * 60 * 60 * 1000));
  if (days > 90) {
    throw new AppError('OOO periods are capped at 90 days', 400);
  }
  if (delegateUserId !== undefined && delegateUserId !== null) {
    if (typeof delegateUserId !== 'string') {
      throw new AppError('Invalid delegateUserId', 400);
    }
    if (delegateUserId === req.user!.userId) {
      throw new AppError('Delegate cannot be yourself', 400);
    }
    const delegate = db.connection.prepare(`SELECT id FROM users WHERE id = ?`).get(delegateUserId) as any;
    if (!delegate) throw new AppError('Delegate user not found', 400);
  }
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 500)) {
    throw new AppError('note must be a string up to 500 characters', 400);
  }

  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO ooo_periods (id, user_id, start_date, end_date, delegate_user_id, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.user!.userId, startDate, endDate, delegateUserId ?? null, note ?? null);

  res.status(201).json({ id, startDate, endDate, delegateUserId: delegateUserId ?? null, note: note ?? null });
}));

router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.connection.prepare(`
    SELECT o.id, o.start_date, o.end_date, o.delegate_user_id, o.note, o.created_at,
           u.name as delegate_name
    FROM ooo_periods o
    LEFT JOIN users u ON o.delegate_user_id = u.id
    WHERE o.user_id = ? AND o.end_date >= ?
    ORDER BY o.start_date ASC
  `).all(req.user!.userId, today) as any[];

  res.json(rows.map(r => ({
    id: r.id,
    startDate: r.start_date,
    endDate: r.end_date,
    delegateUserId: r.delegate_user_id,
    delegateName: r.delegate_name,
    note: r.note,
    createdAt: r.created_at,
  })));
}));

router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = db.connection.prepare(
    `DELETE FROM ooo_periods WHERE id = ? AND user_id = ?`
  ).run(req.params.id, req.user!.userId);
  if (result.changes === 0) throw new AppError('OOO period not found', 404);
  res.json({ success: true });
}));

// Public-ish helper for the booking endpoint: returns active OOO row + delegate
// info (if any) for the given user at "today". Uses today's date in UTC; for
// OOO purposes the off-by-one across timezones is acceptable.
router.get('/active/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const today = new Date().toISOString().slice(0, 10);
  const row = db.connection.prepare(`
    SELECT o.id, o.start_date, o.end_date, o.delegate_user_id, o.note,
           u.id as delegate_id, u.name as delegate_name
    FROM ooo_periods o
    LEFT JOIN users u ON o.delegate_user_id = u.id
    WHERE o.user_id = ? AND o.start_date <= ? AND o.end_date >= ?
    ORDER BY o.created_at DESC
    LIMIT 1
  `).get(userId, today, today) as any;

  if (!row) return res.json({ active: false });

  res.json({
    active: true,
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    note: row.note,
    delegate: row.delegate_id ? { id: row.delegate_id, name: row.delegate_name } : null,
  });
}));

/**
 * Lookup helper used by other routes. Returns the active OOO row (with the
 * delegate joined) for the given userId on the given date, or null. Exported
 * so the public booking endpoint can re-route.
 */
export function getActiveOOO(userId: string, dateYYYYMMDD: string): {
  id: string;
  delegate: { id: string; name: string } | null;
} | null {
  const row = db.connection.prepare(`
    SELECT o.id, o.delegate_user_id, u.id as delegate_id, u.name as delegate_name
    FROM ooo_periods o
    LEFT JOIN users u ON o.delegate_user_id = u.id
    WHERE o.user_id = ? AND o.start_date <= ? AND o.end_date >= ?
    ORDER BY o.created_at DESC
    LIMIT 1
  `).get(userId, dateYYYYMMDD, dateYYYYMMDD) as any;
  if (!row) return null;
  return {
    id: row.id,
    delegate: row.delegate_id ? { id: row.delegate_id, name: row.delegate_name } : null,
  };
}

export default router;
