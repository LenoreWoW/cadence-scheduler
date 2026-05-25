/**
 * Blocked Emails — per-user denylist for the public booking flow. Supports
 * exact emails and domain-wildcard patterns ("*@example.com" or "example.com").
 */

import { Router, Response, NextFunction, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+)$/;
const WILDCARD_RE = /^\*@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+)$/;

function normalizePattern(p: string): string {
  return p.trim().toLowerCase();
}

function validatePattern(p: any): string {
  if (typeof p !== 'string') throw new AppError('Invalid pattern', 400);
  const norm = normalizePattern(p);
  if (norm.length === 0 || norm.length > 254) throw new AppError('Invalid pattern length', 400);
  if (EMAIL_RE.test(norm)) return norm;
  if (WILDCARD_RE.test(norm)) return norm;
  if (DOMAIN_RE.test(norm)) return norm;
  throw new AppError('Pattern must be an email, *@domain, or domain.tld', 400);
}

router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { pattern, reason } = req.body ?? {};
  const normalized = validatePattern(pattern);
  if (reason !== undefined && reason !== null && (typeof reason !== 'string' || reason.length > 500)) {
    throw new AppError('reason must be a string up to 500 characters', 400);
  }

  // Reject duplicates for the same user/pattern.
  const existing = db.connection.prepare(
    `SELECT id FROM blocked_emails WHERE user_id = ? AND pattern = ?`
  ).get(req.user!.userId, normalized) as any;
  if (existing) {
    return res.status(409).json({ error: 'Pattern already blocked', id: existing.id });
  }

  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO blocked_emails (id, user_id, pattern, reason) VALUES (?, ?, ?, ?)
  `).run(id, req.user!.userId, normalized, reason ?? null);

  res.status(201).json({ id, pattern: normalized, reason: reason ?? null });
}));

router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rows = db.connection.prepare(`
    SELECT id, pattern, reason, created_at
    FROM blocked_emails WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.user!.userId) as any[];

  res.json(rows.map(r => ({
    id: r.id,
    pattern: r.pattern,
    reason: r.reason,
    createdAt: r.created_at,
  })));
}));

router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = db.connection.prepare(
    `DELETE FROM blocked_emails WHERE id = ? AND user_id = ?`
  ).run(req.params.id, req.user!.userId);
  if (result.changes === 0) throw new AppError('Block not found', 404);
  res.json({ success: true });
}));

/**
 * Checks whether `attendeeEmail` is blocked for the given host. Handles both
 * exact email matches and domain-wildcard patterns ("*@example.com" or
 * "example.com"). Returns false on any failure so blocking never causes a
 * legitimate booking to silently fail.
 */
export function isBlocked(userId: string, attendeeEmail: string): boolean {
  if (!userId || typeof attendeeEmail !== 'string') return false;
  const target = attendeeEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(target)) return false;
  const domain = target.split('@')[1];

  try {
    const rows = db.connection.prepare(
      `SELECT pattern FROM blocked_emails WHERE user_id = ?`
    ).all(userId) as any[];
    for (const r of rows) {
      const p = String(r.pattern || '').toLowerCase();
      if (!p) continue;
      if (p === target) return true;
      if (p.startsWith('*@') && p.slice(2) === domain) return true;
      if (!p.includes('@') && p === domain) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export default router;
