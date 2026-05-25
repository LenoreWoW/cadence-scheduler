/**
 * Booking-related transactional emails.
 *
 * Each helper sends a styled HTML email plus an iCalendar (.ics) attachment so
 * the meeting auto-adds to the recipient's calendar. The confirmation email
 * also includes a tokenized reschedule/cancel link the attendee can use
 * without an account.
 */

import { getEmailProvider } from './emailProvider';
import { generateICSForMeeting } from './icsGenerator';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function htmlEscape(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(u: unknown): string | null {
  if (typeof u !== 'string') return null;
  if (!u.startsWith('http://') && !u.startsWith('https://')) return null;
  if (u.length > 2000) return null;
  return u;
}

interface BaseArgs {
  meetingId: string;
  meetingTitle: string;
  date: string;            // YYYY-MM-DD
  time: string;            // HH:MM
  durationMinutes: number;
  attendeeName: string;
  attendeeEmail: string;
  hostName: string;
  hostEmail?: string;
  meetingLink?: string;
  notes?: string;
}

export interface ConfirmationArgs extends BaseArgs {
  attendeeToken: string;
}

function pad(n: number): string { return n.toString().padStart(2, '0'); }

/**
 * Build Google / Outlook web URLs for Add-to-Calendar buttons. These are
 * pure links (no API calls) — recipient's logged-in browser handles it.
 */
function addToCalendarUrls(args: BaseArgs) {
  const [h, m] = args.time.split(':').map(Number);
  const start = new Date(args.date + 'T00:00:00');
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + args.durationMinutes * 60_000);

  // Google expects YYYYMMDDTHHMMSSZ (UTC).
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const dates = `${fmt(start)}/${fmt(end)}`;
  const details = args.notes || `Meeting with ${args.hostName}`;
  const location = args.meetingLink || '';

  const google =
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(args.meetingTitle)}` +
    `&dates=${dates}` +
    `&details=${encodeURIComponent(details)}` +
    (location ? `&location=${encodeURIComponent(location)}` : '');

  const outlook =
    'https://outlook.live.com/calendar/0/deeplink/compose' +
    `?subject=${encodeURIComponent(args.meetingTitle)}` +
    `&startdt=${start.toISOString()}&enddt=${end.toISOString()}` +
    `&body=${encodeURIComponent(details)}` +
    (location ? `&location=${encodeURIComponent(location)}` : '');

  return { google, outlook };
}

function emailShell(title: string, headerColor: string, contentHtml: string, footerHtml: string = 'Cadence'): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:20px;background:#f5f5f5;font-family:-apple-system,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.08);">
    <div style="background:${headerColor};color:white;padding:30px;text-align:center;">
      <h1 style="margin:0;font-size:24px;font-weight:600;">${title}</h1>
    </div>
    <div style="padding:30px;color:#1a1a1a;">${contentHtml}</div>
    <div style="padding:20px 30px;background:#f9f9f9;border-top:1px solid #eee;text-align:center;color:#888;font-size:12px;">${footerHtml}</div>
  </div>
</body>
</html>`;
}

function detailBlock(label: string, value: string): string {
  return `
    <div style="margin-bottom:18px;">
      <div style="color:#A29475;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:4px;">${htmlEscape(label)}</div>
      <div style="color:#1a1a1a;font-size:16px;">${htmlEscape(value)}</div>
    </div>`;
}

function calendarButtons(g: string, o: string, manageUrl?: string): string {
  return `
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee;">
      <div style="color:#A29475;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:10px;">Add to your calendar</div>
      <a href="${htmlEscape(g)}" style="display:inline-block;padding:10px 18px;background:#4194b3;color:white;text-decoration:none;border-radius:6px;font-size:14px;margin-right:8px;margin-bottom:8px;">Google Calendar</a>
      <a href="${htmlEscape(o)}" style="display:inline-block;padding:10px 18px;background:#0078d4;color:white;text-decoration:none;border-radius:6px;font-size:14px;margin-right:8px;margin-bottom:8px;">Outlook</a>
      <span style="display:inline-block;padding:10px 18px;color:#666;font-size:13px;">Apple Calendar: use the attached .ics file</span>
      ${manageUrl ? `<div style="margin-top:18px;"><a href="${htmlEscape(manageUrl)}" style="color:#8A1538;text-decoration:underline;font-size:13px;">Reschedule or cancel</a></div>` : ''}
    </div>`;
}

function buildICSAttachment(args: BaseArgs, status: 'TENTATIVE' | 'CONFIRMED' = 'TENTATIVE') {
  try {
    const ics = generateICSForMeeting({
      id: args.meetingId,
      title: args.meetingTitle,
      date: args.date,
      time: args.time,
      durationMinutes: args.durationMinutes,
      attendeeName: args.attendeeName,
      attendeeEmail: args.attendeeEmail,
      hostName: args.hostName,
      hostEmail: args.hostEmail,
      meetingLink: args.meetingLink,
      notes: args.notes,
      status: status === 'TENTATIVE' ? 'pending' : 'approved',
    });
    return [{ filename: 'meeting.ics', content: ics, contentType: 'text/calendar' }];
  } catch {
    return undefined;
  }
}

