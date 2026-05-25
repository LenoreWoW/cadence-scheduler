/**
 * Zoom Server-to-Server OAuth integration.
 *
 * Uses the Account Credentials grant (server-to-server) — no user-level OAuth
 * dance required. The account-level token is exchanged with
 * ZOOM_ACCOUNT_ID + ZOOM_CLIENT_ID + ZOOM_CLIENT_SECRET and cached in-memory
 * until expiry.
 */

const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID || '';
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID || '';
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET || '';

let cachedToken: { token: string; expiresAt: number } | null = null;

export function isZoomConfigured(): boolean {
  return Boolean(ZOOM_ACCOUNT_ID && ZOOM_CLIENT_ID && ZOOM_CLIENT_SECRET);
}

export async function getZoomAccessToken(): Promise<string> {
  if (!isZoomConfigured()) {
    throw new Error('Zoom integration not configured');
  }
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }

  const basic = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');
  const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(ZOOM_ACCOUNT_ID)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Zoom token exchange failed: ${response.status} ${text}`);
  }
  const data: any = await response.json();
  const expiresInMs = (Number(data.expires_in) || 3500) * 1000;
  cachedToken = { token: data.access_token, expiresAt: Date.now() + expiresInMs };
  return cachedToken.token;
}

export interface ZoomMeetingArgs {
  topic: string;
  startTimeISO: string;
  durationMinutes: number;
  timezone?: string;
  hostEmail?: string;
}

export interface ZoomMeetingResult {
  id: string;
  joinUrl: string;
  password: string;
}

/**
 * Create a scheduled (type 2) Zoom meeting. If `hostEmail` is provided, the
 * meeting is created on that user's account; otherwise it falls back to
 * `/users/me/meetings` (the account owner of the S2S app).
 */
export async function createZoomMeeting(args: ZoomMeetingArgs): Promise<ZoomMeetingResult> {
  const token = await getZoomAccessToken();
  const userPath = args.hostEmail ? encodeURIComponent(args.hostEmail) : 'me';
  const response = await fetch(`https://api.zoom.us/v2/users/${userPath}/meetings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: args.topic,
      type: 2, // scheduled meeting
      start_time: args.startTimeISO,
      duration: args.durationMinutes,
      timezone: args.timezone || 'UTC',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        waiting_room: true,
      },
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Zoom create meeting failed: ${response.status} ${text}`);
  }
  const data: any = await response.json();
  return {
    id: String(data.id),
    joinUrl: data.join_url,
    password: data.password || '',
  };
}

export async function deleteZoomMeeting(zoomMeetingId: string): Promise<void> {
  const token = await getZoomAccessToken();
  const response = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(zoomMeetingId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  // 204 = deleted; 404 = already gone (treat as success).
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '');
    throw new Error(`Zoom delete meeting failed: ${response.status} ${text}`);
  }
}
