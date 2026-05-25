/**
 * Meeting Reminder Scheduler
 *
 * Sends 24h and 1h email reminders for approved meetings to both
 * the attendee and the host. Runs via setInterval from server/index.ts.
 */

import { db } from '../database';
import { getEmailProvider } from '../services/emailProvider';
import { generateICSForMeeting } from '../services/icsGenerator';

function htmlEscape(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeLink(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
  if (url.length > 500) return null;
  return url;
}

type Recipient = 'attendee' | 'host';

interface ReminderArgs {
  to: string;
  meetingTitle: string;
  counterpartyName: string;
  date: string;
  time: string;
  hoursUntil: number;
  meetingLink?: string;
  recipient: Recipient;
  // For ICS attachment generation:
  meetingId: string;
  durationMinutes: number;
  attendeeName?: string;
  attendeeEmail?: string;
  hostName?: string;
  hostEmail?: string;
}

async function sendReminderEmail(args: ReminderArgs): Promise<boolean> {
  try {
    const provider = getEmailProvider();
    const subject = `Reminder: ${args.meetingTitle} ${
      args.hoursUntil === 24 ? 'tomorrow' : `in ${args.hoursUntil} hour${args.hoursUntil > 1 ? 's' : ''}`
    }`;

    // Generate an ICS attachment so the meeting can be re-added to a calendar from the reminder.
    let attachments;
    try {
      const ics = generateICSForMeeting({
        id: args.meetingId,
        title: args.meetingTitle,
        date: args.date,
        time: args.time,
        durationMinutes: args.durationMinutes,
        attendeeName: args.attendeeName ?? args.counterpartyName,
        attendeeEmail: args.attendeeEmail ?? args.to,
        hostName: args.hostName ?? args.counterpartyName,
        hostEmail: args.hostEmail,
        meetingLink: args.meetingLink,
      });
      attachments = [{ filename: 'meeting.ics', content: ics, contentType: 'text/calendar' }];
    } catch {
      // Don't block the reminder if ICS generation fails.
    }

    const result = await provider.send({
      to: args.to,
      subject,
      html: generateReminderHtml(args),
      text: generateReminderText(args),
      attachments,
    });
    return result.success;
  } catch (error) {
    console.error('Failed to send reminder email:', error);
    return false;
  }
}

function generateReminderHtml(args: ReminderArgs): string {
  const { meetingTitle, counterpartyName, date, time, hoursUntil, meetingLink, recipient } = args;
  const timeLabel =
    hoursUntil === 24 ? 'tomorrow' : hoursUntil === 1 ? 'in 1 hour' : `in ${hoursUntil} hours`;

  const dateStr = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const link = safeLink(meetingLink);
  const counterpartyLabel = recipient === 'host' ? 'Attendee' : 'With';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', -apple-system, sans-serif; background: #f5f5f5; padding: 20px; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
        .header { background: #4194b3; color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .alert { background: #fef3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
        .alert-text { color: #856404; font-weight: 600; margin: 0; }
        .detail { margin-bottom: 15px; }
        .detail-label { color: #A29475; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
        .detail-value { color: #1a1a1a; font-size: 16px; font-weight: 500; }
        .button { display: inline-block; padding: 14px 28px; background: #8A1538; color: white; text-decoration: none; border-radius: 6px; margin-top: 10px; }
        .footer { padding: 20px 30px; background: #f9f9f9; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏰ Meeting Reminder</h1>
        </div>
        <div class="content">
          <div class="alert">
            <p class="alert-text">Your meeting is coming up ${htmlEscape(timeLabel)}!</p>
          </div>

          <h2 style="color: #1a1a1a; margin-top: 0;">${htmlEscape(meetingTitle)}</h2>

          <div class="detail">
            <div class="detail-label">Date</div>
            <div class="detail-value">${htmlEscape(dateStr)}</div>
          </div>

          <div class="detail">
            <div class="detail-label">Time</div>
            <div class="detail-value">${htmlEscape(time)}</div>
          </div>

          <div class="detail">
            <div class="detail-label">${counterpartyLabel}</div>
            <div class="detail-value">${htmlEscape(counterpartyName)}</div>
          </div>

          ${link ? `<a href="${htmlEscape(link)}" class="button">Join Meeting</a>` : ''}
        </div>
        <div class="footer">
          Cadence
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateReminderText(args: ReminderArgs): string {
  const { meetingTitle, counterpartyName, date, time, hoursUntil, recipient } = args;
  const timeLabel =
    hoursUntil === 24 ? 'tomorrow' : hoursUntil === 1 ? 'in 1 hour' : `in ${hoursUntil} hours`;
  const label = recipient === 'host' ? 'Attendee' : 'With';

  return `
Meeting Reminder: ${meetingTitle}

Your meeting is coming up ${timeLabel}!

Date: ${date}
Time: ${time}
${label}: ${counterpartyName}

---
Cadence
  `.trim();
}

export async function sendMeetingReminders(): Promise<{
  sent24hAttendee: number;
  sent24hHost: number;
  sent1hAttendee: number;
  sent1hHost: number;
  errors: number;
}> {
  const stats = { sent24hAttendee: 0, sent24hHost: 0, sent1hAttendee: 0, sent1hHost: 0, errors: 0 };
  const now = new Date();

  try {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    // 24h reminders — pull all approved meetings tomorrow that still need to send to either side
    const meetings24h = db.connection.prepare(`
      SELECT m.*, u.name as host_name, u.email as host_email, u.id as host_user_id
      FROM meetings m
      JOIN users u ON m.host_id = u.id
      WHERE m.status = 'approved'
      AND m.date = ?
      AND (
        (m.reminder_24h_sent IS NULL OR m.reminder_24h_sent = '' OR m.reminder_24h_sent = 0)
        OR (m.host_reminder_24h_sent IS NULL OR m.host_reminder_24h_sent = 0)
      )
    `).all(tomorrowDate) as any[];

    for (const meeting of meetings24h) {
      // Attendee
      if (!meeting.reminder_24h_sent) {
        const ok = await sendReminderEmail({
          to: meeting.attendee_email,
          meetingTitle: meeting.title,
          counterpartyName: meeting.host_name,
          date: meeting.date,
          time: meeting.time,
          hoursUntil: 24,
          meetingLink: meeting.meeting_link,
          recipient: 'attendee',
          meetingId: meeting.id,
          durationMinutes: meeting.duration_minutes,
          attendeeName: meeting.attendee_name,
          attendeeEmail: meeting.attendee_email,
          hostName: meeting.host_name,
          hostEmail: meeting.host_email,
        });
        if (ok) {
          db.connection.prepare(`UPDATE meetings SET reminder_24h_sent = ? WHERE id = ?`).run(now.toISOString(), meeting.id);
          stats.sent24hAttendee++;
        } else {
          stats.errors++;
        }
      }

      // Host (only if we have an email on file)
      if (!meeting.host_reminder_24h_sent && meeting.host_email) {
        const ok = await sendReminderEmail({
          to: meeting.host_email,
          meetingTitle: meeting.title,
          counterpartyName: meeting.attendee_name,
          date: meeting.date,
          time: meeting.time,
          hoursUntil: 24,
          meetingLink: meeting.meeting_link,
          recipient: 'host',
          meetingId: meeting.id,
          durationMinutes: meeting.duration_minutes,
          attendeeName: meeting.attendee_name,
          attendeeEmail: meeting.attendee_email,
          hostName: meeting.host_name,
          hostEmail: meeting.host_email,
        });
        if (ok) {
          db.connection.prepare(`UPDATE meetings SET host_reminder_24h_sent = 1 WHERE id = ?`).run(meeting.id);
          stats.sent24hHost++;
        } else {
          stats.errors++;
        }
      }
    }

    // 1h reminders
    const todayDate = now.toISOString().split('T')[0];
    const nextHour = now.getHours() + 1;

    const meetings1h = db.connection.prepare(`
      SELECT m.*, u.name as host_name, u.email as host_email, u.id as host_user_id
      FROM meetings m
      JOIN users u ON m.host_id = u.id
      WHERE m.status = 'approved'
      AND m.date = ?
      AND m.time LIKE ?
      AND (
        (m.reminder_1h_sent IS NULL OR m.reminder_1h_sent = '' OR m.reminder_1h_sent = 0)
        OR (m.host_reminder_1h_sent IS NULL OR m.host_reminder_1h_sent = 0)
      )
    `).all(todayDate, `${nextHour.toString().padStart(2, '0')}:%`) as any[];

    for (const meeting of meetings1h) {
      if (!meeting.reminder_1h_sent) {
        const ok = await sendReminderEmail({
          to: meeting.attendee_email,
          meetingTitle: meeting.title,
          counterpartyName: meeting.host_name,
          date: meeting.date,
          time: meeting.time,
          hoursUntil: 1,
          meetingLink: meeting.meeting_link,
          recipient: 'attendee',
          meetingId: meeting.id,
          durationMinutes: meeting.duration_minutes,
          attendeeName: meeting.attendee_name,
          attendeeEmail: meeting.attendee_email,
          hostName: meeting.host_name,
          hostEmail: meeting.host_email,
        });
        if (ok) {
          db.connection.prepare(`UPDATE meetings SET reminder_1h_sent = ? WHERE id = ?`).run(now.toISOString(), meeting.id);
          stats.sent1hAttendee++;
        } else {
          stats.errors++;
        }
      }

      if (!meeting.host_reminder_1h_sent && meeting.host_email) {
        const ok = await sendReminderEmail({
          to: meeting.host_email,
          meetingTitle: meeting.title,
          counterpartyName: meeting.attendee_name,
          date: meeting.date,
          time: meeting.time,
          hoursUntil: 1,
          meetingLink: meeting.meeting_link,
          recipient: 'host',
          meetingId: meeting.id,
          durationMinutes: meeting.duration_minutes,
          attendeeName: meeting.attendee_name,
          attendeeEmail: meeting.attendee_email,
          hostName: meeting.host_name,
          hostEmail: meeting.host_email,
        });
        if (ok) {
          db.connection.prepare(`UPDATE meetings SET host_reminder_1h_sent = 1 WHERE id = ?`).run(meeting.id);
          stats.sent1hHost++;
        } else {
          stats.errors++;
        }
      }
    }

    const total = stats.sent24hAttendee + stats.sent24hHost + stats.sent1hAttendee + stats.sent1hHost;
    if (total > 0) {
      console.log(
        `📧 Reminders: 24h ${stats.sent24hAttendee}a/${stats.sent24hHost}h, 1h ${stats.sent1hAttendee}a/${stats.sent1hHost}h, errors ${stats.errors}`
      );
    }

    return stats;
  } catch (error) {
    console.error('Error in reminder scheduler:', error);
    return stats;
  }
}

export function initReminderScheduler(intervalMs: number = 60 * 60 * 1000): NodeJS.Timeout {
  console.log('⏰ Meeting reminder scheduler initialized');
  sendMeetingReminders().catch(console.error);
  return setInterval(() => {
    sendMeetingReminders().catch(console.error);
  }, intervalMs);
}
