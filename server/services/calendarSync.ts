/**
 * Calendar Sync Service
 * 
 * Provides 2-way sync with Google Calendar and Microsoft Outlook
 * 
 * Features:
 * - OAuth authentication for both providers
 * - Push events from Cadence to external calendars
 * - Pull events from external calendars to show as busy times
 * - Webhook support for real-time updates
 */

import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

// OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/calendar/google/callback';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/calendar/microsoft/callback';

// Scopes needed for calendar access
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
].join(' ');

const MICROSOFT_SCOPES = [
  'offline_access',
  'Calendars.ReadWrite',
  'User.Read'
].join(' ');

// Initialize calendar connections table
export const initCalendarTables = () => {
  try {
    db.connection.exec(`
      CREATE TABLE IF NOT EXISTS calendar_connections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_expires_at TEXT,
        calendar_id TEXT,
        calendar_name TEXT,
        sync_enabled INTEGER DEFAULT 1,
        last_sync_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, provider),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.connection.exec(`
      CREATE TABLE IF NOT EXISTS external_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        external_id TEXT NOT NULL,
        title TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        all_day INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider, external_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.connection.exec(`
      CREATE TABLE IF NOT EXISTS synced_meetings (
        id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        external_event_id TEXT NOT NULL,
        sync_status TEXT DEFAULT 'synced',
        last_sync_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(meeting_id, provider),
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      )
    `);

    db.connection.exec(`
      CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON calendar_connections(user_id);
      CREATE INDEX IF NOT EXISTS idx_external_events_user ON external_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_external_events_time ON external_events(start_time, end_time);
      CREATE INDEX IF NOT EXISTS idx_synced_meetings_meeting ON synced_meetings(meeting_id);
    `);
  } catch (e) {
    // Tables might already exist
  }
};

// Check if calendar sync is configured
export function isGoogleConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

export function isMicrosoftConfigured(): boolean {
  return Boolean(MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET);
}

// ==========================================
// GOOGLE CALENDAR
// ==========================================

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_REDIRECT_URI
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google OAuth error: ${error}`);
  }
  
  return response.json();
}

export async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to refresh Google token');
  }
  
  return response.json();
}

export async function getGoogleCalendars(accessToken: string): Promise<any[]> {
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch Google calendars');
  }
  
  const data = await response.json();
  return data.items || [];
}

export async function createGoogleEvent(
  accessToken: string,
  calendarId: string,
  event: {
    title: string;
    description?: string;
    startTime: string; // ISO string
    endTime: string; // ISO string
    attendees?: { email: string; name?: string }[];
    meetingLink?: string;
    /** If true and there's no non-Google meeting link, Google auto-creates a Meet link. */
    createMeetLink?: boolean;
  }
): Promise<{ id: string; htmlLink: string; hangoutLink?: string }> {
  // If the meeting already has a non-Google video link (Zoom/Teams/Daily),
  // attach it as a custom entryPoint. Otherwise, if createMeetLink is true,
  // ask Google to auto-mint a Meet link.
  const hasExternalLink = !!event.meetingLink &&
    !/(meet\.google\.com|hangouts\.google\.com)/i.test(event.meetingLink);

  let googleEvent: any = {
    summary: event.title,
    description: event.description || '',
    start: { dateTime: event.startTime, timeZone: 'UTC' },
    end: { dateTime: event.endTime, timeZone: 'UTC' },
    attendees: event.attendees?.map(a => ({
      email: a.email,
      displayName: a.name,
    })),
  };

  if (hasExternalLink) {
    googleEvent.conferenceData = {
      entryPoints: [{ entryPointType: 'video', uri: event.meetingLink }],
    };
  } else if (event.createMeetLink) {
    const { enrichEventWithMeet } = await import('./googleMeetCreator');
    googleEvent = enrichEventWithMeet(googleEvent);
  }

  // conferenceDataVersion=1 is required for Google to honor createRequest.
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(googleEvent),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Google event: ${error}`);
  }

  return response.json();
}

