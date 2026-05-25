/**
 * Daily.co video integration.
 *
 * Two configuration paths:
 *   1. Account-wide via env: DAILY_API_KEY (+ optional DAILY_DOMAIN).
 *   2. Per-user via a row in video_connections (provider='daily').
 *
 * The booking flow calls isDailyConfigured(hostUserId) before creating a room.
 */
import { db } from '../database';

const DAILY_API_KEY_ENV = process.env.DAILY_API_KEY || '';
const DAILY_DOMAIN_ENV = process.env.DAILY_DOMAIN || '';

interface DailyConnectionRow {
  api_key: string | null;
  domain: string | null;
  enabled: number;
}

function getUserConnection(userId?: string | null): DailyConnectionRow | null {
  if (!userId) return null;
  try {
    const row = db.connection.prepare(`
      SELECT api_key, domain, enabled FROM video_connections
      WHERE user_id = ? AND provider = 'daily'
      LIMIT 1
    `).get(userId) as any;
    if (!row || !row.enabled) return null;
    return row as DailyConnectionRow;
  } catch {
    return null;
  }
}

export function isDailyConfigured(forUserId?: string | null): boolean {
  if (DAILY_API_KEY_ENV) return true;
  const conn = getUserConnection(forUserId);
  return !!(conn && conn.api_key);
}

function getCreds(forUserId?: string | null): { apiKey: string; domain: string | null } | null {
  const conn = getUserConnection(forUserId);
  if (conn && conn.api_key) {
    return { apiKey: conn.api_key, domain: conn.domain || DAILY_DOMAIN_ENV || null };
  }
  if (DAILY_API_KEY_ENV) {
    return { apiKey: DAILY_API_KEY_ENV, domain: DAILY_DOMAIN_ENV || null };
  }
  return null;
}

export interface DailyRoomArgs {
  topic: string;
  durationMinutes: number;
  forUserId?: string | null;
}

export interface DailyRoomResult {
  url: string;
  name: string;
}

/** Sanitize a topic/name for Daily room slugs — lowercase, alnum, dash, <=40 chars. */
function safeName(topic: string): string {
  const base = topic
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${base || 'meeting'}-${suffix}`;
}

export async function createDailyRoom(args: DailyRoomArgs): Promise<DailyRoomResult> {
  const creds = getCreds(args.forUserId);
  if (!creds) throw new Error('Daily.co integration not configured');

  const expSeconds = Math.floor(Date.now() / 1000) + Math.max(5, args.durationMinutes) * 60;
  const name = safeName(args.topic);

  const response = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      properties: {
        exp: expSeconds,
        max_participants: 10,
        enable_chat: true,
        enable_screenshare: true,
        eject_at_room_exp: true,
      },
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Daily create-room failed (${response.status}): ${text.slice(0, 200)}`);
  }
  const data: any = await response.json();
  const domain = creds.domain || (data.domain_name ? `${data.domain_name}.daily.co` : 'daily.co');
  const url: string = data.url || `https://${domain}/${data.name || name}`;
  return { url, name: data.name || name };
}

export async function deleteDailyRoom(name: string, forUserId?: string | null): Promise<void> {
  const creds = getCreds(forUserId);
  if (!creds) return;
  const response = await fetch(`https://api.daily.co/v1/rooms/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${creds.apiKey}` },
  });
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '');
    throw new Error(`Daily delete-room failed (${response.status}): ${text.slice(0, 200)}`);
  }
}

export interface DailyRecording {
  id: string;
  url?: string;
  mp4_url?: string;
  duration: number;
}

export async function getRecordings(roomName: string, forUserId?: string | null): Promise<DailyRecording[]> {
  const creds = getCreds(forUserId);
  if (!creds) throw new Error('Daily.co integration not configured');

  const response = await fetch(
    `https://api.daily.co/v1/recordings?room_name=${encodeURIComponent(roomName)}`,
    { headers: { Authorization: `Bearer ${creds.apiKey}` } }
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Daily list-recordings failed (${response.status}): ${text.slice(0, 200)}`);
  }
  const data: any = await response.json();
  const items: any[] = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  return items.map((r: any) => ({
    id: String(r.id || ''),
    url: r.download_link || r.s3_link || undefined,
    mp4_url: r.mp4_url || r.download_link || undefined,
    duration: Number(r.duration || 0),
  }));
}

export default {
  isDailyConfigured,
  createDailyRoom,
  deleteDailyRoom,
  getRecordings,
};
