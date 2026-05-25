/**
 * Common Schedules — saved availability presets a user can attach to one or
 * more booking links. Mirrors the user_availability shape so the public booking
 * flow can swap in a preset without changing its math.
 */

import { Router, Response, NextFunction, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

interface AvailabilityShape {
  startHour: number;
  endHour: number;
  slotDuration: number;
  bufferMinutes: number;
  minNoticeMinutes: number;
  days: number[];
  timeOff: any[];
}

function validateAvailability(av: any): AvailabilityShape {
  if (!av || typeof av !== 'object') {
    throw new AppError('availability is required', 400);
  }
  const startHour = Number(av.startHour);
  const endHour = Number(av.endHour);
  const slotDuration = Number(av.slotDuration);
  const bufferMinutes = Number(av.bufferMinutes ?? 0);
  const minNoticeMinutes = Number(av.minNoticeMinutes ?? 120);
  if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
    throw new AppError('Invalid startHour', 400);
  }
  if (!Number.isInteger(endHour) || endHour < 1 || endHour > 24 || endHour <= startHour) {
    throw new AppError('Invalid endHour', 400);
  }
  if (![5, 10, 15, 20, 30, 45, 60, 90, 120].includes(slotDuration)) {
    throw new AppError('Invalid slotDuration', 400);
  }
  if (!Number.isInteger(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 240) {
    throw new AppError('Invalid bufferMinutes', 400);
  }
  if (!Number.isInteger(minNoticeMinutes) || minNoticeMinutes < 0 || minNoticeMinutes > 60 * 24 * 14) {
    throw new AppError('Invalid minNoticeMinutes', 400);
  }
  const days = Array.isArray(av.days) ? av.days : [];
  if (!days.every((d: any) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    throw new AppError('Invalid days array', 400);
  }
  const timeOff = Array.isArray(av.timeOff) ? av.timeOff : [];
  if (timeOff.length > 100) {
    throw new AppError('timeOff entries capped at 100', 400);
  }
  return { startHour, endHour, slotDuration, bufferMinutes, minNoticeMinutes, days, timeOff };
}

// List my saved schedules
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rows = db.connection.prepare(`
    SELECT id, name, availability, is_default, created_at
    FROM common_schedules WHERE user_id = ?
    ORDER BY is_default DESC, created_at DESC
  `).all(req.user!.userId) as any[];

  res.json(rows.map(r => {
    let availability: any = null;
    try { availability = JSON.parse(r.availability); } catch {}
    return {
      id: r.id,
      name: r.name,
      availability,
      isDefault: !!r.is_default,
      createdAt: r.created_at,
    };
  }));
}));

// Create a saved schedule
router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, availability } = req.body ?? {};
  if (typeof name !== 'string' || name.length < 1 || name.length > 100) {
    throw new AppError('name must be 1-100 characters', 400);
  }
  const av = validateAvailability(availability);

  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO common_schedules (id, user_id, name, availability, is_default)
    VALUES (?, ?, ?, ?, 0)
  `).run(id, req.user!.userId, name, JSON.stringify(av));

  res.status(201).json({ id, name, availability: av, isDefault: false });
}));

// Update an existing schedule (owner)
router.put('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const existing = db.connection.prepare(`SELECT id FROM common_schedules WHERE id = ? AND user_id = ?`).get(req.params.id, req.user!.userId) as any;
  if (!existing) throw new AppError('Schedule not found', 404);

  const { name, availability } = req.body ?? {};
  if (name !== undefined && (typeof name !== 'string' || name.length < 1 || name.length > 100)) {
    throw new AppError('name must be 1-100 characters', 400);
  }
  let avJson: string | null = null;
  if (availability !== undefined) {
    const av = validateAvailability(availability);
    avJson = JSON.stringify(av);
  }

  db.connection.prepare(`
    UPDATE common_schedules SET
      name = COALESCE(?, name),
      availability = COALESCE(?, availability)
    WHERE id = ?
  `).run(name || null, avJson, req.params.id);

  res.json({ success: true });
}));

// Delete (owner)
router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = db.connection.prepare(
    `DELETE FROM common_schedules WHERE id = ? AND user_id = ?`
  ).run(req.params.id, req.user!.userId);
  if (result.changes === 0) throw new AppError('Schedule not found', 404);
  res.json({ success: true });
}));

// Mark as default — clears is_default on others
router.post('/:id/set-default', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const existing = db.connection.prepare(`SELECT id FROM common_schedules WHERE id = ? AND user_id = ?`).get(req.params.id, req.user!.userId) as any;
  if (!existing) throw new AppError('Schedule not found', 404);

  const tx = db.connection.transaction(() => {
    db.connection.prepare(`UPDATE common_schedules SET is_default = 0 WHERE user_id = ?`).run(req.user!.userId);
    db.connection.prepare(`UPDATE common_schedules SET is_default = 1 WHERE id = ?`).run(req.params.id);
  });
  tx();

  res.json({ success: true });
}));

export default router;
