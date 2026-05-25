/**
 * Email Service - Email Notification Templates & Sending
 * Note: This requires a backend server for actual email sending
 */

import { Meeting, User } from '../types';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export const emailTemplates = {
  /**
   * Meeting Confirmation Email
   */
  meetingConfirmation: (meeting: Meeting, host: User): EmailTemplate => {
    const dateStr = new Date(meeting.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return {
      subject: `Meeting Confirmed: ${meeting.title}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Inter', -apple-system, sans-serif; background: #f5f5f5; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
            .header { background: #8A1538; color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .detail { margin-bottom: 15px; }
            .detail-label { color: #A29475; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
            .detail-value { color: #1a1a1a; font-size: 16px; font-weight: 500; }
            .button { display: inline-block; padding: 14px 28px; background: #8A1538; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { padding: 20px 30px; background: #f9f9f9; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Meeting Confirmed</h1>
            </div>
            <div class="content">
              <h2 style="color: #1a1a1a; margin-top: 0;">${meeting.title}</h2>
              
              <div class="detail">
                <div class="detail-label">Date</div>
                <div class="detail-value">${dateStr}</div>
              </div>
              
              <div class="detail">
                <div class="detail-label">Time</div>
                <div class="detail-value">${meeting.time} (${meeting.durationMinutes} minutes)</div>
              </div>
              
              <div class="detail">
                <div class="detail-label">Host</div>
                <div class="detail-value">${host.name}</div>
              </div>
              
              ${meeting.notes ? `
              <div class="detail">
                <div class="detail-label">Notes</div>
                <div class="detail-value">${meeting.notes}</div>
              </div>
              ` : ''}
              
              <a href="#" class="button">Add to Calendar</a>
            </div>
            <div class="footer">
              Cadence - Premium Scheduling for Teams
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Meeting Confirmed: ${meeting.title}

Date: ${dateStr}
Time: ${meeting.time} (${meeting.durationMinutes} minutes)
Host: ${host.name}
${meeting.notes ? `Notes: ${meeting.notes}` : ''}

---
Cadence
      `.trim()
    };
  },

  /**
   * Meeting Request Email (for host approval)
   */
  meetingRequest: (meeting: Meeting, host: User): EmailTemplate => {
    const dateStr = new Date(meeting.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return {
      subject: `New Meeting Request: ${meeting.title}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Inter', -apple-system, sans-serif; background: #f5f5f5; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
            .header { background: #dd7877; color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .detail { margin-bottom: 15px; }
            .detail-label { color: #A29475; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
            .detail-value { color: #1a1a1a; font-size: 16px; font-weight: 500; }
            .buttons { margin-top: 20px; }
            .button { display: inline-block; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin-right: 10px; }
            .button-approve { background: #129b82; color: white; }
            .button-reject { background: #f5f5f5; color: #666; border: 1px solid #ddd; }
            .footer { padding: 20px 30px; background: #f9f9f9; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Meeting Request</h1>
            </div>
            <div class="content">
              <h2 style="color: #1a1a1a; margin-top: 0;">${meeting.title}</h2>
              
              <div class="detail">
                <div class="detail-label">From</div>
                <div class="detail-value">${meeting.attendeeName} (${meeting.attendeeEmail})</div>
              </div>
              
              <div class="detail">
                <div class="detail-label">Date</div>
                <div class="detail-value">${dateStr}</div>
              </div>
              
              <div class="detail">
                <div class="detail-label">Time</div>
                <div class="detail-value">${meeting.time} (${meeting.durationMinutes} minutes)</div>
              </div>
              
              ${meeting.notes ? `
              <div class="detail">
                <div class="detail-label">Notes</div>
                <div class="detail-value">${meeting.notes}</div>
              </div>
              ` : ''}
              
              <div class="buttons">
                <a href="#" class="button button-approve">Approve</a>
                <a href="#" class="button button-reject">Reject</a>
              </div>
            </div>
            <div class="footer">
              Cadence - Premium Scheduling for Teams
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
New Meeting Request: ${meeting.title}

From: ${meeting.attendeeName} (${meeting.attendeeEmail})
Date: ${dateStr}
Time: ${meeting.time} (${meeting.durationMinutes} minutes)
${meeting.notes ? `Notes: ${meeting.notes}` : ''}

Please log in to approve or reject this request.

---
Cadence
      `.trim()
    };
  },

  /**
   * Meeting Reminder Email
   */
  meetingReminder: (meeting: Meeting, host: User, hoursUntil: number): EmailTemplate => {
    const dateStr = new Date(meeting.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const timeLabel = hoursUntil === 24 ? 'tomorrow' : 
                      hoursUntil === 1 ? 'in 1 hour' : 
                      `in ${hoursUntil} hours`;

    return {
      subject: `Reminder: ${meeting.title} ${timeLabel}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Inter', -apple-system, sans-serif; background: #f5f5f5; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
            .header { background: #4194b3; color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .detail { margin-bottom: 15px; }
            .detail-label { color: #A29475; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
            .detail-value { color: #1a1a1a; font-size: 16px; font-weight: 500; }
            .footer { padding: 20px 30px; background: #f9f9f9; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Meeting Reminder</h1>
            </div>
            <div class="content">
              <p style="color: #666; margin-top: 0;">Your meeting is coming up ${timeLabel}!</p>
              
              <h2 style="color: #1a1a1a;">${meeting.title}</h2>
              
              <div class="detail">
                <div class="detail-label">Date</div>
                <div class="detail-value">${dateStr}</div>
              </div>
              
              <div class="detail">
                <div class="detail-label">Time</div>
                <div class="detail-value">${meeting.time}</div>
              </div>
              
              <div class="detail">
                <div class="detail-label">With</div>
                <div class="detail-value">${host.name}</div>
              </div>
            </div>
            <div class="footer">
              Cadence - Premium Scheduling for Teams
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Meeting Reminder: ${meeting.title}

Your meeting is coming up ${timeLabel}!

Date: ${dateStr}
Time: ${meeting.time}
With: ${host.name}

---
Cadence
      `.trim()
    };
  },

  /**
   * Meeting Cancelled Email
   */
  meetingCancelled: (meeting: Meeting, cancelledBy: string): EmailTemplate => {
    const dateStr = new Date(meeting.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return {
      subject: `Meeting Cancelled: ${meeting.title}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Inter', -apple-system, sans-serif; background: #f5f5f5; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
            .header { background: #A29475; color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .cancelled { background: #f5f5f5; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
            .cancelled h2 { margin: 0; color: #888; text-decoration: line-through; }
            .footer { padding: 20px 30px; background: #f9f9f9; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Meeting Cancelled</h1>
            </div>
            <div class="content">
              <div class="cancelled">
                <h2>${meeting.title}</h2>
                <p style="color: #888; margin: 10px 0 0;">${dateStr} at ${meeting.time}</p>
              </div>
              
              <p style="color: #666;">
                This meeting has been cancelled by ${cancelledBy}.
              </p>
            </div>
            <div class="footer">
              Cadence - Premium Scheduling for Teams
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Meeting Cancelled: ${meeting.title}

This meeting has been cancelled.

Original Date: ${dateStr}
Original Time: ${meeting.time}
Cancelled by: ${cancelledBy}

---
Cadence
      `.trim()
    };
  }
};

/**
 * Check if email service is available
 */
export async function checkEmailStatus(): Promise<{ available: boolean; message: string }> {
  try {
    const response = await fetch('/api/email/status');
    return await response.json();
  } catch (error) {
    return { available: false, message: 'Email service unreachable' };
  }
}

/**
 * Send email via backend API
 */
export async function sendEmail(
  to: string,
  template: EmailTemplate,
  options?: { cc?: string; bcc?: string }
): Promise<boolean> {
  try {
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: JSON.stringify({
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        ...options
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Send meeting confirmation email
 */
export async function sendMeetingConfirmation(
  meeting: Meeting,
  hostName: string,
  attendeeEmail: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/email/meeting-confirmation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: JSON.stringify({ meeting, hostName, attendeeEmail })
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
    return false;
  }
}

/**
 * Send meeting reminder email
 */
export async function sendMeetingReminder(
  meeting: Meeting,
  hostName: string,
  attendeeEmail: string,
  hoursUntil: number
): Promise<boolean> {
  try {
    const response = await fetch('/api/email/meeting-reminder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: JSON.stringify({ meeting, hostName, attendeeEmail, hoursUntil })
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send reminder email:', error);
    return false;
  }
}