export async function updateGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  updates: Partial<{
    title: string;
    description: string;
    startTime: string;
    endTime: string;
  }>
): Promise<void> {
  const googleUpdates: any = {};
  
  if (updates.title) googleUpdates.summary = updates.title;
  if (updates.description) googleUpdates.description = updates.description;
  if (updates.startTime) googleUpdates.start = { dateTime: updates.startTime, timeZone: 'UTC' };
  if (updates.endTime) googleUpdates.end = { dateTime: updates.endTime, timeZone: 'UTC' };
  
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(googleUpdates)
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to update Google event');
  }
}

export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  
  if (!response.ok && response.status !== 404) {
    throw new Error('Failed to delete Google event');
  }
}

export async function fetchGoogleEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<any[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime'
  });
  
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch Google events');
  }
  
  const data = await response.json();
  return data.items || [];
}

// ==========================================
// MICROSOFT OUTLOOK
// ==========================================

export function getMicrosoftAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: MICROSOFT_REDIRECT_URI,
    scope: MICROSOFT_SCOPES,
    response_mode: 'query',
    state
  });
  
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeMicrosoftCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: MICROSOFT_REDIRECT_URI
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Microsoft OAuth error: ${error}`);
  }
  
  return response.json();
}

export async function refreshMicrosoftToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to refresh Microsoft token');
  }
  
  return response.json();
}

export async function getMicrosoftCalendars(accessToken: string): Promise<any[]> {
  const response = await fetch(
    'https://graph.microsoft.com/v1.0/me/calendars',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch Microsoft calendars');
  }
  
  const data = await response.json();
  return data.value || [];
}

export async function createMicrosoftEvent(
  accessToken: string,
  calendarId: string,
  event: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    attendees?: { email: string; name?: string }[];
    meetingLink?: string;
  }
): Promise<{ id: string; webLink: string }> {
  const msEvent = {
    subject: event.title,
    body: {
      contentType: 'text',
      content: event.description || ''
    },
    start: {
      dateTime: event.startTime,
      timeZone: 'UTC'
    },
    end: {
      dateTime: event.endTime,
      timeZone: 'UTC'
    },
    attendees: event.attendees?.map(a => ({
      emailAddress: { address: a.email, name: a.name },
      type: 'required'
    })),
    isOnlineMeeting: !!event.meetingLink,
    onlineMeetingUrl: event.meetingLink
  };
  
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(msEvent)
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Microsoft event: ${error}`);
  }
  
  return response.json();
}

export async function updateMicrosoftEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  updates: Partial<{
    title: string;
    description: string;
    startTime: string;
    endTime: string;
  }>
): Promise<void> {
  const msUpdates: any = {};
  
  if (updates.title) msUpdates.subject = updates.title;
  if (updates.description) msUpdates.body = { contentType: 'text', content: updates.description };
  if (updates.startTime) msUpdates.start = { dateTime: updates.startTime, timeZone: 'UTC' };
  if (updates.endTime) msUpdates.end = { dateTime: updates.endTime, timeZone: 'UTC' };
  
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(msUpdates)
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to update Microsoft event');
  }
}

export async function deleteMicrosoftEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  
  if (!response.ok && response.status !== 404) {
    throw new Error('Failed to delete Microsoft event');
  }
}

export async function fetchMicrosoftEvents(
  accessToken: string,
  calendarId: string,
  startDateTime: string,
  endDateTime: string
): Promise<any[]> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/calendarView?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch Microsoft events');
  }
  
  const data = await response.json();
  return data.value || [];
}

// ==========================================
// SYNC OPERATIONS
// ==========================================

