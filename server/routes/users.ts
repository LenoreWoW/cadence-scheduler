/**
 * User Management Routes
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from '../database';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get all users (internal only)
router.get('/', authenticateToken, requireRole('admin', 'manager', 'subordinate'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = db.connection.prepare(`
      SELECT u.id, u.username, u.name, u.role, u.title, u.avatar, u.email, u.team_id, u.timezone, u.onboarding_completed,
             ua.start_hour, ua.end_hour, ua.slot_duration, ua.buffer_minutes, ua.min_notice_minutes, ua.working_days, ua.time_off,
             ums.preferred_platform, ums.meeting_link, ums.custom_platform_name
      FROM users u
      LEFT JOIN user_availability ua ON u.id = ua.user_id
      LEFT JOIN user_meeting_settings ums ON u.id = ums.user_id
    `).all() as any[];

    const result = users.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      title: u.title,
      avatar: u.avatar,
      email: u.email,
      teamId: u.team_id,
      timezone: u.timezone,
      onboardingCompleted: !!u.onboarding_completed,
      availability: u.start_hour !== null ? {
        startHour: u.start_hour,
        endHour: u.end_hour,
        slotDuration: u.slot_duration,
        bufferMinutes: u.buffer_minutes,
        minNoticeMinutes: u.min_notice_minutes,
        days: JSON.parse(u.working_days || '[]'),
        timeOff: JSON.parse(u.time_off || '[]')
      } : null,
      meetingSettings: u.preferred_platform ? {
        preferredPlatform: u.preferred_platform,
        meetingLink: u.meeting_link,
        customPlatformName: u.custom_platform_name
      } : null
    }));

    res.json(result);
  } catch (error) {
    throw new AppError('Failed to fetch users', 500);
  }
});

// Get hosts (managers available for booking) — auth-required, sensitive fields redacted
router.get('/hosts', authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const hosts = db.connection.prepare(`
      SELECT u.id, u.username, u.name, u.role, u.title, u.avatar, u.team_id,
             ua.start_hour, ua.end_hour, ua.slot_duration, ua.buffer_minutes, ua.min_notice_minutes, ua.working_days, ua.time_off,
             ums.preferred_platform
      FROM users u
      LEFT JOIN user_availability ua ON u.id = ua.user_id
      LEFT JOIN user_meeting_settings ums ON u.id = ums.user_id
      WHERE u.role IN ('admin', 'manager', 'subordinate')
    `).all() as any[];

    // Note: we intentionally drop meeting_link and custom_platform_name from the response.
    // Those are private to the host; bookings reach the host's link only when the meeting is created
    // server-side, never exposed to the client side directly.
    const result = hosts.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      title: u.title,
      avatar: u.avatar,
      teamId: u.team_id,
      availability: u.start_hour !== null ? {
        startHour: u.start_hour,
        endHour: u.end_hour,
        slotDuration: u.slot_duration,
        bufferMinutes: u.buffer_minutes,
        minNoticeMinutes: u.min_notice_minutes,
        days: JSON.parse(u.working_days || '[]'),
        timeOff: JSON.parse(u.time_off || '[]')
      } : null,
      meetingSettings: u.preferred_platform ? {
        preferredPlatform: u.preferred_platform,
      } : null
    }));

    res.json(result);
  } catch (error) {
    throw new AppError('Failed to fetch hosts', 500);
  }
});

// Get single user
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = db.connection.prepare(`
      SELECT u.id, u.username, u.name, u.role, u.title, u.avatar, u.email, u.team_id, u.timezone, u.onboarding_completed,
             ua.start_hour, ua.end_hour, ua.slot_duration, ua.buffer_minutes, ua.min_notice_minutes, ua.working_days, ua.time_off,
             ums.preferred_platform, ums.meeting_link, ums.custom_platform_name
      FROM users u
      LEFT JOIN user_availability ua ON u.id = ua.user_id
      LEFT JOIN user_meeting_settings ums ON u.id = ums.user_id
      WHERE u.id = ?
    `).get(req.params.id) as any;

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      title: user.title,
      avatar: user.avatar,
      email: user.email,
      teamId: user.team_id,
      timezone: user.timezone,
      onboardingCompleted: !!user.onboarding_completed,
      availability: user.start_hour !== null ? {
        startHour: user.start_hour,
        endHour: user.end_hour,
        slotDuration: user.slot_duration,
        bufferMinutes: user.buffer_minutes,
        minNoticeMinutes: user.min_notice_minutes,
        days: JSON.parse(user.working_days || '[]'),
        timeOff: JSON.parse(user.time_off || '[]')
      } : null,
      meetingSettings: user.preferred_platform ? {
        preferredPlatform: user.preferred_platform,
        meetingLink: user.meeting_link,
        customPlatformName: user.custom_platform_name
      } : null
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch user', 500);
  }
});

// Create user (admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, password, name, email, role, title, teamId, avatar } = req.body;

    if (!username || !password || !name) {
      throw new AppError('Username, password, and name are required', 400);
    }

    const existing = db.connection.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      throw new AppError('Username already exists', 409);
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    db.connection.prepare(`
      INSERT INTO users (id, username, password_hash, name, email, role, title, team_id, avatar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, username, passwordHash, name, email || null, role || 'guest', title || null, teamId || null, avatar || null);

    // Create default availability
    db.connection.prepare(`
      INSERT INTO user_availability (id, user_id) VALUES (?, ?)
    `).run(uuidv4(), userId);

    res.status(201).json({
      id: userId,
      username,
      name,
      role: role || 'guest',
      email,
      title,
      teamId,
      avatar
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create user', 500);
  }
});

// Update user
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, title, teamId, avatar, timezone, onboardingCompleted } = req.body;

    // Users can only update themselves, unless admin
    if (req.user!.userId !== id && req.user!.role !== 'admin') {
      throw new AppError('Unauthorized', 403);
    }

    const existing = db.connection.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existing) {
      throw new AppError('User not found', 404);
    }

    db.connection.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        title = COALESCE(?, title),
        team_id = COALESCE(?, team_id),
        avatar = COALESCE(?, avatar),
        timezone = COALESCE(?, timezone),
        onboarding_completed = COALESCE(?, onboarding_completed),
        updated_at = ?
      WHERE id = ?
    `).run(name, email, title, teamId, avatar, timezone, onboardingCompleted ? 1 : null, new Date().toISOString(), id);

    res.json({ message: 'User updated' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update user', 500);
  }
});

// Update user availability
router.put('/:id/availability', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { startHour, endHour, slotDuration, bufferMinutes, minNoticeMinutes, days, timeOff } = req.body;

    // Users can only update themselves, unless admin
    if (req.user!.userId !== id && req.user!.role !== 'admin') {
      throw new AppError('Unauthorized', 403);
    }

    const existing = db.connection.prepare('SELECT id FROM user_availability WHERE user_id = ?').get(id);
    
    if (existing) {
      db.connection.prepare(`
        UPDATE user_availability SET
          start_hour = COALESCE(?, start_hour),
          end_hour = COALESCE(?, end_hour),
          slot_duration = COALESCE(?, slot_duration),
          buffer_minutes = COALESCE(?, buffer_minutes),
          min_notice_minutes = COALESCE(?, min_notice_minutes),
          working_days = COALESCE(?, working_days),
          time_off = COALESCE(?, time_off),
          updated_at = ?
        WHERE user_id = ?
      `).run(
        startHour, endHour, slotDuration, bufferMinutes, minNoticeMinutes,
        days ? JSON.stringify(days) : null,
        timeOff ? JSON.stringify(timeOff) : null,
        new Date().toISOString(), id
      );
    } else {
      db.connection.prepare(`
        INSERT INTO user_availability (id, user_id, start_hour, end_hour, slot_duration, buffer_minutes, min_notice_minutes, working_days, time_off)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), id,
        startHour || 9, endHour || 17, slotDuration || 30, bufferMinutes || 0, minNoticeMinutes || 120,
        JSON.stringify(days || [0, 1, 2, 3, 4]),
        JSON.stringify(timeOff || [])
      );
    }

    res.json({ message: 'Availability updated' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update availability', 500);
  }
});

// Update user meeting settings (for video conferencing)
router.put('/:id/meeting-settings', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { preferredPlatform, meetingLink, customPlatformName } = req.body;

    // Users can only update themselves, unless admin
    if (req.user!.userId !== id && req.user!.role !== 'admin') {
      throw new AppError('Unauthorized', 403);
    }

    // Validate platform
    const validPlatforms = ['zoom', 'teams', 'google-meet', 'webex', 'custom', null];
    if (preferredPlatform && !validPlatforms.includes(preferredPlatform)) {
      throw new AppError('Invalid meeting platform', 400);
    }

    // Validate meeting link format if provided
    if (meetingLink && !meetingLink.match(/^https?:\/\/.+/)) {
      throw new AppError('Meeting link must be a valid URL', 400);
    }

    const existing = db.connection.prepare('SELECT id FROM user_meeting_settings WHERE user_id = ?').get(id);
    
    if (existing) {
      db.connection.prepare(`
        UPDATE user_meeting_settings SET
          preferred_platform = ?,
          meeting_link = ?,
          custom_platform_name = ?,
          updated_at = ?
        WHERE user_id = ?
      `).run(
        preferredPlatform || null,
        meetingLink || null,
        customPlatformName || null,
        new Date().toISOString(), id
      );
    } else {
      db.connection.prepare(`
        INSERT INTO user_meeting_settings (id, user_id, preferred_platform, meeting_link, custom_platform_name)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        uuidv4(), id,
        preferredPlatform || null,
        meetingLink || null,
        customPlatformName || null
      );
    }

    res.json({ 
      message: 'Meeting settings updated',
      meetingSettings: {
        preferredPlatform,
        meetingLink,
        customPlatformName
      }
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update meeting settings', 500);
  }
});

// Update the caller's own booking caps (weekly / monthly / yearly).
router.put('/me/booking-caps', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { weekly, monthly, yearly } = req.body || {};

    const norm = (v: any, label: string): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) {
        throw new AppError(`${label} must be a non-negative integer or null`, 400);
      }
      return n;
    };

    const w = norm(weekly, 'weekly');
    const m = norm(monthly, 'monthly');
    const y = norm(yearly, 'yearly');

    db.connection.prepare(`
      UPDATE users
      SET weekly_booking_cap = ?, monthly_booking_cap = ?, yearly_booking_cap = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(w, m, y, req.user!.userId);

    res.json({
      weeklyBookingCap: w,
      monthlyBookingCap: m,
      yearlyBookingCap: y,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update booking caps', 500);
  }
});

// Get the caller's own attribute map.
router.get('/me/attributes', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const row = db.connection.prepare(`SELECT attributes FROM users WHERE id = ?`).get(req.user!.userId) as any;
    if (!row) throw new AppError('User not found', 404);
    let attrs: any = {};
    try { attrs = JSON.parse(row.attributes || '{}'); } catch {}
    res.json({ attributes: attrs });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch attributes', 500);
  }
});

function validateAttributes(input: any): Record<string, string | number | boolean> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError('attributes must be an object', 400);
  }
  const keys = Object.keys(input);
  if (keys.length > 30) throw new AppError('Up to 30 attribute keys allowed', 400);
  const out: Record<string, string | number | boolean> = {};
  for (const k of keys) {
    if (typeof k !== 'string' || k.length === 0 || k.length > 100) {
      throw new AppError('Invalid attribute key', 400);
    }
    const v = input[k];
    if (typeof v === 'string') {
      if (v.length > 200) throw new AppError(`Attribute ${k} value too long`, 400);
      out[k] = v;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v;
    } else if (typeof v === 'boolean') {
      out[k] = v;
    } else {
      throw new AppError(`Invalid value for ${k}`, 400);
    }
  }
  return out;
}

router.put('/me/attributes', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { attributes } = req.body || {};
    const cleaned = validateAttributes(attributes);
    db.connection.prepare(`
      UPDATE users SET attributes = ?, updated_at = datetime('now') WHERE id = ?
    `).run(JSON.stringify(cleaned), req.user!.userId);
    res.json({ attributes: cleaned });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update attributes', 500);
  }
});

// Manager / admin: read/write another user's attributes.
function canManageUserAttributes(callerId: string, callerRole: string, targetUserId: string): boolean {
  if (callerRole === 'admin') return true;
  const target = db.connection.prepare(`SELECT team_id FROM users WHERE id = ?`).get(targetUserId) as any;
  if (!target?.team_id) return false;
  const team = db.connection.prepare(`SELECT leader_id FROM teams WHERE id = ?`).get(target.team_id) as any;
  return !!team && team.leader_id === callerId;
}

router.get('/:userId/attributes', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    if (req.user!.userId !== userId && !canManageUserAttributes(req.user!.userId, req.user!.role, userId)) {
      throw new AppError('Forbidden', 403);
    }
    const row = db.connection.prepare(`SELECT attributes FROM users WHERE id = ?`).get(userId) as any;
    if (!row) throw new AppError('User not found', 404);
    let attrs: any = {};
    try { attrs = JSON.parse(row.attributes || '{}'); } catch {}
    res.json({ attributes: attrs });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch attributes', 500);
  }
});

router.put('/:userId/attributes', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    if (req.user!.userId !== userId && !canManageUserAttributes(req.user!.userId, req.user!.role, userId)) {
      throw new AppError('Forbidden', 403);
    }
    const { attributes } = req.body || {};
    const cleaned = validateAttributes(attributes);
    db.connection.prepare(`
      UPDATE users SET attributes = ?, updated_at = datetime('now') WHERE id = ?
    `).run(JSON.stringify(cleaned), userId);
    res.json({ attributes: cleaned });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update attributes', 500);
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user!.userId === id) {
      throw new AppError('Cannot delete yourself', 400);
    }

    const result = db.connection.prepare('DELETE FROM users WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      throw new AppError('User not found', 404);
    }

    res.json({ message: 'User deleted' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete user', 500);
  }
});

export default router;

