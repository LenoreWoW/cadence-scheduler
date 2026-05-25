/**
 * Analytics API Routes
 * Provides meeting statistics and insights
 */

import { Router, Request, Response } from 'express';
import { db } from '../database';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/analytics/overview
 * Get overview statistics for current user's meetings
 */
router.get('/overview', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { period = 'month' } = req.query;

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
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    const startDateStr = startDate.toISOString().split('T')[0];

    // Get meeting statistics
    const stats = db.connection.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'approved' THEN duration_minutes ELSE 0 END) as total_minutes
      FROM meetings
      WHERE host_id = ? AND date >= ?
    `).get(userId, startDateStr) as any;

    // Get category breakdown
    const byCategory = db.connection.prepare(`
      SELECT category, COUNT(*) as count
      FROM meetings
      WHERE host_id = ? AND date >= ?
      GROUP BY category
    `).all(userId, startDateStr);

    // Get day of week distribution
    const byDayOfWeek = db.connection.prepare(`
      SELECT
        CAST(strftime('%w', date) AS INTEGER) as day_of_week,
        COUNT(*) as count
      FROM meetings
      WHERE host_id = ? AND date >= ?
      GROUP BY day_of_week
      ORDER BY day_of_week
    `).all(userId, startDateStr);

    // Get hourly distribution
    const byHour = db.connection.prepare(`
      SELECT
        CAST(substr(time, 1, 2) AS INTEGER) as hour,
        COUNT(*) as count
      FROM meetings
      WHERE host_id = ? AND date >= ?
      GROUP BY hour
      ORDER BY hour
    `).all(userId, startDateStr);

    // Calculate derived metrics
    const approvedMeetings = stats.approved || 0;
    const totalDuration = stats.total_minutes || 0;
    const avgDuration = approvedMeetings > 0 ? Math.round(totalDuration / approvedMeetings) : 0;
    const totalHours = Math.round(totalDuration / 60);

    // Find peak hour
    let peakHour = 9;
    let peakCount = 0;
    (byHour as any[]).forEach(row => {
      if (row.count > peakCount) {
        peakHour = row.hour;
        peakCount = row.count;
      }
    });

    // Calculate approval rate
    const totalDecided = (stats.approved || 0) + (stats.rejected || 0);
    const approvalRate = totalDecided > 0 ? Math.round((stats.approved / totalDecided) * 100) : 100;

    res.json({
      period,
      dateRange: { start: startDateStr, end: now.toISOString().split('T')[0] },
      summary: {
        total: stats.total || 0,
        approved: stats.approved || 0,
        pending: stats.pending || 0,
        cancelled: stats.cancelled || 0,
        rejected: stats.rejected || 0,
        totalHours,
        avgDuration,
        approvalRate,
        peakHour
      },
      breakdown: {
        byCategory: byCategory.reduce((acc: any, row: any) => {
          acc[row.category || 'general'] = row.count;
          return acc;
        }, {}),
        byDayOfWeek: (() => {
          const days = [0, 0, 0, 0, 0, 0, 0];
          (byDayOfWeek as any[]).forEach(row => {
            days[row.day_of_week] = row.count;
          });
          return days;
        })(),
        byHour: byHour.reduce((acc: any, row: any) => {
          acc[row.hour] = row.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/analytics/trends
 * Get daily/weekly meeting trends
 */
router.get('/trends', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { period = 'month', groupBy = 'day' } = req.query;

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

    let groupByClause = "strftime('%Y-%m-%d', date)";
    if (groupBy === 'week') {
      groupByClause = "strftime('%Y-W%W', date)";
    } else if (groupBy === 'month') {
      groupByClause = "strftime('%Y-%m', date)";
    }

    const trends = db.connection.prepare(`
      SELECT
        ${groupByClause} as period,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'approved' THEN duration_minutes ELSE 0 END) as total_minutes
      FROM meetings
      WHERE host_id = ? AND date >= ?
      GROUP BY ${groupByClause}
      ORDER BY period ASC
    `).all(userId, startDateStr);

    res.json({
      period,
      groupBy,
      data: trends
    });
  } catch (error) {
    console.error('Analytics trends error:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

/**
 * GET /api/analytics/team
 * Get team-level analytics (admin only)
 */
router.get('/team', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { period = 'month' } = req.query;

    // Check if user is admin
    const user = db.connection.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required for team analytics' });
    }

    const now = new Date();
    let startDate = new Date();
    startDate.setMonth(now.getMonth() - 1);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get team member performance
    const teamStats = db.connection.prepare(`
      SELECT
        u.id,
        u.name,
        u.avatar,
        COUNT(m.id) as total_meetings,
        SUM(CASE WHEN m.status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN m.status = 'approved' THEN m.duration_minutes ELSE 0 END) as total_minutes
      FROM users u
      LEFT JOIN meetings m ON m.host_id = u.id AND m.date >= ?
      WHERE u.role IN ('admin', 'manager')
      GROUP BY u.id
      ORDER BY total_meetings DESC
    `).all(startDateStr);

    res.json({
      period,
      members: teamStats.map((member: any) => ({
        id: member.id,
        name: member.name,
        avatar: member.avatar,
        metrics: {
          totalMeetings: member.total_meetings || 0,
          approved: member.approved || 0,
          totalHours: Math.round((member.total_minutes || 0) / 60)
        }
      }))
    });
  } catch (error) {
    console.error('Team analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch team analytics' });
  }
});

export default router;
