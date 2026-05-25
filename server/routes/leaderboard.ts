/**
 * Leaderboard API Routes
 * Team and individual performance rankings
 */

import { Router, Request, Response } from 'express';
import { db } from '../database';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/leaderboard/global
 * Get global leaderboard across all users
 */
router.get('/global', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { period = 'month', limit = 10 } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date('2020-01-01');
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    const startDateStr = startDate.toISOString().split('T')[0];

    const leaderboard = db.connection.prepare(`
      SELECT 
        u.id,
        u.name,
        u.avatar,
        u.title,
        u.role,
        t.name as team_name,
        t.color as team_color,
        COALESCE(us.total_bookings, 0) as total_bookings,
        COALESCE(us.login_streak, 0) as login_streak,
        COUNT(DISTINCT m.id) as meetings_hosted,
        SUM(CASE WHEN m.status = 'approved' AND m.date >= ? THEN m.duration_minutes ELSE 0 END) as total_minutes,
        (
          SELECT COUNT(*) FROM meetings m2 
          WHERE m2.host_id = u.id 
          AND m2.status = 'approved' 
          AND m2.date >= ?
        ) as period_meetings,
        -- Calculate XP: meetings * 10 + streak * 5 + hours * 2
        (
          COALESCE(us.total_bookings, 0) * 10 + 
          COALESCE(us.login_streak, 0) * 5 +
          ROUND(SUM(CASE WHEN m.status = 'approved' AND m.date >= ? THEN m.duration_minutes ELSE 0 END) / 60.0 * 2)
        ) as xp
      FROM users u
      LEFT JOIN teams t ON t.id = u.team_id
      LEFT JOIN user_stats us ON us.user_id = u.id
      LEFT JOIN meetings m ON m.host_id = u.id
      WHERE u.role IN ('admin', 'manager')
      GROUP BY u.id
      ORDER BY period_meetings DESC, xp DESC
      LIMIT ?
    `).all(startDateStr, startDateStr, startDateStr, parseInt(limit as string)) as any[];

    // Add rankings
    const rankedLeaderboard = leaderboard.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      title: user.title,
      team: user.team_name ? {
        name: user.team_name,
        color: user.team_color
      } : null,
      metrics: {
        meetingsHosted: user.meetings_hosted || 0,
        periodMeetings: user.period_meetings || 0,
        totalHours: Math.round((user.total_minutes || 0) / 60),
        loginStreak: user.login_streak || 0,
        xp: Math.round(user.xp || 0)
      }
    }));

    res.json({
      period,
      dateRange: {
        start: startDateStr,
        end: now.toISOString().split('T')[0]
      },
      leaderboard: rankedLeaderboard
    });
  } catch (error) {
    console.error('Global leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /api/leaderboard/team/:teamId
 * Get leaderboard for a specific team
 */
router.get('/team/:teamId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { period = 'month' } = req.query;

    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    const startDateStr = startDate.toISOString().split('T')[0];

    // Get team info
    const team = db.connection.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const leaderboard = db.connection.prepare(`
      SELECT 
        u.id,
        u.name,
        u.avatar,
        u.title,
        COALESCE(us.total_bookings, 0) as total_bookings,
        COALESCE(us.login_streak, 0) as login_streak,
        COALESCE(us.unlocked_achievements, '[]') as achievements,
        COUNT(DISTINCT m.id) as meetings_hosted,
        SUM(CASE WHEN m.status = 'approved' AND m.date >= ? THEN m.duration_minutes ELSE 0 END) as total_minutes,
        (
          SELECT COUNT(*) FROM meetings m2 
          WHERE m2.host_id = u.id 
          AND m2.status = 'approved' 
          AND m2.date >= ?
        ) as period_meetings
      FROM users u
      LEFT JOIN user_stats us ON us.user_id = u.id
      LEFT JOIN meetings m ON m.host_id = u.id
      WHERE u.team_id = ? AND u.role IN ('admin', 'manager')
      GROUP BY u.id
      ORDER BY period_meetings DESC
    `).all(startDateStr, startDateStr, teamId) as any[];

    const rankedLeaderboard = leaderboard.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      title: user.title,
      metrics: {
        meetingsHosted: user.meetings_hosted || 0,
        periodMeetings: user.period_meetings || 0,
        totalHours: Math.round((user.total_minutes || 0) / 60),
        loginStreak: user.login_streak || 0,
        achievementCount: JSON.parse(user.achievements || '[]').length
      }
    }));

    res.json({
      team: {
        id: team.id,
        name: team.name,
        color: team.color,
        image: team.image
      },
      period,
      dateRange: {
        start: startDateStr,
        end: now.toISOString().split('T')[0]
      },
      leaderboard: rankedLeaderboard
    });
  } catch (error) {
    console.error('Team leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch team leaderboard' });
  }
});

/**
 * GET /api/leaderboard/user/:userId
 * Get individual user stats and ranking
 */
