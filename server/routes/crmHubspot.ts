/**
 * HubSpot CRM 2-way sync routes.
 *
 * OAuth: 3-legged. State is HMAC-signed via signedState({ userId }).
 * Inbound webhooks: optional X-HubSpot-Signature-v3 verification if
 * HUBSPOT_WEBHOOK_SECRET is set.
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { signState, verifyState } from '../utils/signedState';
import {
  isHubSpotConfigured,
  pushMeetingToHubSpot,
  getHubSpotAccessToken,
  HUBSPOT_CLIENT_ID,
  HUBSPOT_CLIENT_SECRET,
  HUBSPOT_REDIRECT_URI,
} from '../services/hubspotSync';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const HUBSPOT_WEBHOOK_SECRET = process.env.HUBSPOT_WEBHOOK_SECRET || '';

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

const HUBSPOT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'crm.schemas.contacts.read',
].join(' ');

router.get('/status', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const conn = db.connection.prepare(
    `SELECT portal_id, last_sync_at, sync_enabled FROM crm_connections WHERE user_id = ? AND provider = 'hubspot'`
  ).get(req.user!.userId) as any;

  res.json({
    configured: isHubSpotConfigured(),
    connected: !!conn,
    portalId: conn?.portal_id ?? null,
    lastSyncAt: conn?.last_sync_at ?? null,
    syncEnabled: conn ? !!conn.sync_enabled : false,
  });
}));

router.get('/connect', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!isHubSpotConfigured()) throw new AppError('HubSpot integration not configured', 400);
  const state = signState({ userId: req.user!.userId });
  const authUrl =
    `https://app.hubspot.com/oauth/authorize` +
    `?client_id=${encodeURIComponent(HUBSPOT_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(HUBSPOT_REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(HUBSPOT_SCOPES)}` +
    `&state=${encodeURIComponent(state)}`;
  res.json({ authUrl });
}));

router.get('/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${FRONTEND_URL}/settings?error=hubspot_auth_cancelled`);
  if (!code || !state) return res.redirect(`${FRONTEND_URL}/settings?error=invalid_callback`);

  const decoded = verifyState<{ userId: string }>(state as string);
  if (!decoded) return res.redirect(`${FRONTEND_URL}/settings?error=invalid_state`);
  const { userId } = decoded;

  try {
    const tokenRes = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        redirect_uri: HUBSPOT_REDIRECT_URI,
        code: code as string,
      }),
    });
    if (!tokenRes.ok) {
      return res.redirect(`${FRONTEND_URL}/settings?error=hubspot_token_failed`);
    }
    const tokenData: any = await tokenRes.json();
    const expiresAt = new Date(Date.now() + (Number(tokenData.expires_in) || 1800) * 1000).toISOString();

    // Get the portal/hub id from the access token info endpoint.
    let portalId: string | null = null;
    try {
      const infoRes = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(tokenData.access_token)}`);
      if (infoRes.ok) {
        const info: any = await infoRes.json();
        portalId = info.hub_id ? String(info.hub_id) : null;
      }
    } catch {}

    const existing = db.connection.prepare(
      `SELECT id FROM crm_connections WHERE user_id = ? AND provider = 'hubspot'`
    ).get(userId) as any;
    if (existing) {
      db.connection.prepare(`
        UPDATE crm_connections SET
          access_token = ?, refresh_token = ?, token_expires_at = ?, portal_id = ?, sync_enabled = 1
        WHERE id = ?
      `).run(tokenData.access_token, tokenData.refresh_token, expiresAt, portalId, existing.id);
    } else {
      db.connection.prepare(`
        INSERT INTO crm_connections (id, user_id, provider, access_token, refresh_token, token_expires_at, portal_id, sync_enabled)
        VALUES (?, ?, 'hubspot', ?, ?, ?, ?, 1)
      `).run(uuidv4(), userId, tokenData.access_token, tokenData.refresh_token, expiresAt, portalId);
    }

    res.redirect(`${FRONTEND_URL}/settings?success=hubspot_connected`);
  } catch (e) {
    console.error('HubSpot callback error:', e);
    res.redirect(`${FRONTEND_URL}/settings?error=hubspot_auth_failed`);
  }
}));

router.delete('/disconnect', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  db.connection.prepare(
    `DELETE FROM crm_connections WHERE user_id = ? AND provider = 'hubspot'`
  ).run(req.user!.userId);
  res.json({ success: true });
}));

router.post('/sync-meeting/:meetingId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const meeting = db.connection.prepare(
    `SELECT id, host_id FROM meetings WHERE id = ?`
  ).get(req.params.meetingId) as any;
  if (!meeting) throw new AppError('Meeting not found', 404);
  if (meeting.host_id !== req.user!.userId && req.user!.role !== 'admin') {
    throw new AppError('Only the host can sync this meeting', 403);
  }
  // Ensure host has a HubSpot connection.
  const tok = await getHubSpotAccessToken(meeting.host_id);
  if (!tok) throw new AppError('HubSpot not connected', 400);

  await pushMeetingToHubSpot(req.params.meetingId);
  res.json({ success: true });
}));

/**
 * Inbound HubSpot webhook. HubSpot sends signed payloads with header
 * X-HubSpot-Signature-v3. We verify when HUBSPOT_WEBHOOK_SECRET is set;
 * otherwise we accept (useful for dev).
 *
 * We only act on Meeting Created events: if the engagement's organizer email
 * maps to a known Cadence user, we mirror the meeting into Cadence.
 */
