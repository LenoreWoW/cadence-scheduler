/**
 * Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../database';

function resolveJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret.length > 0) {
    return envSecret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is required in production. ' +
      'Refusing to start with a hardcoded fallback secret.'
    );
  }
  // Dev only: generate an ephemeral per-process secret so tokens don't
  // survive restarts. Never commit a literal fallback.
  const ephemeral = crypto.randomBytes(48).toString('hex');
  console.warn(
    '[auth] JWT_SECRET not set — using an ephemeral per-process secret (dev only). ' +
    'Tokens will be invalidated on restart.'
  );
  // Make available to other modules that need to sign HMACs with the same key.
  process.env.JWT_SECRET = ephemeral;
  return ephemeral;
}

const JWT_SECRET = resolveJwtSecret();
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export function generateTokens(payload: JWTPayload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
  
  return { accessToken, refreshToken };
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Hash a Personal Access Token (PAT) for storage / lookup. We never store the
 * raw token — only its SHA-256 hash.
 */
export function hashPat(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Resolve a PAT (`cad_pat_…`) to a JWT-shaped payload. Returns null on
 * unknown/expired token. Updates `last_used_at` on success.
 */
function resolvePatToken(token: string): JWTPayload | null {
  if (!token.startsWith('cad_pat_')) return null;
  try {
    const tokenHash = hashPat(token);
    const row = db.connection.prepare(`
      SELECT t.id, t.user_id, t.expires_at, u.username, u.role
      FROM api_tokens t
      JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ?
    `).get(tokenHash) as any;
    if (!row) return null;
    if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
    // Update last_used_at — best-effort.
    try {
      db.connection.prepare(`UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?`).run(row.id);
    } catch {}
    return { userId: row.user_id, username: row.username, role: row.role };
  } catch {
    return null;
  }
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Accept either a JWT or a Personal Access Token. PATs are SHA-256 hashed
  // in the DB; JWTs are HS256-signed with JWT_SECRET. Try PAT first only if
  // it has the `cad_pat_` prefix — otherwise we'd waste a DB lookup on JWTs.
  let payload: JWTPayload | null = null;
  if (token.startsWith('cad_pat_')) {
    payload = resolvePatToken(token);
  } else {
    payload = verifyToken(token);
  }

  if (!payload) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  req.user = payload;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}

