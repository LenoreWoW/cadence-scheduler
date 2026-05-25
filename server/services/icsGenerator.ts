/**
 * RFC 5545 iCalendar (.ics) generator for meeting attachments and feeds.
 */

export interface ICSMeeting {
  id: string;
  title: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM (24h, local to host TZ)
  durationMinutes: number;
  attendeeName: string;
  attendeeEmail: string;
  hostName: string;
  hostEmail?: string;
  meetingLink?: string;
  notes?: string;
  status?: string;       // approved/pending/cancelled/rejected
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function toICSDate(date: string, time: string): string {
  // Treat host's local time as floating (DTSTART without Z). Calendar clients
  // will display in the user's own timezone — acceptable trade-off given
  // multi-timezone handling is documented as a Tier-A item.
  const [h, m] = time.split(':').map(Number);
  const d = new Date(date + 'T00:00:00');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}${pad(m)}00`;
}

function addMinutes(date: string, time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(date + 'T00:00:00');
  d.setHours(h, m + minutes, 0, 0);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function escapeText(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function nowICS(): string {
  const d = new Date();
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function foldLine(line: string): string {
  // RFC 5545: lines > 75 octets must be folded with CRLF + space.
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    chunks.push(line.slice(i, i + 75));
    i += 75;
  }
  return chunks.join('\r\n ');
}

export function generateICSForMeeting(m: ICSMeeting): string {
  const dtstart = toICSDate(m.date, m.time);
  const dtend = addMinutes(m.date, m.time, m.durationMinutes);
  const stamp = nowICS();
  const summary = escapeText(m.title);
  const descriptionParts: string[] = [];
  if (m.notes) descriptionParts.push(m.notes);
  if (m.meetingLink) descriptionParts.push(`Join: ${m.meetingLink}`);
  const description = escapeText(descriptionParts.join('\n\n'));
  const status =
    m.status === 'cancelled' ? 'CANCELLED' : m.status === 'pending' ? 'TENTATIVE' : 'CONFIRMED';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cadence//Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(m.id)}@cadence.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description}` : '',
    `STATUS:${status}`,
    `ORGANIZER;CN=${escapeText(m.hostName)}:mailto:${escapeText(m.hostEmail || 'noreply@cadence.app')}`,
    `ATTENDEE;CN=${escapeText(m.attendeeName)};ROLE=REQ-PARTICIPANT;RSVP=FALSE:mailto:${escapeText(m.attendeeEmail)}`,
    m.meetingLink ? `URL:${escapeText(m.meetingLink)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean) as string[];

  return lines.map(foldLine).join('\r\n');
}

export function generateICSForFeed(meetings: ICSMeeting[], calendarName: string = 'Cadence'): string {
  const stamp = nowICS();
  const head = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cadence//Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];
  const tail = ['END:VCALENDAR'];

  const events = meetings.flatMap((m) => {
    const dtstart = toICSDate(m.date, m.time);
    const dtend = addMinutes(m.date, m.time, m.durationMinutes);
    const summary = escapeText(m.title);
    const descriptionParts: string[] = [];
    if (m.notes) descriptionParts.push(m.notes);
    if (m.meetingLink) descriptionParts.push(`Join: ${m.meetingLink}`);
    const description = escapeText(descriptionParts.join('\n\n'));
    const status =
      m.status === 'cancelled' ? 'CANCELLED' : m.status === 'pending' ? 'TENTATIVE' : 'CONFIRMED';

    return [
      'BEGIN:VEVENT',
      `UID:${escapeText(m.id)}@cadence.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      description ? `DESCRIPTION:${description}` : '',
      `STATUS:${status}`,
      `ORGANIZER;CN=${escapeText(m.hostName)}:mailto:${escapeText(m.hostEmail || 'noreply@cadence.app')}`,
      `ATTENDEE;CN=${escapeText(m.attendeeName)};ROLE=REQ-PARTICIPANT;RSVP=FALSE:mailto:${escapeText(m.attendeeEmail)}`,
      m.meetingLink ? `URL:${escapeText(m.meetingLink)}` : '',
      'END:VEVENT',
    ].filter(Boolean);
  }) as string[];

  return [...head, ...events, ...tail].map(foldLine).join('\r\n');
}