router.get('/user/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { period = 'month' } = req.query;

    const callerId = (req as any).user?.userId;
    const callerRole = (req as any).user?.role;
    if (callerRole !== 'admin' && callerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const now = new Date();
    let startDate = new Date();
    startDate.setMonth(now.getMonth() - 1);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get user info
    const user = db.connection.prepare(`
      SELECT 
        u.*,
        t.name as team_name,
        t.color as team_color,
        us.total_bookings,
        us.login_streak,
        us.meetings_attended,
        us.unlocked_achievements
      FROM users u
      LEFT JOIN teams t ON t.id = u.team_id
      LEFT JOIN user_stats us ON us.user_id = u.id
      WHERE u.id = ?
    `).get(userId) as any;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get meeting stats
    const meetingStats = db.connection.prepare(`
      SELECT 
        COUNT(*) as total_hosted,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'approved' THEN duration_minutes ELSE 0 END) as total_minutes,
        SUM(CASE WHEN date >= ? AND status = 'approved' THEN 1 ELSE 0 END) as period_meetings
      FROM meetings
      WHERE host_id = ?
    `).get(startDateStr, userId) as any;

    // Get global ranking
    const ranking = db.connection.prepare(`
      SELECT COUNT(*) + 1 as rank
      FROM (
        SELECT u.id, COUNT(m.id) as meeting_count
        FROM users u
        LEFT JOIN meetings m ON m.host_id = u.id AND m.status = 'approved' AND m.date >= ?
        WHERE u.role IN ('admin', 'manager')
        GROUP BY u.id
        HAVING meeting_count > (
          SELECT COUNT(*) FROM meetings 
          WHERE host_id = ? AND status = 'approved' AND date >= ?
        )
      )
    `).get(startDateStr, userId, startDateStr) as any;

    const achievements = JSON.parse(user.unlocked_achievements || '[]');

    res.json({
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        title: user.title,
        team: user.team_name ? {
          name: user.team_name,
          color: user.team_color
        } : null
      },
      ranking: {
        global: ranking?.rank || 1,
        period
      },
      stats: {
        totalBookings: user.total_bookings || 0,
        loginStreak: user.login_streak || 0,
        meetingsHosted: meetingStats.total_hosted || 0,
        periodMeetings: meetingStats.period_meetings || 0,
        totalHours: Math.round((meetingStats.total_minutes || 0) / 60),
        approvalRate: meetingStats.total_hosted > 0 
          ? Math.round((meetingStats.approved / meetingStats.total_hosted) * 100)
          : 100
      },
      achievements: achievements.map((id: string) => ({
        id,
        unlockedAt: null // Could track unlock dates in future
      })),
      xp: (user.total_bookings || 0) * 10 + 
          (user.login_streak || 0) * 5 + 
          Math.round((meetingStats.total_minutes || 0) / 60 * 2)
    });
  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

/**
 * GET /api/leaderboard/achievements
 * Get all available achievements
 */
router.get('/achievements', (req: Request, res: Response) => {
  const achievements = [
    {
      id: 'first_login',
      name: 'First Steps',
      nameAr: 'الخطوات الأولى',
      description: 'Log in for the first time',
      descriptionAr: 'تسجيل الدخول لأول مرة',
      icon: '🎯',
      xp: 10
    },
    {
      id: 'first_booking',
      name: 'Scheduler',
      nameAr: 'المجدول',
      description: 'Create your first booking',
      descriptionAr: 'إنشاء أول حجز',
      icon: '📅',
      xp: 20
    },
    {
      id: 'streak_3',
      name: 'On a Roll',
      nameAr: 'في الطريق الصحيح',
      description: '3-day login streak',
      descriptionAr: 'تسجيل دخول لمدة 3 أيام متتالية',
      icon: '🔥',
      xp: 30
    },
    {
      id: 'streak_7',
      name: 'Week Warrior',
      nameAr: 'محارب الأسبوع',
      description: '7-day login streak',
      descriptionAr: 'تسجيل دخول لمدة 7 أيام متتالية',
      icon: '⚡',
      xp: 50
    },
    {
      id: 'booking_10',
      name: 'Meeting Master',
      nameAr: 'سيد الاجتماعات',
      description: 'Host 10 meetings',
      descriptionAr: 'استضافة 10 اجتماعات',
      icon: '👑',
      xp: 100
    },
    {
      id: 'booking_50',
      name: 'Calendar Legend',
      nameAr: 'أسطورة التقويم',
      description: 'Host 50 meetings',
      descriptionAr: 'استضافة 50 اجتماع',
      icon: '🏆',
      xp: 250
    },
    {
      id: 'team_player',
      name: 'Team Player',
      nameAr: 'لاعب الفريق',
      description: 'Visit the team management page',
      descriptionAr: 'زيارة صفحة إدارة الفريق',
      icon: '🤝',
      xp: 15
    }
  ];

  res.json(achievements);
});

export default router;