export async function getValidAccessToken(userId: string, provider: 'google' | 'microsoft'): Promise<string | null> {
  const connection = db.connection.prepare(`
    SELECT * FROM calendar_connections WHERE user_id = ? AND provider = ?
  `).get(userId, provider) as any;
  
  if (!connection) return null;
  
  const now = new Date();
  const expiresAt = new Date(connection.token_expires_at);
  
  // If token is still valid (with 5 min buffer), return it
  if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
    return connection.access_token;
  }
  
  // Need to refresh
  if (!connection.refresh_token) return null;
  
  try {
    let newToken;
    if (provider === 'google') {
      newToken = await refreshGoogleToken(connection.refresh_token);
    } else {
      newToken = await refreshMicrosoftToken(connection.refresh_token);
    }
    
    const newExpiresAt = new Date(Date.now() + newToken.expires_in * 1000);
    
    db.connection.prepare(`
      UPDATE calendar_connections 
      SET access_token = ?, token_expires_at = ?, updated_at = datetime('now')
      WHERE user_id = ? AND provider = ?
    `).run(newToken.access_token, newExpiresAt.toISOString(), userId, provider);
    
    // Update refresh token if provided (Microsoft returns new one)
    if ('refresh_token' in newToken && newToken.refresh_token) {
      db.connection.prepare(`
        UPDATE calendar_connections SET refresh_token = ? WHERE user_id = ? AND provider = ?
      `).run(newToken.refresh_token, userId, provider);
    }
    
    return newToken.access_token;
  } catch (error) {
    console.error(`Failed to refresh ${provider} token:`, error);
    return null;
  }
}

export async function syncMeetingToCalendar(meetingId: string): Promise<{ google?: string; microsoft?: string }> {
  const meeting = db.connection.prepare(`
    SELECT m.*, u.email as host_email, u.name as host_name
    FROM meetings m
    LEFT JOIN users u ON u.id = m.host_id
    WHERE m.id = ?
  `).get(meetingId) as any;
  
  if (!meeting || meeting.status === 'cancelled') return {};
  
  const results: { google?: string; microsoft?: string } = {};
  
  // Calculate start and end times
  const [hours, minutes] = meeting.time.split(':').map(Number);
  const startDate = new Date(meeting.date);
  startDate.setHours(hours, minutes, 0, 0);
  const endDate = new Date(startDate.getTime() + meeting.duration_minutes * 60 * 1000);
  
  const eventData = {
    title: meeting.title,
    description: `Meeting with ${meeting.attendee_name}\n\nBooked via Cadence Scheduler`,
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
    attendees: [{ email: meeting.attendee_email, name: meeting.attendee_name }],
    meetingLink: meeting.meeting_link,
    // Auto-create a Google Meet link when this is an online meeting without
    // an external (Zoom/Teams/Daily) link already attached.
    createMeetLink: meeting.meeting_format === 'online' &&
      (!meeting.meeting_link || /(meet\.google\.com|hangouts\.google\.com)/i.test(meeting.meeting_link)),
  };

  // Sync to Google
  const googleToken = await getValidAccessToken(meeting.host_id, 'google');
  if (googleToken) {
    const connection = db.connection.prepare(`
      SELECT calendar_id FROM calendar_connections WHERE user_id = ? AND provider = 'google'
    `).get(meeting.host_id) as any;

    if (connection?.calendar_id) {
      try {
        // Check if already synced
        const existing = db.connection.prepare(`
          SELECT external_event_id FROM synced_meetings WHERE meeting_id = ? AND provider = 'google'
        `).get(meetingId) as any;

        if (existing) {
          // Update existing event
          await updateGoogleEvent(googleToken, connection.calendar_id, existing.external_event_id, eventData);
          results.google = existing.external_event_id;
        } else {
          // Create new event
          const event = await createGoogleEvent(googleToken, connection.calendar_id, eventData);

          db.connection.prepare(`
            INSERT INTO synced_meetings (id, meeting_id, provider, external_event_id)
            VALUES (?, ?, 'google', ?)
          `).run(uuidv4(), meetingId, event.id);

          results.google = event.id;

          // If Google minted a fresh Meet link, write it back to the meeting
          // so confirmation emails + the UI surface the actual join URL.
          if (event.hangoutLink && !meeting.meeting_link) {
            try {
              db.connection.prepare(
                `UPDATE meetings SET meeting_link = ?, meeting_platform = COALESCE(meeting_platform, 'google-meet') WHERE id = ?`
              ).run(event.hangoutLink, meetingId);
            } catch (e) {
              console.error('Failed to persist Google Meet link:', e);
            }
          }
        }
      } catch (error) {
        console.error('Failed to sync to Google:', error);
      }
    }
  }
  
  // Sync to Microsoft
  const microsoftToken = await getValidAccessToken(meeting.host_id, 'microsoft');
  if (microsoftToken) {
    const connection = db.connection.prepare(`
      SELECT calendar_id FROM calendar_connections WHERE user_id = ? AND provider = 'microsoft'
    `).get(meeting.host_id) as any;
    
    if (connection?.calendar_id) {
      try {
        const existing = db.connection.prepare(`
          SELECT external_event_id FROM synced_meetings WHERE meeting_id = ? AND provider = 'microsoft'
        `).get(meetingId) as any;
        
        if (existing) {
          await updateMicrosoftEvent(microsoftToken, connection.calendar_id, existing.external_event_id, eventData);
          results.microsoft = existing.external_event_id;
        } else {
          const event = await createMicrosoftEvent(microsoftToken, connection.calendar_id, eventData);
          
          db.connection.prepare(`
            INSERT INTO synced_meetings (id, meeting_id, provider, external_event_id)
            VALUES (?, ?, 'microsoft', ?)
          `).run(uuidv4(), meetingId, event.id);
          
          results.microsoft = event.id;
        }
      } catch (error) {
        console.error('Failed to sync to Microsoft:', error);
      }
    }
  }
  
  return results;
}

