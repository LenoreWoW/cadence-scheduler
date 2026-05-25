/**
 * HubSpot 2-way sync. Pushes Cadence meetings to HubSpot as Meeting
 * engagements, associating them with the attendee contact (create if missing).
 *
 * Auth: per-user access tokens cached in crm_connections (provider='hubspot').
 * Tokens are refreshed if expired.
 */

import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID || '';
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET || '';
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI || 'http://localhost:3001/api/crm/hubspot/callback';

export function isHubSpotConfigured(): boolean {
  return Boolean(HUBSPOT_CLIENT_ID && HUBSPOT_CLIENT_SECRET);
}

export { HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET, HUBSPOT_REDIRECT_URI };

/**
 * Returns a valid access token, refreshing if expired. Returns null when the
 * connection is missing or the refresh fails.
 */
export async function getHubSpotAccessToken(userId: string): Promise<string | null> {
  const conn = db.connection.prepare(
    `SELECT id, access_token, refresh_token, token_expires_at FROM crm_connections WHERE user_id = ? AND provider = 'hubspot'`
  ).get(userId) as any;
  if (!conn) return null;

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) {
    return conn.access_token;
  }
  if (!conn.refresh_token) return null;

  try {
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        refresh_token: conn.refresh_token,
      }),
    });
    if (!response.ok) return null;
    const data: any = await response.json();
    const newExpires = new Date(Date.now() + (Number(data.expires_in) || 1800) * 1000).toISOString();
    db.connection.prepare(`
      UPDATE crm_connections SET access_token = ?, refresh_token = COALESCE(?, refresh_token), token_expires_at = ?
      WHERE id = ?
    `).run(data.access_token, data.refresh_token ?? null, newExpires, conn.id);
    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * Push a meeting to HubSpot as a Meeting engagement. Creates/uses the
 * attendee contact, then writes a meeting on /crm/v3/objects/meetings with an
 * association to the contact. Persists the resulting external id in
 * crm_sync_events for idempotency.
 */
export async function pushMeetingToHubSpot(meetingId: string): Promise<void> {
  const meeting = db.connection.prepare(`
    SELECT m.*, u.name as host_name FROM meetings m
    JOIN users u ON u.id = m.host_id
    WHERE m.id = ?
  `).get(meetingId) as any;
  if (!meeting) throw new Error('Meeting not found');

  const conn = db.connection.prepare(
    `SELECT id FROM crm_connections WHERE user_id = ? AND provider = 'hubspot'`
  ).get(meeting.host_id) as any;
  if (!conn) throw new Error('Host has no HubSpot connection');

  const token = await getHubSpotAccessToken(meeting.host_id);
  if (!token) throw new Error('HubSpot token unavailable');

  // Find or create the attendee contact (search by email).
  let contactId: string | null = null;
  try {
    const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: meeting.attendee_email }] }],
        properties: ['email'],
        limit: 1,
      }),
    });
    if (searchRes.ok) {
      const data: any = await searchRes.json();
      contactId = data.results?.[0]?.id || null;
    }
    if (!contactId) {
      const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: {
            email: meeting.attendee_email,
            firstname: (meeting.attendee_name || '').split(' ')[0] || '',
            lastname: (meeting.attendee_name || '').split(' ').slice(1).join(' ') || '',
          },
        }),
      });
      if (createRes.ok) {
        const data: any = await createRes.json();
        contactId = data.id;
      }
    }
  } catch (e) {
    // Continue without a contact association if lookup/creation fails.
  }

  // Build a UTC ms start/end for the meeting.
  const [hour, minute] = String(meeting.time).split(':').map(Number);
  const start = new Date(`${meeting.date}T00:00:00Z`);
  start.setUTCHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + (meeting.duration_minutes || 30) * 60_000);

  const meetingBody: any = {
    properties: {
      hs_timestamp: start.getTime(),
      hs_meeting_title: meeting.title,
      hs_meeting_body: meeting.notes || `Meeting with ${meeting.attendee_name} via Cadence`,
      hs_meeting_start_time: start.getTime(),
      hs_meeting_end_time: end.getTime(),
      hs_meeting_outcome: 'SCHEDULED',
    },
  };
  if (contactId) {
    meetingBody.associations = [
      {
        to: { id: contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 200 }],
      },
    ];
  }

  const meetingRes = await fetch('https://api.hubapi.com/crm/v3/objects/meetings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(meetingBody),
  });

  if (!meetingRes.ok) {
    const text = await meetingRes.text().catch(() => '');
    db.connection.prepare(`
      INSERT INTO crm_sync_events (id, connection_id, meeting_id, event_type, status, error)
      VALUES (?, ?, ?, 'push_meeting', 'failed', ?)
    `).run(uuidv4(), conn.id, meetingId, `${meetingRes.status} ${text.slice(0, 500)}`);
    throw new Error(`HubSpot meeting push failed: ${meetingRes.status}`);
  }

  const data: any = await meetingRes.json();
  db.connection.prepare(`
    INSERT INTO crm_sync_events (id, connection_id, meeting_id, event_type, external_id, status)
    VALUES (?, ?, ?, 'push_meeting', ?, 'success')
  `).run(uuidv4(), conn.id, meetingId, String(data.id));
  db.connection.prepare(`UPDATE crm_connections SET last_sync_at = datetime('now') WHERE id = ?`).run(conn.id);
}
