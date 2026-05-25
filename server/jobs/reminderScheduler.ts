/**
 * Meeting Reminder Scheduler
 *
 * Sends 24h and 1h email reminders for approved meetings.
 * Runs via setInterval from server/index.ts.
 */

import { db } from '../database';
import { getEmailProvider } from '../services/emailProvider';

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

async function sendReminderEmail(
  to: string,
  meetingTitle: string,
  hostName: string,
  date: string,
  time: string,
  hoursUntil: number,
  meetingLink?: string
): Promise<boolean> {
  try {
    const provider = getEmailProvider();
    const subject = `Reminder: ${meetingTitle} ${
      hoursUntil === 24 ? 'tomorrow' : `in ${hoursUntil} hour${hoursUntil > 1 ? 's' : ''}`
    }`;
    const result = await provider.send({
      to,
      subject,
      html: generateReminderHtml(meetingTitle, hostName, date, time, hoursUntil, meetingLink),
      text: generateReminderText(meetingTitle, hostName, date, time, hoursUntil),
    });
    return result.success;
  } catch (error) {
    console.error('Failed to send reminder email:', error);
    return false;
  }
}

function generateReminderHtml(
  title: string,
  hostName: string,
  date: string,
  time: string,
  hoursUntil: number,
  meetingLink?: string
): string {
  const timeLabel =
    hoursUntil === 24 ? 'tomorrow' : hoursUntil === 1 ? 'in 1 hour' : `in ${hoursUntil} hours`;

  const dateStr = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const link = safeLink(meetingLink);

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

          <h2 style="color: #1a1a1a; margin-top: 0;">${htmlEscape(title)}</h2>

          <div class="detail">
            <div class="detail-label">Date</div>
            <div class="detail-value">${htmlEscape(dateStr)}</div>
          </div>

          <div class="detail">
            <div class="detail-label">Time</div>
            <div class="detail-value">${htmlEscape(time)}</div>
          </div>

          <div class="detail">
            <div class="detail-label">With</div>
            <div class="detail-value">${htmlEscape(hostName)}</div>
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

function generateReminderText(
  title: string,
  hostName: string,
  date: string,
  time: string,
  hoursUntil: number
): string {
  const timeLabel =
    hoursUntil === 24 ? 'tomorrow' : hoursUntil === 1 ? 'in 1 hour' : `in ${hoursUntil} hours`;

  return `
Meeting Reminder: ${title}

Your meeting is coming up ${timeLabel}!

Date: ${date}
Time: ${time}
With: ${hostName}

---
Cadence
  `.trim();
}

export async function sendMeetingReminders(): Promise<{
  sent24h: number;
  sent1h: number;
  errors: number;
}> {
  const stats = { sent24h: 0, sent1h: 0, errors: 0 };
  const now = new Date();

  try {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    const meetings24h = db.connection.prepare(`
      SELECT m.*, u.name as host_name, u.id as host_user_id
      FROM meetings m
      JOIN users u ON m.host_id = u.id
      WHERE m.status = 'approved'
      AND m.date = ?
      AND (m.reminder_24h_sent IS NULL OR m.reminder_24h_sent = '')
    `).all(tomorrowDate) as any[];

    for (const meeting of meetings24h) {
      const success = await sendReminderEmail(
        meeting.attendee_email,
        meeting.title,
        meeting.host_name,
        meeting.date,
        meeting.time,
        24,
        meeting.meeting_link
      );

      if (success) {
        db.connection.prepare(`
          UPDATE meetings SET reminder_24h_sent = ? WHERE id = ?
        `).run(now.toISOString(), meeting.id);
        stats.sent24h++;
      } else {
        stats.errors++;
      }
    }

    const todayDate = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const nextHour = currentHour + 1;

    const meetings1h = db.connection.prepare(`
      SELECT m.*, u.name as host_name, u.id as host_user_id
      FROM meetings m
      JOIN users u ON m.host_id = u.id
      WHERE m.status = 'approved'
      AND m.date = ?
      AND m.time LIKE ?
      AND (m.reminder_1h_sent IS NULL OR m.reminder_1h_sent = '')
    `).all(todayDate, `${nextHour.toString().padStart(2, '0')}:%`) as any[];

    for (const meeting of meetings1h) {
      const success = await sendReminderEmail(
        meeting.attendee_email,
        meeting.title,
        meeting.host_name,
        meeting.date,
        meeting.time,
        1,
        meeting.meeting_link
      );

      if (success) {
        db.connection.prepare(`
          UPDATE meetings SET reminder_1h_sent = ? WHERE id = ?
        `).run(now.toISOString(), meeting.id);
        stats.sent1h++;
      } else {
        stats.errors++;
      }
    }

    if (stats.sent24h > 0 || stats.sent1h > 0) {
      console.log(
        `📧 Reminders sent: ${stats.sent24h} (24h) + ${stats.sent1h} (1h) | Errors: ${stats.errors}`
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
