/**
 * Team invitations — invite-link flow for adding members to a team.
 *
 * Authed surface: admins or team leaders create / list / revoke invitations.
 * Public surface: invitee opens the tokenized link, sees who invited them,
 * and either accepts (creates a user, joins the team) or ignores.
 */

import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest, generateTokens } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { getEmailProvider } from '../services/emailProvider';
import { t as i18n, getPreferredLanguageByEmail, dirFor } from '../services/multiLangEmail';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const NAME_MIN = 1, NAME_MAX = 100;
const PWD_MIN = 8, PWD_MAX = 128;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

function canManageTeam(userId: string, teamId: string, role: string): boolean {
  if (role === 'admin') return true;
  const team = db.connection.prepare(`SELECT leader_id FROM teams WHERE id = ?`).get(teamId) as any;
  return !!team && team.leader_id === userId;
}

// ============================================================================
// Authed CRUD
// ============================================================================

// POST / — create an invitation
router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { teamId, email, role } = req.body ?? {};
  if (typeof teamId !== 'string' || !teamId) throw new AppError('teamId is required', 400);
  if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) {
    throw new AppError('Valid email is required', 400);
  }
  const invitedRole = role && ['manager', 'subordinate', 'guest'].includes(role) ? role : 'subordinate';

  if (!canManageTeam(req.user!.userId, teamId, req.user!.role)) {
    throw new AppError('You can only invite members to teams you lead', 403);
  }

  const team = db.connection.prepare(`SELECT id, name FROM teams WHERE id = ?`).get(teamId) as any;
  if (!team) throw new AppError('Team not found', 404);

  const token = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.connection.prepare(`
    INSERT INTO team_invitations (token, team_id, email, role, invited_by, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(token, teamId, email.toLowerCase(), invitedRole, req.user!.userId, expiresAt);

  // Best-effort email
  try {
    const provider = getEmailProvider();
    const url = `${FRONTEND_URL}/accept-invite?token=${encodeURIComponent(token)}`;
    const lang = getPreferredLanguageByEmail(email);
    const subject = i18n(lang, 'team_invitation', { team: team.name });
    const dir = dirFor(lang);
    const html = `<!DOCTYPE html><html dir="${dir}"><body style="margin:0;padding:20px;background:#f5f5f5;font-family:-apple-system,'Segoe UI',sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;">
        <div style="background:#8A1538;color:white;padding:30px;text-align:center;"><h1 style="margin:0;font-size:22px;">${subject}</h1></div>
        <div style="padding:30px;color:#1a1a1a;">
          <p>${i18n(lang, 'team_invitation', { team: team.name })}</p>
          <p><a href="${url}" style="display:inline-block;padding:12px 24px;background:#8A1538;color:white;text-decoration:none;border-radius:6px;">Accept invitation</a></p>
          <p style="color:#666;font-size:13px;">This link expires in 7 days.</p>
        </div>
      </div>
    </body></html>`;
    await provider.send({
      to: email,
      subject,
      html,
      text: `${subject}: ${url}`,
    });
  } catch (e) {
    console.error('Failed to send invite email:', e);
  }

  res.status(201).json({ token, teamId, email, role: invitedRole, expiresAt });
}));

// GET /team/:teamId — list pending invitations for the team
router.get('/team/:teamId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { teamId } = req.params;
  if (!canManageTeam(req.user!.userId, teamId, req.user!.role)) {
    throw new AppError('You can only view invitations for teams you lead', 403);
  }
  const rows = db.connection.prepare(`
    SELECT token, team_id, email, role, invited_by, expires_at, accepted, created_at
    FROM team_invitations
    WHERE team_id = ? AND accepted = 0
    ORDER BY created_at DESC
  `).all(teamId) as any[];
  res.json(rows.map(r => ({
    token: r.token,
    teamId: r.team_id,
    email: r.email,
    role: r.role,
    invitedBy: r.invited_by,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  })));
}));

// DELETE /:token — revoke an invitation
router.delete('/:token', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const row = db.connection.prepare(
    `SELECT team_id FROM team_invitations WHERE token = ?`
  ).get(req.params.token) as any;
  if (!row) throw new AppError('Invitation not found', 404);
  if (!canManageTeam(req.user!.userId, row.team_id, req.user!.role)) {
    throw new AppError('You can only revoke invitations for teams you lead', 403);
  }
  db.connection.prepare(`DELETE FROM team_invitations WHERE token = ?`).run(req.params.token);
  res.json({ success: true });
}));

// ============================================================================
// Public — invitee surface
// ============================================================================

// GET /public/:token — return the public-safe summary
router.get('/public/:token', asyncHandler(async (req: Request, res: Response) => {
  const row = db.connection.prepare(`
    SELECT ti.*, t.name as team_name
    FROM team_invitations ti
    JOIN teams t ON t.id = ti.team_id
    WHERE ti.token = ?
  `).get(req.params.token) as any;

  if (!row) return res.json({ valid: false });
  if (row.accepted) return res.json({ valid: false, reason: 'accepted' });
  if (new Date(row.expires_at) < new Date()) return res.json({ valid: false, reason: 'expired' });

  res.json({
    valid: true,
    email: row.email,
    teamName: row.team_name,
    expiresAt: row.expires_at,
  });
}));

// POST /public/:token/accept — create the user and join the team
router.post('/public/:token/accept', asyncHandler(async (req: Request, res: Response) => {
  const { name, username, password } = req.body ?? {};
  if (typeof name !== 'string' || name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new AppError('Invalid name', 400);
  }
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    throw new AppError('Username must be 3-30 alphanumeric/underscore characters', 400);
  }
  if (typeof password !== 'string' || password.length < PWD_MIN || password.length > PWD_MAX) {
    throw new AppError(`Password must be ${PWD_MIN}-${PWD_MAX} characters`, 400);
  }

  const row = db.connection.prepare(
    `SELECT * FROM team_invitations WHERE token = ?`
  ).get(req.params.token) as any;
  if (!row) throw new AppError('Invitation not found', 404);
  if (row.accepted) throw new AppError('Invitation already used', 410);
  if (new Date(row.expires_at) < new Date()) throw new AppError('Invitation expired', 410);

  // Check username uniqueness
  const exists = db.connection.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
  if (exists) throw new AppError('Username already taken', 409);

  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(password, 12);

  const txn = db.connection.transaction(() => {
    db.connection.prepare(`
      INSERT INTO users (id, username, password_hash, name, email, role, team_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, username, passwordHash, name, row.email, row.role, row.team_id);
    db.connection.prepare(`
      INSERT INTO user_availability (id, user_id) VALUES (?, ?)
    `).run(uuidv4(), userId);
    db.connection.prepare(`
      UPDATE team_invitations SET accepted = 1, accepted_at = datetime('now') WHERE token = ?
    `).run(req.params.token);
  });
  txn();

  // Issue tokens so the new user is signed in immediately.
  const payload = { userId, username, role: row.role };
  const { accessToken, refreshToken } = generateTokens(payload);

  const sessionId = uuidv4();
  const sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.connection.prepare(`
    INSERT INTO sessions (id, user_id, refresh_token, expires_at) VALUES (?, ?, ?, ?)
  `).run(sessionId, userId, refreshToken, sessionExpiry);

  res.status(201).json({
    user: { id: userId, username, name, email: row.email, role: row.role, teamId: row.team_id },
    accessToken,
    refreshToken,
  });
}));

export default router;
