/**
 * Delegation: who may schedule meetings on behalf of whom (the user_delegates
 * table). principal = the boss whose calendar is acted on; delegate = the
 * assistant. Used to authorize on-behalf (tentative) bookings.
 */
import { Router, Response, NextFunction, Request } from 'express';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { isDelegationAllowed } from '../utils/delegationRules';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

/** Whether `delegateUserId` may act on behalf of `principalUserId`. */
export function canActOnBehalf(delegateUserId: string, principalUserId: string, role: string): boolean {
  if (delegateUserId === principalUserId) return true; // acting for yourself is always fine
  const row = db.connection.prepare(
    `SELECT 1 FROM user_delegates WHERE principal_user_id = ? AND delegate_user_id = ?`
  ).get(principalUserId, delegateUserId);
  return isDelegationAllowed(role, !!row);
}

// List delegations involving me (both directions).
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const me = req.user!.userId;
  const iManage = db.connection.prepare(`
    SELECT d.principal_user_id, d.delegate_user_id, d.scope, u.name
    FROM user_delegates d LEFT JOIN users u ON u.id = d.principal_user_id
    WHERE d.delegate_user_id = ?
  `).all(me) as any[];
  const myDelegates = db.connection.prepare(`
    SELECT d.principal_user_id, d.delegate_user_id, d.scope, u.name
    FROM user_delegates d LEFT JOIN users u ON u.id = d.delegate_user_id
    WHERE d.principal_user_id = ?
  `).all(me) as any[];
  const map = (r: any) => ({ principalUserId: r.principal_user_id, delegateUserId: r.delegate_user_id, scope: r.scope, name: r.name });
  res.json({ iManage: iManage.map(map), myDelegates: myDelegates.map(map) });
}));

// Add a delegate who may act on MY behalf.
router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const me = req.user!.userId;
  const { delegateUserId, scope } = req.body ?? {};
  if (typeof delegateUserId !== 'string' || !delegateUserId) throw new AppError('delegateUserId required', 400);
  if (delegateUserId === me) throw new AppError('You cannot delegate to yourself', 400);
  const exists = db.connection.prepare(`SELECT id FROM users WHERE id = ?`).get(delegateUserId);
  if (!exists) throw new AppError('Delegate user not found', 404);
  db.connection.prepare(
    `INSERT OR IGNORE INTO user_delegates (principal_user_id, delegate_user_id, scope) VALUES (?, ?, ?)`
  ).run(me, delegateUserId, typeof scope === 'string' ? scope : 'calendar');
  res.status(201).json({ principalUserId: me, delegateUserId, scope: scope || 'calendar' });
}));

// Remove a delegate of mine.
router.delete('/:delegateUserId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = db.connection.prepare(
    `DELETE FROM user_delegates WHERE principal_user_id = ? AND delegate_user_id = ?`
  ).run(req.user!.userId, req.params.delegateUserId);
  if (result.changes === 0) throw new AppError('Delegation not found', 404);
  res.json({ success: true });
}));

export default router;
