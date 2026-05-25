/**
 * Gamification endpoints — current user's XP, level, achievements summary,
 * and progress toward the next level. Backs the XpLevelBadge UI.
 */

import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database';
import { recalcLevel, LEVEL_XP } from '../services/userStatsSync';

const router = Router();

router.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  const stats = db.connection.prepare(`
    SELECT xp, level, total_bookings, total_cancellations, meetings_attended,
           login_streak, unlocked_achievements, last_login
    FROM user_stats WHERE user_id = ?
  `).get(userId) as any;

  const xp = stats?.xp ?? 0;
  const level = recalcLevel(xp);
  const currentLevelMin = LEVEL_XP[level - 1] ?? 0;
  const nextLevelMin = LEVEL_XP[level] ?? LEVEL_XP[LEVEL_XP.length - 1];
  const progressToNext = nextLevelMin > currentLevelMin
    ? Math.min(100, Math.round(((xp - currentLevelMin) / (nextLevelMin - currentLevelMin)) * 100))
    : 100;

  res.json({
    xp,
    level,
    nextLevelXp: nextLevelMin,
    currentLevelMinXp: currentLevelMin,
    progressToNext,
    totalBookings: stats?.total_bookings ?? 0,
    totalCancellations: stats?.total_cancellations ?? 0,
    meetingsAttended: stats?.meetings_attended ?? 0,
    loginStreak: stats?.login_streak ?? 0,
    unlockedAchievements: stats?.unlocked_achievements ? JSON.parse(stats.unlocked_achievements) : [],
    lastLogin: stats?.last_login ?? null,
  });
});

export default router;
