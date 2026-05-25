/**
 * Email Routes - Send emails via Resend (simplest setup) or Console (zero config)
 *
 * ZERO CONFIG MODE: Works out of the box - emails are logged to console
 * RESEND MODE: Just add RESEND_API_KEY to .env (get free key at resend.com)
 */

import { Router, Response } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { getEmailProvider } from '../services/emailProvider';

const router = Router();

// ---- HTML / URL escaping helpers ----

/** Escape a string for safe interpolation into an HTML context. */
function htmlEscape(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate a URL for safe inclusion in `href`. Returns the URL if it looks like
 * a normal http(s) link; otherwise returns '#'. Blocks `javascript:`,
 * `data:`, `vbscript:`, etc.
 */
function safeHref(url: unknown): string {
  if (typeof url !== 'string') return '#';
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '#';
  if (trimmed.length > 2000) return '#';
  return htmlEscape(trimmed);
}

// ---- Validation helpers ----

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmailAddress(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new AppError(`${field} is required`, 400);
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 254) {
    throw new AppError(`${field} must be 1-254 characters`, 400);
  }
  if (!EMAIL_RE.test(trimmed)) {
    throw new AppError(`${field} must be a valid email address`, 400);
  }
  return trimmed;
}

// Email From: address is *not* user-controllable. Always force it server-side.
function getFromAddress(): string {
  return process.env.EMAIL_FROM || 'Cadence <noreply@cadence.app>';
}

// Check email service status
router.get('/status', async (_req, res: Response) => {
  const provider = getEmailProvider();

  res.json({
    available: true,
    provider: provider.name,
    configured: provider.name !== 'Console (Development Mode)',
    message: provider.name === 'Console (Development Mode)'
      ? 'Emails will be logged to console. Add RESEND_API_KEY for real emails.'
      : 'Email service is ready to send real emails'
  });
});