export async function deleteSyncedEvent(meetingId: string): Promise<void> {
  const meeting = db.connection.prepare('SELECT host_id FROM meetings WHERE id = ?').get(meetingId) as any;
  if (!meeting) return;
  
  const syncedEvents = db.connection.prepare(`
    SELECT * FROM synced_meetings WHERE meeting_id = ?
  `).all(meetingId) as any[];
  
  for (const synced of syncedEvents) {
    try {
      const token = await getValidAccessToken(meeting.host_id, synced.provider);
      if (!token) continue;
      
      const connection = db.connection.prepare(`
        SELECT calendar_id FROM calendar_connections WHERE user_id = ? AND provider = ?
      `).get(meeting.host_id, synced.provider) as any;
      
      if (!connection?.calendar_id) continue;
      
      if (synced.provider === 'google') {
        await deleteGoogleEvent(token, connection.calendar_id, synced.external_event_id);
      } else {
        await deleteMicrosoftEvent(token, connection.calendar_id, synced.external_event_id);
      }
    } catch (error) {
      console.error(`Failed to delete ${synced.provider} event:`, error);
    }
  }
  
  db.connection.prepare('DELETE FROM synced_meetings WHERE meeting_id = ?').run(meetingId);
}

export async function pullExternalEvents(userId: string): Promise<number> {
  let totalImported = 0;
  
  const now = new Date();
  const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead
  
  // Pull from Google
  const googleToken = await getValidAccessToken(userId, 'google');
  if (googleToken) {
    const connection = db.connection.prepare(`
      SELECT calendar_id FROM calendar_connections WHERE user_id = ? AND provider = 'google'
    `).get(userId) as any;
    
    if (connection?.calendar_id) {
      try {
        const events = await fetchGoogleEvents(
          googleToken, 
          connection.calendar_id,
          now.toISOString(),
          futureDate.toISOString()
        );
        
        for (const event of events) {
          if (!event.start?.dateTime) continue; // Skip all-day events for now
          
          db.connection.prepare(`
            INSERT OR REPLACE INTO external_events (id, user_id, provider, external_id, title, start_time, end_time, updated_at)
            VALUES (?, ?, 'google', ?, ?, ?, ?, datetime('now'))
          `).run(
            uuidv4(),
            userId,
            event.id,
            event.summary || 'Busy',
            event.start.dateTime,
            event.end.dateTime
          );
          totalImported++;
        }
        
        // Update last sync time
        db.connection.prepare(`
          UPDATE calendar_connections SET last_sync_at = datetime('now') WHERE user_id = ? AND provider = 'google'
        `).run(userId);
      } catch (error) {
        console.error('Failed to pull Google events:', error);
      }
    }
  }
  
  // Pull from Microsoft
  const microsoftToken = await getValidAccessToken(userId, 'microsoft');
  if (microsoftToken) {
    const connection = db.connection.prepare(`
      SELECT calendar_id FROM calendar_connections WHERE user_id = ? AND provider = 'microsoft'
    `).get(userId) as any;

    if (connection?.calendar_id) {
      try {
        const events = await fetchMicrosoftEvents(
          microsoftToken,
          connection.calendar_id,
          now.toISOString(),
          futureDate.toISOString()
        );

        for (const event of events) {
          db.connection.prepare(`
            INSERT OR REPLACE INTO external_events (id, user_id, provider, external_id, title, start_time, end_time, all_day, updated_at)
            VALUES (?, ?, 'microsoft', ?, ?, ?, ?, ?, datetime('now'))
          `).run(
            uuidv4(),
            userId,
            event.id,
            event.subject || 'Busy',
            event.start.dateTime,
            event.end.dateTime,
            event.isAllDay ? 1 : 0
          );
          totalImported++;
        }

        db.connection.prepare(`
          UPDATE calendar_connections SET last_sync_at = datetime('now') WHERE user_id = ? AND provider = 'microsoft'
        `).run(userId);
      } catch (error) {
        console.error('Failed to pull Microsoft events:', error);
      }
    }
  }

  // Pull from CalDAV (Apple/Yahoo/Fastmail/generic) — lazy import to avoid cycles.
  try {
    const caldavRow = db.connection.prepare(
      `SELECT id FROM calendar_connections WHERE user_id = ? AND provider = 'caldav'`
    ).get(userId);
    if (caldavRow) {
      const { pullCalDavEvents } = await import('./calDavSync');
      await pullCalDavEvents(userId);
      // pullCalDavEvents writes directly to external_events; we don't have a
      // per-call count, so we don't increment totalImported for caldav.
    }
  } catch (error) {
    console.error('Failed to pull CalDAV events:', error);
  }

  return totalImported;
}

export function getExternalBusyTimes(userId: string, date: string): { start: string; end: string; title: string }[] {
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  
  const events = db.connection.prepare(`
    SELECT title, start_time, end_time FROM external_events
    WHERE user_id = ? AND start_time >= ? AND start_time <= ?
    ORDER BY start_time
  `).all(userId, dayStart, dayEnd) as any[];
  
  return events.map(e => ({
    start: e.start_time,
    end: e.end_time,
    title: e.title
  }));
}

// NOTE: Do NOT initialize tables at module-load time — db.initialize() may
// not have run yet. database.ts#runMigrations() invokes initCalendarTables()
// after the core schema is in place.

export default {
  isGoogleConfigured,
  isMicrosoftConfigured,
  getGoogleAuthUrl,
  getMicrosoftAuthUrl,
  exchangeGoogleCode,
  exchangeMicrosoftCode,
  getGoogleCalendars,
  getMicrosoftCalendars,
  syncMeetingToCalendar,
  deleteSyncedEvent,
  pullExternalEvents,
  getExternalBusyTimes,
  getValidAccessToken
};

