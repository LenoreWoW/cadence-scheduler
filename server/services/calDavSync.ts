/**
 * CalDAV Sync Service
 *
 * Generic CalDAV client for Apple iCloud, Yahoo, Fastmail, and any
 * standards-compliant CalDAV server. Implements a minimal raw-XML
 * CalDAV client over fetch (PROPFIND + REPORT + PUT + DELETE).
 *
 * Auth is HTTP Basic with username + password (or app-specific password
 * for iCloud). Credentials live in `calendar_connections`:
 *   - access_token column re-used for username
 *   - dav_password column for plaintext password
 *   - server_url column for the CalDAV root URL
 *
 * Token security: same risk profile as the existing OAuth tokens — stored
 * in cleartext alongside them.
 */
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

// ---------- types ----------

export interface CalDavCalendar {
  url: string;
  displayName: string;
  primary: boolean;
}

export interface CalDavConnectResult {
  calendars: CalDavCalendar[];
}

interface CalDavRow {
  user_id: string;
  server_url: string;
  access_token: string; // username
  dav_password: string;
  calendar_id: string | null;
}

// ---------- env / configured check ----------

/** CalDAV requires no env config — user provides credentials at connect time. */
export function isCalDavConfigured(): boolean {
  return true;
}

// ---------- autodiscover ----------

const WELL_KNOWN_PROVIDERS: Record<string, string> = {
  'icloud.com': 'https://caldav.icloud.com',
  'me.com': 'https://caldav.icloud.com',
  'mac.com': 'https://caldav.icloud.com',
  'yahoo.com': 'https://caldav.calendar.yahoo.com',
  'fastmail.com': 'https://caldav.fastmail.com/dav/calendars',
  'fastmail.fm': 'https://caldav.fastmail.com/dav/calendars',
};

/**
 * Discover a CalDAV server URL for an email address. Tries:
 *   1. Known-template lookup (iCloud, Yahoo, Fastmail).
 *   2. SRV record `_caldavs._tcp.<domain>` via Node's dns/promises.
 *   3. Throws if not discoverable - caller should ask for manual URL.
 */
export async function discoverCalDavServer(email: string): Promise<string> {
  const at = email.indexOf('@');
  if (at < 0) throw new Error('Invalid email');
  const domain = email.slice(at + 1).toLowerCase();

  const known = WELL_KNOWN_PROVIDERS[domain];
  if (known) return known;

  try {
    const dns = await import('dns/promises');
    const records = await dns.resolveSrv(`_caldavs._tcp.${domain}`);
    if (records && records.length > 0) {
      const best = records.sort((a, b) => a.priority - b.priority)[0];
      const port = best.port === 443 ? '' : `:${best.port}`;
      return `https://${best.name.replace(/\.$/, '')}${port}`;
    }
  } catch {
    // SRV lookup is best-effort.
  }

  throw new Error(`No CalDAV server discovered for domain "${domain}". Provide a server URL manually.`);
}

// ---------- low-level XML helpers ----------

function basicAuth(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

async function davRequest(
  url: string,
  method: string,
  username: string,
  password: string,
  body: string | null,
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; text: string }> {
  const headers: Record<string, string> = {
    Authorization: basicAuth(username, password),
    'Content-Type': body && body.trim().startsWith('<') ? 'application/xml; charset=utf-8' : 'text/calendar; charset=utf-8',
    ...extraHeaders,
  };
  const response = await fetch(url, {
    method,
    headers,
    body: body ?? undefined,
  });
  const text = await response.text().catch(() => '');
  return { status: response.status, text };
}

/** Extract the inner text of the first matching tag (namespace-stripped). */
function extractTag(xml: string, localName: string): string | null {
  const re = new RegExp(`<(?:[A-Za-z0-9]+:)?${localName}[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9]+:)?${localName}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

/** Extract all instances of inner text for a tag. */
function extractAllTags(xml: string, localName: string): string[] {
  const re = new RegExp(`<(?:[A-Za-z0-9]+:)?${localName}[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9]+:)?${localName}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}

/** Parse multistatus <response> blocks into [{ href, props }] */
function parseResponses(xml: string): { href: string; xml: string }[] {
  const re = /<(?:[A-Za-z0-9]+:)?response[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9]+:)?response>/gi;
  const out: { href: string; xml: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const href = extractTag(block, 'href') || '';
    out.push({ href, xml: block });
  }
  return out;
}