router.post('/webhooks/inbound', asyncHandler(async (req: Request, res: Response) => {
  if (HUBSPOT_WEBHOOK_SECRET) {
    const signature = req.header('X-HubSpot-Signature-v3') || '';
    const timestamp = req.header('X-HubSpot-Request-Timestamp') || '';
    const method = req.method;
    const uri = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const rawBody = JSON.stringify(req.body || {});
    const sourceString = method + uri + rawBody + timestamp;
    const expected = crypto.createHmac('sha256', HUBSPOT_WEBHOOK_SECRET).update(sourceString).digest('base64');
    try {
      const aBuf = Buffer.from(signature);
      const bBuf = Buffer.from(expected);
      if (aBuf.length !== bBuf.length || !crypto.timingSafeEqual(aBuf, bBuf)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } catch {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  // HubSpot sends an array of events. We only handle meeting creations.
  const events = Array.isArray(req.body) ? req.body : [req.body];
  for (const evt of events) {
    try {
      const subscription = String(evt?.subscriptionType || '').toLowerCase();
      if (!subscription.includes('meeting') || !subscription.includes('creat')) continue;

      const portalId = evt?.portalId ? String(evt.portalId) : null;
      const objectId = evt?.objectId ? String(evt.objectId) : null;
      if (!portalId || !objectId) continue;

      const conn = db.connection.prepare(
        `SELECT user_id FROM crm_connections WHERE provider = 'hubspot' AND portal_id = ?`
      ).get(portalId) as any;
      if (!conn) continue;
      const token = await getHubSpotAccessToken(conn.user_id);
      if (!token) continue;

      // Fetch the meeting details + associations.
      const detailRes = await fetch(
        `https://api.hubapi.com/crm/v3/objects/meetings/${encodeURIComponent(objectId)}?properties=hs_meeting_title,hs_meeting_start_time,hs_meeting_end_time,hs_meeting_body&associations=contacts`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!detailRes.ok) continue;
      const detail: any = await detailRes.json();

      const contactId = detail?.associations?.contacts?.results?.[0]?.id;
      let attendeeEmail = '';
      let attendeeName = 'HubSpot Contact';
      if (contactId) {
        const contactRes = await fetch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(contactId)}?properties=email,firstname,lastname`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (contactRes.ok) {
          const contact: any = await contactRes.json();
          attendeeEmail = contact?.properties?.email || '';
          attendeeName = [contact?.properties?.firstname, contact?.properties?.lastname].filter(Boolean).join(' ') || attendeeName;
        }
      }
      if (!attendeeEmail) continue;

      const startMs = Number(detail?.properties?.hs_meeting_start_time);
      const endMs = Number(detail?.properties?.hs_meeting_end_time);
      if (!startMs) continue;
      const startDate = new Date(startMs);
      const date = startDate.toISOString().slice(0, 10);
      const time = `${String(startDate.getUTCHours()).padStart(2, '0')}:${String(startDate.getUTCMinutes()).padStart(2, '0')}`;
      const durationMinutes = endMs && endMs > startMs ? Math.round((endMs - startMs) / 60000) : 30;
      const title = detail?.properties?.hs_meeting_title || `HubSpot Meeting: ${attendeeName}`;

      const meetingId = uuidv4();
      try {
        db.connection.prepare(`
          INSERT INTO meetings (id, title, date, time, duration_minutes, attendee_name, attendee_email,
            host_id, status, booked_by, notes, category, meeting_format)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'hubspot', ?, 'general', 'in-person')
        `).run(meetingId, title, date, time, durationMinutes, attendeeName, attendeeEmail, conn.user_id, detail?.properties?.hs_meeting_body || null);

        const connRow = db.connection.prepare(
          `SELECT id FROM crm_connections WHERE user_id = ? AND provider = 'hubspot'`
        ).get(conn.user_id) as any;
        if (connRow) {
          db.connection.prepare(`
            INSERT INTO crm_sync_events (id, connection_id, meeting_id, event_type, external_id, status)
            VALUES (?, ?, ?, 'inbound_meeting', ?, 'success')
          `).run(uuidv4(), connRow.id, meetingId, objectId);
        }
      } catch (e) {
        console.error('Failed to mirror HubSpot meeting:', e);
      }
    } catch (e) {
      console.error('HubSpot webhook event error:', e);
    }
  }

  res.json({ received: true });
}));

export default router;
