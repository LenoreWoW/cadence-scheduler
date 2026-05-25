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

  if (process.env.RESEND_API_KEY) {
    cachedProvider = new ResendEmailProvider(process.env.RESEND_API_KEY);
  } else {
    console.log('💡 Tip: Add RESEND_API_KEY to .env for real email sending');
    console.log('   Get your free API key at: https://resend.com');
    cachedProvider = new ConsoleEmailProvider();
  }
  return cachedProvider;
}
