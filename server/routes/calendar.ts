/**
 * Calendar Sync Routes
 * 
 * Handles OAuth flows and sync operations for Google Calendar and Microsoft Outlook
 */

import { Router, Request, Response } from 'express';
import { db } from '../database';
import { authenticateToken } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { signState, verifyState } from '../utils/signedState';
import calendarSync, {
  isGoogleConfigured,
  isMicrosoftConfigured,
  getGoogleAuthUrl,
  getMicrosoftAuthUrl,
  exchangeGoogleCode,
  exchangeMicrosoftCode,
  getGoogleCalendars,
  getMicrosoftCalendars,
  syncMeetingToCalendar,
  pullExternalEvents,
  getExternalBusyTimes,
  getValidAccessToken
} from '../services/calendarSync';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * GET /api/calendar/status
 * Get current calendar connection status for the user
 */
router.get('/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const connections = db.connection.prepare(`
      SELECT provider, calendar_id, calendar_name, sync_enabled, last_sync_at, created_at
      FROM calendar_connections
      WHERE user_id = ?
    `).all(userId);

    res.json({
      configured: {
        google: isGoogleConfigured(),
        microsoft: isMicrosoftConfigured()
      },
      connections: connections.map((c: any) => ({
        provider: c.provider,
        calendarId: c.calendar_id,
        calendarName: c.calendar_name,
        syncEnabled: Boolean(c.sync_enabled),
        lastSyncAt: c.last_sync_at,
        connectedAt: c.created_at
      }))
    });
  } catch (error) {
    console.error('Calendar status error:', error);
    res.status(500).json({ error: 'Failed to get calendar status' });
  }
});

/**
 * GET /api/calendar/google/connect
 * Start Google OAuth flow
 */
router.get('/google/connect', authenticateToken, (req: Request, res: Response) => {
  if (!isGoogleConfigured()) {
    return res.status(400).json({ error: 'Google Calendar integration not configured' });
  }

  const userId = (req as any).user.userId;
  const state = signState({ userId });
  const authUrl = getGoogleAuthUrl(state);

  res.json({ authUrl });
});

/**
 * GET /api/calendar/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${FRONTEND_URL}/settings?error=google_auth_cancelled`);
    }

    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/settings?error=invalid_callback`);
    }

    const decoded = verifyState<{ userId: string }>(state as string);
    if (!decoded) {
      return res.redirect(`${FRONTEND_URL}/settings?error=invalid_state`);
    }
    const { userId } = decoded;

    // Exchange code for tokens
    const tokens = await exchangeGoogleCode(code as string);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Get user's calendars
    const calendars = await getGoogleCalendars(tokens.access_token);
    const primaryCalendar = calendars.find((c: any) => c.primary) || calendars[0];

    // Save connection
    const existingConnection = db.connection.prepare(
      'SELECT id FROM calendar_connections WHERE user_id = ? AND provider = ?'
    ).get(userId, 'google');

    if (existingConnection) {
      db.connection.prepare(`
        UPDATE calendar_connections 
        SET access_token = ?, refresh_token = ?, token_expires_at = ?, 
            calendar_id = ?, calendar_name = ?, sync_enabled = 1, updated_at = datetime('now')
        WHERE user_id = ? AND provider = 'google'
      `).run(
        tokens.access_token,
        tokens.refresh_token || null,
        expiresAt.toISOString(),
        primaryCalendar?.id || 'primary',
        primaryCalendar?.summary || 'Primary Calendar',
        userId
      );
    } else {
      db.connection.prepare(`
        INSERT INTO calendar_connections 
        (id, user_id, provider, access_token, refresh_token, token_expires_at, calendar_id, calendar_name)
        VALUES (?, ?, 'google', ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        userId,
        tokens.access_token,
        tokens.refresh_token || null,
        expiresAt.toISOString(),
        primaryCalendar?.id || 'primary',
        primaryCalendar?.summary || 'Primary Calendar'
      );
    }

    // Trigger initial sync
    await pullExternalEvents(userId);

    res.redirect(`${FRONTEND_URL}/settings?success=google_connected`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`${FRONTEND_URL}/settings?error=google_auth_failed`);
  }
});

/**
 * GET /api/calendar/microsoft/connect
 * Start Microsoft OAuth flow
 */
router.get('/microsoft/connect', authenticateToken, (req: Request, res: Response) => {
  if (!isMicrosoftConfigured()) {
    return res.status(400).json({ error: 'Microsoft Calendar integration not configured' });
  }

  const userId = (req as any).user.userId;
  const state = signState({ userId });
  const authUrl = getMicrosoftAuthUrl(state);

  res.json({ authUrl });
});

/**
 * GET /api/calendar/microsoft/callback
 * Handle Microsoft OAuth callback
 */
