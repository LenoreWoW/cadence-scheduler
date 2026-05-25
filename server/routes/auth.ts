/**
 * Authentication Routes
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { generateTokens, verifyToken, authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new AppError('Username and password are required', 400);
    }

    const user = db.connection.prepare(`
      SELECT id, username, password_hash, name, role, title, avatar, team_id, onboarding_completed
      FROM users WHERE username = ?
    `).get(username) as any;

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate tokens
    const payload = { userId: user.id, username: user.username, role: user.role };
    const { accessToken, refreshToken } = generateTokens(payload);

    // Store refresh token
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    db.connection.prepare(`
      INSERT INTO sessions (id, user_id, refresh_token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, user.id, refreshToken, expiresAt);

    // Update last login
    db.connection.prepare(`
      INSERT INTO user_stats (id, user_id, last_login)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET last_login = ?, login_streak = login_streak + 1
    `).run(uuidv4(), user.id, new Date().toISOString(), new Date().toISOString());

    // Log activity
    db.connection.prepare(`
      INSERT INTO activity_logs (id, action, details, performed_by, role)
      VALUES (?, 'LOGIN', 'User logged in', ?, ?)
    `).run(uuidv4(), user.name, user.role);

    // Get user availability
    const availability = db.connection.prepare(`
      SELECT * FROM user_availability WHERE user_id = ?
    `).get(user.id) as any;

    res.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        title: user.title,
        avatar: user.avatar,
        teamId: user.team_id,
        onboardingCompleted: !!user.onboarding_completed,
        availability: availability ? {
          startHour: availability.start_hour,
          endHour: availability.end_hour,
          slotDuration: availability.slot_duration,
          bufferMinutes: availability.buffer_minutes,
          minNoticeMinutes: availability.min_notice_minutes,
          days: JSON.parse(availability.working_days || '[]'),
          timeOff: JSON.parse(availability.time_off || '[]')
        } : null
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Login failed', 500);
  }
});

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, username, password, email } = req.body;

    if (!name || !username || !password) {
      throw new AppError('Name, username, and password are required', 400);
    }

    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }

    // Check if username exists
    const existing = db.connection.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      throw new AppError('Username already exists', 409);
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    db.connection.prepare(`
      INSERT INTO users (id, username, password_hash, name, email, role)
      VALUES (?, ?, ?, ?, ?, 'guest')
    `).run(userId, username, passwordHash, name, email || null);

    // Create default availability
    db.connection.prepare(`
      INSERT INTO user_availability (id, user_id) VALUES (?, ?)
    `).run(uuidv4(), userId);

    // Generate tokens
    const payload = { userId, username, role: 'guest' };
    const { accessToken, refreshToken } = generateTokens(payload);

    // Store session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    db.connection.prepare(`
      INSERT INTO sessions (id, user_id, refresh_token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, userId, refreshToken, expiresAt);

    res.status(201).json({
      user: {
        id: userId,
        username,
        name,
        role: 'guest',
        email,
        onboardingCompleted: false
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Registration failed', 500);
  }
});

// Refresh Token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token required', 400);
    }

    // Verify token
    const payload = verifyToken(refreshToken);
    if (!payload) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Check if session exists
    const session = db.connection.prepare(`
      SELECT * FROM sessions WHERE refresh_token = ? AND expires_at > datetime('now')
    `).get(refreshToken) as any;

    if (!session) {
      throw new AppError('Session expired or invalid', 401);
    }

    // Generate new tokens
    const newPayload = { userId: payload.userId, username: payload.username, role: payload.role };
    const tokens = generateTokens(newPayload);

    // Update session
    db.connection.prepare(`
      UPDATE sessions SET refresh_token = ?, expires_at = ? WHERE id = ?
    `).run(
      tokens.refreshToken,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      session.id
    );

    res.json(tokens);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Token refresh failed', 500);
  }
});

// Logout
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Remove all sessions for this user
    db.connection.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user!.userId);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    throw new AppError('Logout failed', 500);
  }
});

// Get Current User
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = db.connection.prepare(`
      SELECT id, username, name, role, title, avatar, email, team_id, timezone, onboarding_completed
      FROM users WHERE id = ?
    `).get(req.user!.userId) as any;

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const availability = db.connection.prepare(`
      SELECT * FROM user_availability WHERE user_id = ?
    `).get(user.id) as any;

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
      availability: availability ? {
        startHour: availability.start_hour,
        endHour: availability.end_hour,
        slotDuration: availability.slot_duration,
        bufferMinutes: availability.buffer_minutes,
        minNoticeMinutes: availability.min_notice_minutes,
        days: JSON.parse(availability.working_days || '[]'),
        timeOff: JSON.parse(availability.time_off || '[]')
      } : null
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to get user', 500);
  }
});

// Change Password
router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current and new password required', 400);
    }

    if (newPassword.length < 6) {
      throw new AppError('New password must be at least 6 characters', 400);
    }

    const user = db.connection.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.userId) as any;
    
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      throw new AppError('Current password is incorrect', 401);
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    db.connection.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(newHash, new Date().toISOString(), req.user!.userId);

    // Invalidate all sessions except current
    db.connection.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user!.userId);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Password change failed', 500);
  }
});

export default router;