function joinUrl(base: string, ref: string): string {
  if (!ref) return base;
  if (/^https?:\/\//i.test(ref)) return ref;
  try {
    return new URL(ref, base).toString();
  } catch {
    return base.replace(/\/+$/, '') + '/' + ref.replace(/^\/+/, '');
  }
}

// ---------- discovery: principal + home-set ----------

async function fetchCurrentUserPrincipal(serverUrl: string, username: string, password: string): Promise<string> {
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`;
  const { status, text } = await davRequest(serverUrl, 'PROPFIND', username, password, body, { Depth: '0' });
  if (status === 401 || status === 403) throw new Error('CalDAV authentication failed');
  if (status >= 400 && status !== 207) throw new Error(`CalDAV principal lookup failed (${status})`);
  const principalHref = extractTag(text, 'current-user-principal');
  if (!principalHref) {
    return serverUrl;
  }
  const inner = extractTag(principalHref, 'href') || principalHref;
  return joinUrl(serverUrl, inner);
}

async function fetchCalendarHomeSet(principalUrl: string, username: string, password: string): Promise<string> {
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set/></d:prop>
</d:propfind>`;
  const { status, text } = await davRequest(principalUrl, 'PROPFIND', username, password, body, { Depth: '0' });
  if (status >= 400 && status !== 207) throw new Error(`CalDAV home-set lookup failed (${status})`);
  const homeSet = extractTag(text, 'calendar-home-set');
  if (!homeSet) return principalUrl;
  const inner = extractTag(homeSet, 'href') || homeSet;
  return joinUrl(principalUrl, inner);
}

async function fetchCalendars(homeSetUrl: string, username: string, password: string): Promise<CalDavCalendar[]> {
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:resourcetype/>
    <d:displayname/>
    <c:supported-calendar-component-set/>
  </d:prop>
</d:propfind>`;
  const { status, text } = await davRequest(homeSetUrl, 'PROPFIND', username, password, body, { Depth: '1' });
  if (status >= 400 && status !== 207) throw new Error(`CalDAV calendar listing failed (${status})`);

  const calendars: CalDavCalendar[] = [];
  for (const r of parseResponses(text)) {
    const isCal = /<(?:[A-Za-z0-9]+:)?calendar\b/i.test(r.xml);
    if (!isCal) continue;
    const compSet = extractTag(r.xml, 'supported-calendar-component-set');
    if (compSet && !/VEVENT/i.test(compSet)) continue;
    const displayName = extractTag(r.xml, 'displayname') || r.href;
    calendars.push({
      url: joinUrl(homeSetUrl, r.href),
      displayName: displayName.replace(/<[^>]+>/g, '').trim() || 'Calendar',
      primary: false,
    });
  }
  if (calendars.length > 0) calendars[0].primary = true;
  return calendars;
}

// ---------- public: connect ----------

export async function connectCalDav(
  userId: string,
  serverUrl: string,
  username: string,
  password: string
): Promise<CalDavConnectResult> {
  const normalizedServer = serverUrl.replace(/\/+$/, '');
  const principalUrl = await fetchCurrentUserPrincipal(normalizedServer, username, password);
  const homeSet = await fetchCalendarHomeSet(principalUrl, username, password);
  const calendars = await fetchCalendars(homeSet, username, password);
  if (calendars.length === 0) {
    throw new Error('No calendars found on this CalDAV account');
  }
  const primary = calendars[0];

  const existing = db.connection.prepare(
    'SELECT id FROM calendar_connections WHERE user_id = ? AND provider = ?'
  ).get(userId, 'caldav') as any;

  const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  if (existing) {
    db.connection.prepare(`
      UPDATE calendar_connections
      SET access_token = ?, refresh_token = NULL, token_expires_at = ?,
          server_url = ?, dav_password = ?,
          calendar_id = ?, calendar_name = ?, sync_enabled = 1,
          updated_at = datetime('now')
      WHERE user_id = ? AND provider = 'caldav'
    `).run(username, farFuture, normalizedServer, password, primary.url, primary.displayName, userId);
  } else {
    db.connection.prepare(`
      INSERT INTO calendar_connections
      (id, user_id, provider, access_token, refresh_token, token_expires_at,
       server_url, dav_password, calendar_id, calendar_name)
      VALUES (?, ?, 'caldav', ?, NULL, ?, ?, ?, ?, ?)
    `).run(uuidv4(), userId, username, farFuture, normalizedServer, password, primary.url, primary.displayName);
  }

  return { calendars };
}

// ---------- public: pull events ----------

function getCalDavRow(userId: string): CalDavRow | null {
  const row = db.connection.prepare(`
    SELECT user_id, server_url, access_token, dav_password, calendar_id
    FROM calendar_connections
    WHERE user_id = ? AND provider = 'caldav'
  `).get(userId) as any;
  if (!row || !row.server_url || !row.dav_password || !row.calendar_id) return null;
  return row as CalDavRow;
}

/** Format UTC datetime like 20240115T100000Z for CalDAV time-range queries. */
function fmtCalDavDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Pull a couple of well-known props out of one VEVENT block. */
function parseVEvent(ics: string): { uid: string; summary: string; dtstart: string; dtend: string; allDay: boolean } | null {
  // Unfold per RFC 5545.
  const unfolded = ics.replace(/\r?\n[ \t]/g, '');
  const eventMatch = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/);
  if (!eventMatch) return null;
  const event = eventMatch[0];
  const get = (key: string): string | null => {
    const m = event.match(new RegExp(`^${key}(?:;[^:\\n]*)?:(.+)$`, 'm'));
    return m ? m[1].trim() : null;
  };
  const uid = get('UID');
  const summary = get('SUMMARY') || 'Busy';
  const dtstartRaw = event.match(/^DTSTART(?:;[^:\n]*)?:(.+)$/m);
  const dtendRaw = event.match(/^DTEND(?:;[^:\n]*)?:(.+)$/m);
  if (!uid || !dtstartRaw) return null;

  const allDay = dtstartRaw[0].includes('VALUE=DATE');
  const dtstart = toIsoFromCalDav(dtstartRaw[1].trim(), allDay);
  const dtend = dtendRaw ? toIsoFromCalDav(dtendRaw[1].trim(), allDay) : dtstart;

  return { uid, summary, dtstart, dtend, allDay };
}

function toIsoFromCalDav(value: string, allDay: boolean): string {
  if (allDay && /^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00.000Z`;
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return new Date(value).toISOString();
  const [, y, mo, d, h, mi, s, z] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? 'Z' : 'Z'}`;
  return iso;
}

export async function pullCalDavEvents(userId: string): Promise<void> {
  const row = getCalDavRow(userId);
  if (!row) return;

  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  const body = `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${fmtCalDavDate(start)}" end="${fmtCalDavDate(end)}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

  const { status, text } = await davRequest(
    row.calendar_id!,
    'REPORT',
    row.access_token,
    row.dav_password,
    body,
    { Depth: '1' }
  );
  if (status >= 400 && status !== 207) {
    throw new Error(`CalDAV REPORT failed (${status})`);
  }

  const calData = extractAllTags(text, 'calendar-data');
  for (const ics of calData) {
    const decoded = ics
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    const parsed = parseVEvent(decoded);
    if (!parsed) continue;
    try {
      db.connection.prepare(`
        INSERT OR REPLACE INTO external_events
        (id, user_id, provider, external_id, title, start_time, end_time, all_day, updated_at)
        VALUES (?, ?, 'caldav', ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        uuidv4(),
        userId,
        parsed.uid,
        parsed.summary,
        parsed.dtstart,
        parsed.dtend,
        parsed.allDay ? 1 : 0
      );
    } catch (e) {
      console.error('Failed to upsert CalDAV event:', e);
    }
  }

  db.connection.prepare(`
    UPDATE calendar_connections SET last_sync_at = datetime('now')
    WHERE user_id = ? AND provider = 'caldav'
  `).run(userId);
}

// ---------- public: push event (PUT ICS) ----------

export interface CalDavMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  hostName?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  meetingLink?: string;
  notes?: string;
  hostId?: string;
}

function pad2(n: number): string { return n.toString().padStart(2, '0'); }

function buildICS(meeting: CalDavMeeting, uid: string): string {
  const [h, m] = meeting.time.split(':').map(Number);
  const start = new Date(`${meeting.date}T${pad2(h)}:${pad2(m)}:00Z`);
  const end = new Date(start.getTime() + meeting.durationMinutes * 60_000);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
  const dtstamp = fmt(new Date());
  const summary = (meeting.title || 'Meeting').replace(/[\r\n]+/g, ' ');
  const description = (meeting.notes || '').replace(/[\r\n]+/g, '\\n');
  const location = (meeting.meetingLink || '').replace(/[\r\n]+/g, ' ');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cadence//CalDAV//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description}` : '',
    location ? `LOCATION:${location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

/**
 * PUT an iCal resource to the user's primary CalDAV calendar.
 * The host user (meeting.hostId) is the CalDAV account owner.
 */
export async function pushCalDavEvent(meeting: CalDavMeeting): Promise<{ uid: string }> {
  if (!meeting.hostId) throw new Error('pushCalDavEvent requires meeting.hostId');
  const row = getCalDavRow(meeting.hostId);
  if (!row) throw new Error('No CalDAV connection for host');

  const uid = `${meeting.id}@cadence.local`;
  const ics = buildICS(meeting, uid);
  const resourceUrl = row.calendar_id!.replace(/\/+$/, '') + `/${encodeURIComponent(uid)}.ics`;

  const { status, text } = await davRequest(
    resourceUrl,
    'PUT',
    row.access_token,
    row.dav_password,
    ics,
    { 'Content-Type': 'text/calendar; charset=utf-8' }
  );
  if (status >= 400) {
    throw new Error(`CalDAV PUT failed (${status}): ${text.slice(0, 200)}`);
  }
  return { uid };
}

export async function deleteCalDavEvent(uid: string, userId: string): Promise<void> {
  const row = getCalDavRow(userId);
  if (!row) return;
  const resourceUrl = row.calendar_id!.replace(/\/+$/, '') + `/${encodeURIComponent(uid)}.ics`;
  const { status } = await davRequest(
    resourceUrl,
    'DELETE',
    row.access_token,
    row.dav_password,
    null
  );
  if (status >= 400 && status !== 404) {
    throw new Error(`CalDAV DELETE failed (${status})`);
  }
}

export default {
  isCalDavConfigured,
  discoverCalDavServer,
  connectCalDav,
  pullCalDavEvents,
  pushCalDavEvent,
  deleteCalDavEvent,
};