router.get('/microsoft/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${FRONTEND_URL}/settings?error=microsoft_auth_cancelled`);
    }

    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/settings?error=invalid_callback`);
    }

    const decoded = verifyState<{ userId: string }>(state as string);
    if (!decoded) {
      return res.redirect(`${FRONTEND_URL}/settings?error=invalid_state`);
    }
    const { userId } = decoded;

    // Exchange code for tokens
    const tokens = await exchangeMicrosoftCode(code as string);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Get user's calendars
    const calendars = await getMicrosoftCalendars(tokens.access_token);
    const defaultCalendar = calendars.find((c: any) => c.isDefaultCalendar) || calendars[0];

    // Save connection
    const existingConnection = db.connection.prepare(
      'SELECT id FROM calendar_connections WHERE user_id = ? AND provider = ?'
    ).get(userId, 'microsoft');

    if (existingConnection) {
      db.connection.prepare(`
        UPDATE calendar_connections 
        SET access_token = ?, refresh_token = ?, token_expires_at = ?, 
            calendar_id = ?, calendar_name = ?, sync_enabled = 1, updated_at = datetime('now')
        WHERE user_id = ? AND provider = 'microsoft'
      `).run(
        tokens.access_token,
        tokens.refresh_token,
        expiresAt.toISOString(),
        defaultCalendar?.id,
        defaultCalendar?.name || 'Calendar',
        userId
      );
    } else {
      db.connection.prepare(`
        INSERT INTO calendar_connections 
        (id, user_id, provider, access_token, refresh_token, token_expires_at, calendar_id, calendar_name)
        VALUES (?, ?, 'microsoft', ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        userId,
        tokens.access_token,
        tokens.refresh_token,
        expiresAt.toISOString(),
        defaultCalendar?.id,
        defaultCalendar?.name || 'Calendar'
      );
    }

    // Trigger initial sync
    await pullExternalEvents(userId);

    res.redirect(`${FRONTEND_URL}/settings?success=microsoft_connected`);
  } catch (error) {
    console.error('Microsoft callback error:', error);
    res.redirect(`${FRONTEND_URL}/settings?error=microsoft_auth_failed`);
  }
});

/**
 * DELETE /api/calendar/:provider/disconnect
 * Disconnect a calendar integration
 */
router.delete('/:provider/disconnect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { provider } = req.params;

    if (!['google', 'microsoft'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    // Delete connection
    db.connection.prepare(
      'DELETE FROM calendar_connections WHERE user_id = ? AND provider = ?'
    ).run(userId, provider);

    // Delete imported events
    db.connection.prepare(
      'DELETE FROM external_events WHERE user_id = ? AND provider = ?'
    ).run(userId, provider);

    res.json({ success: true, message: `${provider} calendar disconnected` });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
});

/**
 * POST /api/calendar/sync
 * Trigger manual sync for all connected calendars
 */
router.post('/sync', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    
    const imported = await pullExternalEvents(userId);
    
    res.json({ 
      success: true, 
      message: `Synced ${imported} events from external calendars` 
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({ error: 'Failed to sync calendars' });
  }
});

/**
 * GET /api/calendar/busy-times
 * Get busy times from external calendars for a specific date
 */
router.get('/busy-times', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter required' });
    }

    const busyTimes = getExternalBusyTimes(userId, date as string);

    res.json({ date, busyTimes });
  } catch (error) {
    console.error('Busy times error:', error);
    res.status(500).json({ error: 'Failed to get busy times' });
  }
});

/**
 * GET /api/calendar/calendars
 * Get list of available calendars for connected providers
 */
router.get('/calendars', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const result: { google?: any[]; microsoft?: any[] } = {};

    // Get Google calendars
    const googleToken = await getValidAccessToken(userId, 'google');
    if (googleToken) {
      try {
        result.google = await getGoogleCalendars(googleToken);
      } catch (e) {
        console.error('Failed to get Google calendars:', e);
      }
    }

    // Get Microsoft calendars
    const microsoftToken = await getValidAccessToken(userId, 'microsoft');
    if (microsoftToken) {
      try {
        result.microsoft = await getMicrosoftCalendars(microsoftToken);
      } catch (e) {
        console.error('Failed to get Microsoft calendars:', e);
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Get calendars error:', error);
    res.status(500).json({ error: 'Failed to get calendars' });
  }
});

/**
 * PUT /api/calendar/:provider/settings
 * Update calendar sync settings
 */
router.put('/:provider/settings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { provider } = req.params;
    const { calendarId, syncEnabled } = req.body;

    if (!['google', 'microsoft'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (calendarId !== undefined) {
      updates.push('calendar_id = ?');
      values.push(calendarId);
    }

    if (syncEnabled !== undefined) {
      updates.push('sync_enabled = ?');
      values.push(syncEnabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(userId, provider);

    db.connection.prepare(`
      UPDATE calendar_connections 
      SET ${updates.join(', ')}, updated_at = datetime('now')
      WHERE user_id = ? AND provider = ?
    `).run(...values);

    res.json({ success: true });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update calendar settings' });
  }
});

/**
 * POST /api/calendar/sync-meeting/:meetingId
 * Sync a specific meeting to connected calendars
 */
router.post('/sync-meeting/:meetingId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { meetingId } = req.params;
    
    // Verify user has access to this meeting
    const userId = (req as any).user.userId;
    const meeting = db.connection.prepare(
      'SELECT * FROM meetings WHERE id = ? AND (host_id = ? OR user_id = ?)'
    ).get(meetingId, userId, userId);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or access denied' });
    }

    const results = await syncMeetingToCalendar(meetingId);

    res.json({
      success: true,
      synced: {
        google: !!results.google,
        microsoft: !!results.microsoft
      }
    });
  } catch (error) {
    console.error('Sync meeting error:', error);
    res.status(500).json({ error: 'Failed to sync meeting' });
  }
});

export default router;