// Generate beautiful HTML email
function generateEmailHTML(options: {
  title: string;
  headerColor?: string;
  content: string;
  footerText?: string;
}): string {
  const { title, headerColor = '#8A1538', content, footerText = 'Cadence' } = options;

  // `title` and `footerText` may include user data — escape them. `content`
  // is built from already-escaped fragments by callers below.
  const safeTitle = htmlEscape(title);
  const safeFooter = htmlEscape(footerText);
  const safeHeader = /^#[0-9a-fA-F]{3,8}$/.test(headerColor) ? headerColor : '#8A1538';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: ${safeHeader}; color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px; }
        .detail { margin-bottom: 20px; }
        .detail-label { color: #A29475; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; font-weight: 600; }
        .detail-value { color: #1a1a1a; font-size: 16px; }
        .button { display: inline-block; padding: 14px 28px; background: ${safeHeader}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; }
        .footer { padding: 20px 30px; background: #f9f9f9; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${safeTitle}</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          ${safeFooter}
        </div>
      </div>
    </body>
    </html>
  `;
}

// Send generic email (admin/manager only — not a public spam relay)
router.post(
  '/send',
  authenticateToken,
  requireRole('admin', 'manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { to, subject, html, text } = req.body ?? {};

      if (!to || !subject || !html) {
        throw new AppError('Missing required fields: to, subject, html', 400);
      }

      const safeTo = validateEmailAddress(to, 'to');

      if (typeof subject !== 'string' || subject.length === 0 || subject.length > 200) {
        throw new AppError('subject must be 1-200 characters', 400);
      }
      if (typeof html !== 'string' || html.length === 0 || html.length > 50 * 1024) {
        throw new AppError('html must be 1-51200 bytes', 400);
      }
      if (text !== undefined && (typeof text !== 'string' || text.length > 50 * 1024)) {
        throw new AppError('text must be a string up to 51200 bytes', 400);
      }

      const provider = getEmailProvider();
      // `from` is NEVER taken from the request body — always server-controlled.
      const result = await provider.send({
        to: safeTo,
        subject,
        html,
        text,
        from: getFromAddress(),
      });

      console.log(`📧 Email sent via ${provider.name} to ${safeTo}`);

      res.json({
        success: true,
        messageId: result.messageId,
        provider: provider.name
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      console.error('❌ Email send failed:', error.message);
      throw new AppError(error.message || 'Failed to send email', 500);
    }
  }
);

// Send meeting confirmation
router.post('/meeting-confirmation', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { meeting, hostName, attendeeEmail } = req.body;

    if (!meeting || !attendeeEmail) {
      throw new AppError('Missing meeting or attendee email', 400);
    }

    const safeAttendeeEmail = validateEmailAddress(attendeeEmail, 'attendeeEmail');

    const dateStr = new Date(meeting.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const html = generateEmailHTML({
      title: '✓ Meeting Confirmed',
      headerColor: '#129b82',
      content: `
        <h2 style="color: #1a1a1a; margin-top: 0;">${htmlEscape(meeting.title)}</h2>

        <div class="detail">
          <div class="detail-label">Date</div>
          <div class="detail-value">${htmlEscape(dateStr)}</div>
        </div>

        <div class="detail">
          <div class="detail-label">Time</div>
          <div class="detail-value">${htmlEscape(meeting.time)} (${htmlEscape(meeting.durationMinutes)} minutes)</div>
        </div>

        <div class="detail">
          <div class="detail-label">Host</div>
          <div class="detail-value">${htmlEscape(hostName || 'Your Host')}</div>
        </div>

        ${meeting.notes ? `
        <div class="detail">
          <div class="detail-label">Notes</div>
          <div class="detail-value">${htmlEscape(meeting.notes)}</div>
        </div>
        ` : ''}

        <p style="color: #666; margin-top: 24px;">
          We look forward to meeting with you!
        </p>
      `
    });

    const provider = getEmailProvider();
    const result = await provider.send({
      to: safeAttendeeEmail,
      subject: `✓ Meeting Confirmed: ${meeting.title}`,
      html,
      from: getFromAddress(),
    });

    res.json({ success: true, messageId: result.messageId, provider: provider.name });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || 'Failed to send confirmation email', 500);
  }
});

// Send meeting reminder
router.post('/meeting-reminder', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { meeting, hostName, attendeeEmail, hoursUntil } = req.body;

    if (!meeting || !attendeeEmail) {
      throw new AppError('Missing meeting or attendee email', 400);
    }

    const safeAttendeeEmail = validateEmailAddress(attendeeEmail, 'attendeeEmail');

    const dateStr = new Date(meeting.date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });

    const timeLabel = hoursUntil === 24 ? 'tomorrow' :
                      hoursUntil === 1 ? 'in 1 hour' :
                      `in ${hoursUntil} hours`;

    const html = generateEmailHTML({
      title: '⏰ Meeting Reminder',
      headerColor: '#4194b3',
      content: `
        <p style="color: #666; margin-top: 0; font-size: 18px;">
          Your meeting is <strong>${htmlEscape(timeLabel)}</strong>!
        </p>

        <h2 style="color: #1a1a1a;">${htmlEscape(meeting.title)}</h2>

        <div class="detail">
          <div class="detail-label">When</div>
          <div class="detail-value">${htmlEscape(dateStr)} at ${htmlEscape(meeting.time)}</div>
        </div>

        <div class="detail">
          <div class="detail-label">With</div>
          <div class="detail-value">${htmlEscape(hostName || 'Your Host')}</div>
        </div>

        <div class="detail">
          <div class="detail-label">Duration</div>
          <div class="detail-value">${htmlEscape(meeting.durationMinutes)} minutes</div>
        </div>
      `
    });

    const provider = getEmailProvider();
    const result = await provider.send({
      to: safeAttendeeEmail,
      subject: `⏰ Reminder: ${meeting.title} - ${timeLabel}`,
      html,
      from: getFromAddress(),
    });

    res.json({ success: true, messageId: result.messageId, provider: provider.name });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || 'Failed to send reminder email', 500);
  }
});

// Send meeting request (for approval)
router.post('/meeting-request', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { meeting, hostEmail, requesterName } = req.body;

    if (!meeting || !hostEmail) {
      throw new AppError('Missing meeting or host email', 400);
    }

    const safeHostEmail = validateEmailAddress(hostEmail, 'hostEmail');

    const dateStr = new Date(meeting.date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    const html = generateEmailHTML({
      title: '📬 New Meeting Request',
      headerColor: '#e9c56b',
      content: `
        <p style="color: #666; margin-top: 0;">
          <strong>${htmlEscape(requesterName)}</strong> would like to schedule a meeting with you.
        </p>

        <h2 style="color: #1a1a1a;">${htmlEscape(meeting.title)}</h2>

        <div class="detail">
          <div class="detail-label">Requested Date</div>
          <div class="detail-value">${htmlEscape(dateStr)}</div>
        </div>

        <div class="detail">
          <div class="detail-label">Requested Time</div>
          <div class="detail-value">${htmlEscape(meeting.time)} (${htmlEscape(meeting.durationMinutes)} minutes)</div>
        </div>

        <div class="detail">
          <div class="detail-label">From</div>
          <div class="detail-value">${htmlEscape(requesterName)} (${htmlEscape(meeting.attendeeEmail)})</div>
        </div>

        ${meeting.notes ? `
        <div class="detail">
          <div class="detail-label">Message</div>
          <div class="detail-value">${htmlEscape(meeting.notes)}</div>
        </div>
        ` : ''}

        <p style="margin-top: 24px;">
          <a href="#" class="button" style="background: #129b82; margin-right: 10px;">Approve</a>
          <a href="#" class="button" style="background: #dd7877;">Decline</a>
        </p>
      `
    });

    const provider = getEmailProvider();
    const result = await provider.send({
      to: safeHostEmail,
      subject: `📬 Meeting Request: ${meeting.title} from ${requesterName}`,
      html,
      from: getFromAddress(),
    });

    res.json({ success: true, messageId: result.messageId, provider: provider.name });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || 'Failed to send request email', 500);
  }
});

// Send meeting cancelled notification
router.post('/meeting-cancelled', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { meeting, recipientEmail, cancelledBy } = req.body;

    if (!meeting || !recipientEmail) {
      throw new AppError('Missing meeting or recipient email', 400);
    }

    const safeRecipientEmail = validateEmailAddress(recipientEmail, 'recipientEmail');

    const dateStr = new Date(meeting.date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });

    const html = generateEmailHTML({
      title: 'Meeting Cancelled',
      headerColor: '#A29475',
      content: `
        <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #888; text-decoration: line-through;">${htmlEscape(meeting.title)}</h2>
          <p style="color: #888; margin: 10px 0 0;">${htmlEscape(dateStr)} at ${htmlEscape(meeting.time)}</p>
        </div>

        <p style="color: #666;">
          This meeting has been cancelled${cancelledBy ? ` by ${htmlEscape(cancelledBy)}` : ''}.
        </p>

        <p style="color: #888; font-size: 14px;">
          If you have any questions, please contact the organizer directly.
        </p>
      `
    });

    const provider = getEmailProvider();
    const result = await provider.send({
      to: safeRecipientEmail,
      subject: `Cancelled: ${meeting.title}`,
      html,
      from: getFromAddress(),
    });

    res.json({ success: true, messageId: result.messageId, provider: provider.name });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || 'Failed to send cancellation email', 500);
  }
});

// Re-export safeHref for any future consumers that need URL validation.
export { safeHref };

export default router;
