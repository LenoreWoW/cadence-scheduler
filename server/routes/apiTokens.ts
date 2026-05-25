/**
 * Personal Access Tokens (PATs) — user-issued long-lived tokens that work
 * as a Bearer alternative to JWT. The raw token is shown ONCE on creation;
 * we store only the SHA-256 hash. The shared `authenticateToken` middleware
 * accepts both JWTs and PATs.
 */

import { Router, Response, NextFunction, Request } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest, hashPat } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

// POST / — generate a new token
router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, scopes, expiresAt } = req.body ?? {};
  if (typeof name !== 'string' || name.length === 0 || name.length > 100) {
    throw new AppError('Invalid name', 400);
  }
  let scopesJson = '[]';
  if (scopes !== undefined) {
    if (!Array.isArray(scopes) || scopes.length > 20) throw new AppError('Invalid scopes', 400);
    for (const s of scopes) {
      if (typeof s !== 'string' || s.length === 0 || s.length > 60) throw new AppError('Invalid scope', 400);
    }
    scopesJson = JSON.stringify(scopes);
  }
  if (expiresAt !== undefined && expiresAt !== null) {
    if (typeof expiresAt !== 'string' || isNaN(new Date(expiresAt).getTime())) {
      throw new AppError('Invalid expiresAt', 400);
    }
  }

  // 48-hex = 24 bytes. Prefix marks it as a PAT for the middleware.
  const rawSecret = crypto.randomBytes(24).toString('hex');
  const token = `cad_pat_${rawSecret}`;
  const tokenHash = hashPat(token);

  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO api_tokens (id, user_id, name, token_hash, scopes, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.user!.userId, name, tokenHash, scopesJson, expiresAt || null);

  res.status(201).json({
    id,
    name,
    token, // shown ONCE — caller must save it
    scopes: JSON.parse(scopesJson),
    expiresAt: expiresAt || null,
    createdAt: new Date().toISOString(),
  });
}));

// GET / — list (without token value)
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rows = db.connection.prepare(`
    SELECT id, name, scopes, last_used_at, expires_at, created_at
    FROM api_tokens WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.user!.userId) as any[];
  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    scopes: JSON.parse(r.scopes || '[]'),
    lastUsedAt: r.last_used_at,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  })));
}));

// DELETE /:id — revoke
router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = db.connection.prepare(
    `DELETE FROM api_tokens WHERE id = ? AND user_id = ?`
  ).run(req.params.id, req.user!.userId);
  if (result.changes === 0) throw new AppError('Token not found', 404);
  res.json({ success: true });
}));

export default router;
