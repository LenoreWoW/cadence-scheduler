/**
 * Email Provider Service
 *
 * Shared email-sending abstraction used by HTTP routes and background jobs.
 * Avoids the previous pattern of jobs POSTing to the local /api/email/send
 * endpoint (which required a JWT and would 401).
 */

export interface EmailAttachment {
  filename: string;
  content: string; // text content, or base64 if binary
  contentType?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  send(options: EmailOptions): Promise<{ success: boolean; messageId?: string }>;
  name: string;
}

// Console Provider — zero-config, logs to stdout (good for dev/CI)
export class ConsoleEmailProvider implements EmailProvider {
  name = 'Console (Development Mode)';

  async send(options: EmailOptions) {
    console.log('\n' + '='.repeat(60));
    console.log('📧 EMAIL SENT (Development Mode - Not actually sent)');
    console.log('='.repeat(60));
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log('-'.repeat(60));
    console.log('Preview:');
    const textPreview = options.html
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500);
    console.log(textPreview + '...');
    console.log('='.repeat(60) + '\n');

    return {
      success: true,
      messageId: `console_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }
}

// SMTP Provider — plug-and-play, lazily instantiates a nodemailer transport.
// Activated when SMTP_HOST is set. Overrides Resend.
export class SmtpEmailProvider implements EmailProvider {
  name = 'SMTP';
  private transportPromise: Promise<any> | null = null;

  private async getTransport(): Promise<any> {
    if (!this.transportPromise) {
      this.transportPromise = (async () => {
        // Lazy import so nodemailer doesn't load unless SMTP is configured.
        const mod = await import('nodemailer');
        const nodemailer = (mod as any).default || mod;
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
        // STARTTLS on 587 (secure=false), implicit TLS on 465 (secure=true).
        const secure = port === 465;
        return nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port,
          secure,
          auth: process.env.SMTP_USER
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : undefined,
        });
      })();
    }
    return this.transportPromise;
  }

  async send(options: EmailOptions) {
    const transport = await this.getTransport();
    const from = options.from || process.env.EMAIL_FROM || process.env.SMTP_USER || 'Cadence <no-reply@example.com>';
    const attachments = options.attachments?.map((a) => {
      // Calendar invites are typically text/calendar — pass content as a string.
      // For other binary content, callers pass base64 in `content`.
      const isText = !a.contentType || /^text\//i.test(a.contentType);
      return {
        filename: a.filename,
        content: isText ? a.content : Buffer.from(a.content, 'base64'),
        contentType: a.contentType,
      };
    });

    const info = await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      attachments,
    });

    return {
      success: true,
      messageId: info.messageId || `smtp_${Date.now()}`,
    };
  }
}

// Resend Provider — single API key configuration
export class ResendEmailProvider implements EmailProvider {
  name = 'Resend';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(options: EmailOptions) {
    const body: Record<string, unknown> = {
      from: options.from || process.env.EMAIL_FROM || 'Cadence <onboarding@resend.dev>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    if (options.replyTo) {
      body.reply_to = options.replyTo;
    }

    if (options.attachments && options.attachments.length > 0) {
      // Resend expects { filename, content } where content is a string (text or base64).
      // Calendar invites are text/calendar — already a string.
      body.attachments = options.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        ...(a.contentType ? { content_type: a.contentType } : {}),
      }));
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Resend API error');
    }

    const data: any = await response.json();
    return { success: true, messageId: data.id };
  }
}

let cachedProvider: EmailProvider | null = null;

/** Return the configured provider; cached so we don't log the dev tip on every call. */
export function getEmailProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider;

  // SMTP wins if configured — plug-and-play for self-hosters / forks.
  if (process.env.SMTP_HOST) {
    cachedProvider = new SmtpEmailProvider();
  } else if (process.env.RESEND_API_KEY) {
    cachedProvider = new ResendEmailProvider(process.env.RESEND_API_KEY);
  } else {
    console.log('💡 Tip: Add SMTP_HOST or RESEND_API_KEY to .env for real email sending');
    console.log('   Resend: https://resend.com — SMTP works with any provider (Mailgun, SES, Postmark, your own server).');
    cachedProvider = new ConsoleEmailProvider();
  }
  return cachedProvider;
}