export async function sendBookingConfirmation(args: ConfirmationArgs): Promise<void> {
  const provider = getEmailProvider();
  const { google, outlook } = addToCalendarUrls(args);
  const manageUrl = `${FRONTEND_URL}/manage-booking?token=${encodeURIComponent(args.attendeeToken)}`;

  const dateStr = new Date(args.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const content = `
    <h2 style="margin-top:0;color:#1a1a1a;">${htmlEscape(args.meetingTitle)}</h2>
    <p style="color:#666;margin:0 0 24px;">We've sent your request to ${htmlEscape(args.hostName)}. You'll get another email when it's confirmed.</p>
    ${detailBlock('Date', dateStr)}
    ${detailBlock('Time', args.time)}
    ${detailBlock('Duration', `${args.durationMinutes} minutes`)}
    ${detailBlock('Host', args.hostName)}
    ${args.meetingLink && safeUrl(args.meetingLink) ? `<div style="margin-top:18px;"><a href="${htmlEscape(safeUrl(args.meetingLink)!)}" style="display:inline-block;padding:12px 24px;background:#8A1538;color:white;text-decoration:none;border-radius:6px;">Join meeting link</a></div>` : ''}
    ${calendarButtons(google, outlook, manageUrl)}
  `;

  await provider.send({
    to: args.attendeeEmail,
    subject: `Booking received: ${args.meetingTitle}`,
    html: emailShell('📬 Booking Received', '#129b82', content),
    text: `Booking received for ${args.meetingTitle} on ${dateStr} at ${args.time}. Manage: ${manageUrl}`,
    attachments: buildICSAttachment(args, 'TENTATIVE'),
  });
}

export async function sendBookingHostNotification(args: BaseArgs): Promise<void> {
  if (!args.hostEmail) return;
  const provider = getEmailProvider();
  const { google, outlook } = addToCalendarUrls(args);

  const dateStr = new Date(args.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const content = `
    <h2 style="margin-top:0;color:#1a1a1a;">New booking request</h2>
    <p style="color:#666;margin:0 0 24px;"><strong>${htmlEscape(args.attendeeName)}</strong> (${htmlEscape(args.attendeeEmail)}) requested a meeting.</p>
    ${detailBlock('Title', args.meetingTitle)}
    ${detailBlock('Date', dateStr)}
    ${detailBlock('Time', args.time)}
    ${detailBlock('Duration', `${args.durationMinutes} minutes`)}
    ${args.notes ? detailBlock('Notes', args.notes) : ''}
    <div style="margin-top:20px;">
      <a href="${htmlEscape(FRONTEND_URL)}/?view=my-meetings" style="display:inline-block;padding:12px 24px;background:#8A1538;color:white;text-decoration:none;border-radius:6px;">Review in Cadence</a>
    </div>
    ${calendarButtons(google, outlook)}
  `;

  await provider.send({
    to: args.hostEmail,
    subject: `📬 Booking request from ${args.attendeeName}`,
    html: emailShell('New Booking Request', '#e9c56b', content),
    text: `${args.attendeeName} requested ${args.meetingTitle} on ${dateStr} at ${args.time}. Review at ${FRONTEND_URL}/?view=my-meetings`,
    attachments: buildICSAttachment(args, 'TENTATIVE'),
  });
}

export async function sendBookingApproved(args: BaseArgs & { attendeeToken?: string }): Promise<void> {
  const provider = getEmailProvider();
  const { google, outlook } = addToCalendarUrls(args);
  const manageUrl = args.attendeeToken
    ? `${FRONTEND_URL}/manage-booking?token=${encodeURIComponent(args.attendeeToken)}`
    : undefined;

  const dateStr = new Date(args.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const content = `
    <h2 style="margin-top:0;color:#1a1a1a;">${htmlEscape(args.meetingTitle)}</h2>
    <p style="color:#666;margin:0 0 24px;">${htmlEscape(args.hostName)} confirmed your meeting.</p>
    ${detailBlock('Date', dateStr)}
    ${detailBlock('Time', args.time)}
    ${detailBlock('Duration', `${args.durationMinutes} minutes`)}
    ${detailBlock('Host', args.hostName)}
    ${args.meetingLink && safeUrl(args.meetingLink) ? `<div style="margin-top:18px;"><a href="${htmlEscape(safeUrl(args.meetingLink)!)}" style="display:inline-block;padding:12px 24px;background:#8A1538;color:white;text-decoration:none;border-radius:6px;">Join meeting</a></div>` : ''}
    ${calendarButtons(google, outlook, manageUrl)}
  `;

  await provider.send({
    to: args.attendeeEmail,
    subject: `✓ Confirmed: ${args.meetingTitle}`,
    html: emailShell('✓ Meeting Confirmed', '#129b82', content),
    text: `Your meeting "${args.meetingTitle}" with ${args.hostName} on ${dateStr} at ${args.time} is confirmed.`,
    attachments: buildICSAttachment(args, 'CONFIRMED'),
  });
}

export async function sendBookingCancelled(args: BaseArgs & { cancelledBy?: string }): Promise<void> {
  const provider = getEmailProvider();

  const dateStr = new Date(args.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const content = `
    <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin-bottom:20px;">
      <h2 style="margin:0;color:#888;text-decoration:line-through;">${htmlEscape(args.meetingTitle)}</h2>
      <p style="color:#888;margin:10px 0 0;">${htmlEscape(dateStr)} at ${htmlEscape(args.time)}</p>
    </div>
    <p style="color:#666;">This meeting has been cancelled${args.cancelledBy ? ` by ${htmlEscape(args.cancelledBy)}` : ''}.</p>
  `;

  await provider.send({
    to: args.attendeeEmail,
    subject: `Cancelled: ${args.meetingTitle}`,
    html: emailShell('Meeting Cancelled', '#A29475', content),
    text: `The meeting "${args.meetingTitle}" on ${dateStr} at ${args.time} has been cancelled.`,
    attachments: buildICSAttachment({ ...args, notes: 'Cancelled' }, 'CONFIRMED'),
  });
}
