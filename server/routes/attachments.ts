/**
 * Meeting attachments — file uploads tied to a meeting record.
 *
 * To avoid pulling in multer (and the surrounding storage layer), files are
 * uploaded as base64 in JSON. Capped at 5MB. Access is gated to the meeting's
 * host, attendee (matched by user_id), or admin.
 */

import { Router, Response, NextFunction, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Body parser with a higher limit is wired in server/index.ts when this router
// is mounted (before the global tighter limit), so base64 file payloads pass.

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);
const ALLOWED_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'docx', 'xlsx', 'pptx', 'txt']);

function canAccessMeeting(userId: string, role: string, meetingId: string): { ok: boolean; meeting?: any } {
  const m = db.connection.prepare(
    `SELECT id, host_id, user_id, attendee_email FROM meetings WHERE id = ?`
  ).get(meetingId) as any;
  if (!m) return { ok: false };
  if (role === 'admin') return { ok: true, meeting: m };
  if (m.host_id === userId || m.user_id === userId) return { ok: true, meeting: m };
  return { ok: false, meeting: m };
}

// POST /meetings/:meetingId — upload a file
router.post('/meetings/:meetingId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { meetingId } = req.params;
  const { filename, contentType, data } = req.body ?? {};

  if (typeof filename !== 'string' || filename.length === 0 || filename.length > 255) {
    throw new AppError('Invalid filename', 400);
  }
  if (typeof contentType !== 'string' || !ALLOWED_TYPES.has(contentType)) {
    throw new AppError('Unsupported content type', 400);
  }
  if (typeof data !== 'string' || data.length === 0) {
    throw new AppError('Missing data (base64)', 400);
  }
  // Validate extension too — defense-in-depth against MIME spoofing.
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) throw new AppError('Unsupported file extension', 400);

  // Compute approximate size from base64 length: (len * 3/4) - padding.
  const pad = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  const sizeBytes = Math.floor((data.length * 3) / 4) - pad;
  if (sizeBytes > MAX_BYTES) throw new AppError('File exceeds 5MB limit', 400);

  const { ok } = canAccessMeeting(req.user!.userId, req.user!.role, meetingId);
  if (!ok) throw new AppError('Forbidden', 403);

  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO meeting_attachments (id, meeting_id, uploader_id, filename, size_bytes, content_type, data_base64)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, meetingId, req.user!.userId, filename, sizeBytes, contentType, data);

  res.status(201).json({ id, meetingId, filename, contentType, sizeBytes });
}));

// GET /meetings/:meetingId — list (no data payload)
router.get('/meetings/:meetingId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { meetingId } = req.params;
  const { ok } = canAccessMeeting(req.user!.userId, req.user!.role, meetingId);
  if (!ok) throw new AppError('Forbidden', 403);

  const rows = db.connection.prepare(`
    SELECT id, meeting_id, uploader_id, filename, size_bytes, content_type, created_at
    FROM meeting_attachments WHERE meeting_id = ?
    ORDER BY created_at DESC
  `).all(meetingId) as any[];
  res.json(rows.map(r => ({
    id: r.id,
    meetingId: r.meeting_id,
    uploaderId: r.uploader_id,
    filename: r.filename,
    sizeBytes: r.size_bytes,
    contentType: r.content_type,
    createdAt: r.created_at,
  })));
}));

// GET /:id/download — return the base64 payload
router.get('/:id/download', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const row = db.connection.prepare(
    `SELECT * FROM meeting_attachments WHERE id = ?`
  ).get(req.params.id) as any;
  if (!row) throw new AppError('Attachment not found', 404);

  const { ok } = canAccessMeeting(req.user!.userId, req.user!.role, row.meeting_id);
  if (!ok) throw new AppError('Forbidden', 403);

  res.json({
    id: row.id,
    filename: row.filename,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    data: row.data_base64,
  });
}));

// DELETE /:id — uploader or admin
router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const row = db.connection.prepare(
    `SELECT uploader_id FROM meeting_attachments WHERE id = ?`
  ).get(req.params.id) as any;
  if (!row) throw new AppError('Attachment not found', 404);
  if (row.uploader_id !== req.user!.userId && req.user!.role !== 'admin') {
    throw new AppError('Forbidden', 403);
  }
  db.connection.prepare(`DELETE FROM meeting_attachments WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
}));

export default router;
