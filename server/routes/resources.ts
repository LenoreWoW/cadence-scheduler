/**
 * Resources — rooms / equipment / vehicles that can be booked alongside a meeting.
 *
 * CRUD restricted to admins and managers. Booking is open to any authenticated
 * user. Conflict-detected against `resource_bookings` for the same date.
 */

import { Router, Response, NextFunction, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

const adminOrManager = [authenticateToken, requireRole('admin', 'manager')];

const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// ============================================================================
// Resource CRUD
// ============================================================================

// POST / — create a resource
router.post('/', ...adminOrManager, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, type, location, capacity, ownerTeamId, description } = req.body ?? {};
  if (typeof name !== 'string' || name.length === 0 || name.length > 100) {
    throw new AppError('Name is required (1-100 chars)', 400);
  }
  const resourceType = typeof type === 'string' && type.length > 0 ? type : 'room';

  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO resources (id, name, type, location, capacity, description, owner_team_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id, name, resourceType, location || null,
    typeof capacity === 'number' ? capacity : null,
    description || null,
    ownerTeamId || null
  );
  res.status(201).json({ id, name, type: resourceType, location, capacity, ownerTeamId, isActive: true });
}));

// GET / — list active resources
router.get('/', authenticateToken, asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const rows = db.connection.prepare(`
    SELECT r.*, t.name as team_name
    FROM resources r
    LEFT JOIN teams t ON t.id = r.owner_team_id
    WHERE r.is_active = 1
    ORDER BY r.name ASC
  `).all() as any[];
  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    location: r.location,
    capacity: r.capacity,
    description: r.description,
    ownerTeamId: r.owner_team_id,
    ownerTeamName: r.team_name,
    isActive: !!r.is_active,
    createdAt: r.created_at,
  })));
}));

// PUT /:id — update
router.put('/:id', ...adminOrManager, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const existing = db.connection.prepare(`SELECT * FROM resources WHERE id = ?`).get(req.params.id) as any;
  if (!existing) throw new AppError('Resource not found', 404);
  const { name, type, location, capacity, description, ownerTeamId, isActive } = req.body ?? {};
  db.connection.prepare(`
    UPDATE resources SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      location = ?,
      capacity = ?,
      description = ?,
      owner_team_id = ?,
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    name || null,
    type || null,
    location !== undefined ? location : existing.location,
    capacity !== undefined ? capacity : existing.capacity,
    description !== undefined ? description : existing.description,
    ownerTeamId !== undefined ? ownerTeamId : existing.owner_team_id,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    req.params.id
  );
  res.json({ success: true });
}));

// DELETE /:id — soft delete
router.delete('/:id', ...adminOrManager, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = db.connection.prepare(`UPDATE resources SET is_active = 0 WHERE id = ?`).run(req.params.id);
  if (result.changes === 0) throw new AppError('Resource not found', 404);
  res.json({ success: true });
}));

// ============================================================================
// Booking endpoints
// ============================================================================

// POST /:id/book — create a booking
router.post('/:id/book', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { date, startTime, endTime, meetingId, purpose } = req.body ?? {};

  if (!DATE_RE.test(date || '')) throw new AppError('Invalid date (YYYY-MM-DD)', 400);
  if (!TIME_RE.test(startTime || '')) throw new AppError('Invalid startTime (HH:MM)', 400);
  if (!TIME_RE.test(endTime || '')) throw new AppError('Invalid endTime (HH:MM)', 400);

  const reqStart = toMinutes(startTime);
  const reqEnd = toMinutes(endTime);
  if (reqEnd <= reqStart) throw new AppError('endTime must be after startTime', 400);

  const resource = db.connection.prepare(`SELECT * FROM resources WHERE id = ? AND is_active = 1`).get(id) as any;
  if (!resource) throw new AppError('Resource not found', 404);

  // Conflict check — any overlap with existing booking for same resource/date.
  const overlaps = db.connection.prepare(`
    SELECT id, start_time, end_time FROM resource_bookings WHERE resource_id = ? AND date = ?
  `).all(id, date) as any[];
  const conflict = overlaps.some(o => {
    const s = toMinutes(o.start_time);
    const e = toMinutes(o.end_time);
    return reqStart < e && reqEnd > s;
  });
  if (conflict) throw new AppError('Resource is already booked for that time', 409);

  const bookingId = uuidv4();
  db.connection.prepare(`
    INSERT INTO resource_bookings (id, resource_id, meeting_id, user_id, date, start_time, end_time, purpose)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bookingId, id, meetingId || null, req.user!.userId,
    date, startTime, endTime, purpose || null
  );

  res.status(201).json({
    id: bookingId,
    resourceId: id,
    meetingId: meetingId || null,
    date, startTime, endTime,
    purpose: purpose || null,
  });
}));

// GET /:id/availability?date=YYYY-MM-DD — booked ranges
router.get('/:id/availability', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { date } = req.query;
  if (typeof date !== 'string' || !DATE_RE.test(date)) {
    throw new AppError('date query (YYYY-MM-DD) is required', 400);
  }
  const rows = db.connection.prepare(`
    SELECT id, start_time, end_time, user_id, meeting_id, purpose
    FROM resource_bookings WHERE resource_id = ? AND date = ?
    ORDER BY start_time ASC
  `).all(req.params.id, date) as any[];
  res.json({
    date,
    booked: rows.map(r => ({
      id: r.id,
      startTime: r.start_time,
      endTime: r.end_time,
      userId: r.user_id,
      meetingId: r.meeting_id,
      purpose: r.purpose,
    })),
  });
}));

// DELETE /bookings/:bookingId — cancel a booking (owner or admin)
router.delete('/bookings/:bookingId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const row = db.connection.prepare(
    `SELECT user_id FROM resource_bookings WHERE id = ?`
  ).get(req.params.bookingId) as any;
  if (!row) throw new AppError('Booking not found', 404);
  if (row.user_id !== req.user!.userId && req.user!.role !== 'admin') {
    throw new AppError('Forbidden', 403);
  }
  db.connection.prepare(`DELETE FROM resource_bookings WHERE id = ?`).run(req.params.bookingId);
  res.json({ success: true });
}));

export default router;
