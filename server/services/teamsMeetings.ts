/**
 * Microsoft Teams native meeting creation via Microsoft Graph.
 *
 * Reuses the user's calendar_connections row (provider='microsoft') for auth.
 * Granted scopes must include OnlineMeetings.ReadWrite (in addition to the
 * Calendars.ReadWrite already requested by calendarSync).
 */

import { getValidAccessToken } from './calendarSync';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';

export function isTeamsConfigured(): boolean {
  return Boolean(MICROSOFT_CLIENT_ID);
}

export interface TeamsMeetingArgs {
  subject: string;
  startTimeISO: string;
  endTimeISO: string;
  hostUserId: string;
}

export interface TeamsMeetingResult {
  id: string;
  joinUrl: string;
}

export async function createTeamsMeeting(args: TeamsMeetingArgs): Promise<TeamsMeetingResult> {
  const token = await getValidAccessToken(args.hostUserId, 'microsoft');
  if (!token) {
    throw new Error('Microsoft access token unavailable for host');
  }

  const response = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: args.subject,
      startDateTime: args.startTimeISO,
      endDateTime: args.endTimeISO,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Teams create meeting failed: ${response.status} ${text}`);
  }
  const data: any = await response.json();
  return {
    id: data.id,
    joinUrl: data.joinWebUrl,
  };
}

export async function deleteTeamsMeeting(meetingId: string, hostUserId: string): Promise<void> {
  const token = await getValidAccessToken(hostUserId, 'microsoft');
  if (!token) return; // nothing we can do; the host has disconnected MS

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/onlineMeetings/${encodeURIComponent(meetingId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '');
    throw new Error(`Teams delete meeting failed: ${response.status} ${text}`);
  }
}
