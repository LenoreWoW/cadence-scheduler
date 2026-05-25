/**
 * Challenges — limited-time goals (e.g. "host 5 meetings this week").
 *
 * Admins seed challenges. Other code calls `trackChallengeProgress(userId,
 * metric, increment)` whenever a relevant event fires. Completing a challenge
 * awards XP via `userStatsSync.awardXp`.
 */

import { Router, Response, NextFunction, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { awardXp } from '../services/userStatsSync';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

const adminOnly = [authenticateToken, requireRole('admin')];

const VALID_METRICS = new Set(['bookings_received', 'meetings_hosted', 'logins', 'meetings_attended']);

interface ChallengeRow {
  id: string;
  title: string;
  description: string | null;
  metric: string;
  target: number;
  period: string;
  starts_at: string;
  ends_at: string;
  xp_reward: number;
  active: number;
}

// ============================================================================
// Internal helper — called from booking / login routes
// ============================================================================

/**
 * Increment a user's progress on any active challenge matching `metric`.
 * Awards XP and marks completion when the target is reached. Never throws.
 */
export function trackChallengeProgress(userId: string, metric: string, increment: number = 1): void {
  try {
    if (!userId || !metric || typeof increment !== 'number') return;
    const now = new Date().toISOString();
    const challenges = db.connection.prepare(`
      SELECT * FROM challenges
      WHERE active = 1 AND metric = ? AND starts_at <= ? AND ends_at >= ?
    `).all(metric, now, now) as ChallengeRow[];

    for (const c of challenges) {
      const existing = db.connection.prepare(`
        SELECT progress, completed FROM user_challenge_progress WHERE user_id = ? AND challenge_id = ?
      `).get(userId, c.id) as any;

      if (existing?.completed) continue;

      const newProgress = (existing?.progress ?? 0) + increment;
      const completed = newProgress >= c.target;

      if (existing) {
        db.connection.prepare(`
          UPDATE user_challenge_progress
          SET progress = ?, completed = ?, completed_at = ?
          WHERE user_id = ? AND challenge_id = ?
        `).run(
          newProgress,
          completed ? 1 : 0,
          completed ? new Date().toISOString() : null,
          userId, c.id
        );
      } else {
        db.connection.prepare(`
          INSERT INTO user_challenge_progress (user_id, challenge_id, progress, completed, completed_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, c.id, newProgress, completed ? 1 : 0, completed ? new Date().toISOString() : null);
      }

      if (completed) {
        awardXp(userId, c.xp_reward, `challenge: ${c.title}`);
        try {
          db.connection.prepare(`
            INSERT INTO notifications (id, user_id, type, title, body, link)
            VALUES (?, ?, 'challenge.completed', ?, ?, ?)
          `).run(
            uuidv4(),
            userId,
            `Challenge completed: ${c.title}`,
            `You earned ${c.xp_reward} XP!`,
            '/?view=achievements'
          );
        } catch {}
      }
    }
  } catch (e) {
    console.error('[challenges.trackChallengeProgress] failed:', e);
  }
}

// ============================================================================
// Routes
// ============================================================================

// GET /active — current active challenges plus my progress
router.get('/active', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const now = new Date().toISOString();
  const challenges = db.connection.prepare(`
    SELECT * FROM challenges
    WHERE active = 1 AND starts_at <= ? AND ends_at >= ?
    ORDER BY ends_at ASC
  `).all(now, now) as ChallengeRow[];

  const myProgress = db.connection.prepare(`
    SELECT challenge_id, progress, completed, completed_at FROM user_challenge_progress WHERE user_id = ?
  `).all(req.user!.userId) as any[];
  const progressById = new Map(myProgress.map(p => [p.challenge_id, p]));

  res.json(challenges.map(c => {
    const p = progressById.get(c.id);
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      metric: c.metric,
      target: c.target,
      period: c.period,
      startsAt: c.starts_at,
      endsAt: c.ends_at,
      xpReward: c.xp_reward,
      myProgress: p?.progress ?? 0,
      completed: !!p?.completed,
      completedAt: p?.completed_at ?? null,
    };
  }));
}));

// POST / — create (admin)
router.post('/', ...adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { title, description, metric, target, period, startsAt, endsAt, xpReward } = req.body ?? {};

  if (typeof title !== 'string' || title.length === 0 || title.length > 200) {
    throw new AppError('Invalid title', 400);
  }
  if (typeof metric !== 'string' || !VALID_METRICS.has(metric)) {
    throw new AppError(`metric must be one of: ${[...VALID_METRICS].join(', ')}`, 400);
  }
  if (typeof target !== 'number' || target < 1 || target > 100000) {
    throw new AppError('target must be 1-100000', 400);
  }
  if (typeof startsAt !== 'string' || typeof endsAt !== 'string') {
    throw new AppError('startsAt and endsAt are required', 400);
  }
  if (new Date(endsAt) <= new Date(startsAt)) {
    throw new AppError('endsAt must be after startsAt', 400);
  }

  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO challenges (id, title, description, metric, target, period, starts_at, ends_at, xp_reward, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id, title,
    description || null,
    metric, target,
    period || 'week',
    startsAt, endsAt,
    typeof xpReward === 'number' ? xpReward : 100
  );

  res.status(201).json({ id, title, metric, target, startsAt, endsAt });
}));

// POST /seed-weekly — seed defaults if there are no active challenges
router.post('/seed-weekly', ...adminOnly, asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const now = new Date().toISOString();
  const existing = db.connection.prepare(
    `SELECT COUNT(*) as c FROM challenges WHERE active = 1 AND starts_at <= ? AND ends_at >= ?`
  ).get(now, now) as any;

  if (existing.c > 0) {
    return res.json({ seeded: 0, message: 'Active challenges already exist' });
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  // End at the next Sunday 23:59.
  const end = new Date(start);
  const day = end.getDay();
  end.setDate(end.getDate() + (7 - day));
  end.setHours(23, 59, 59, 999);

  const defaults = [
    { title: 'Booking Boost', description: 'Receive 5 bookings this week.', metric: 'bookings_received', target: 5, xp: 150 },
    { title: 'Show Up', description: 'Attend 3 meetings this week.', metric: 'meetings_attended', target: 3, xp: 100 },
    { title: 'Daily Driver', description: 'Log in every weekday.', metric: 'logins', target: 5, xp: 75 },
  ];

  for (const d of defaults) {
    db.connection.prepare(`
      INSERT INTO challenges (id, title, description, metric, target, period, starts_at, ends_at, xp_reward, active)
      VALUES (?, ?, ?, ?, ?, 'week', ?, ?, ?, 1)
    `).run(uuidv4(), d.title, d.description, d.metric, d.target, start.toISOString(), end.toISOString(), d.xp);
  }

  res.json({ seeded: defaults.length });
}));

export default router;
