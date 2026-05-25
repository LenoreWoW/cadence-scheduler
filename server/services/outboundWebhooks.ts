/**
 * Outbound webhooks dispatcher.
 *
 * Fire-and-forget delivery of events to user-configured HTTPS endpoints,
 * signed with HMAC-SHA256 so receivers can verify authenticity. Failures
 * are recorded to `webhook_deliveries` but never thrown — the caller's
 * request must succeed even if webhook delivery doesn't.
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';

const TIMEOUT_MS = 5000;

export type WebhookEvent =
  | 'booking.created'
  | 'booking.cancelled'
  | 'booking.rescheduled'
  | 'booking.approved'
  | 'booking.rejected'
  | 'webhook.test';

interface WebhookRow {
  id: string;
  user_id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string;
  is_active: number;
}

function sign(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function postWithTimeout(url: string, body: string, headers: Record<string, string>): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 2000) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dispatch an event to all matching active webhooks for the given user.
 * Records each delivery attempt; never throws.
 */
export function dispatchWebhook(userId: string, event: WebhookEvent, payload: any): void {
  // Fire-and-forget — kicked off but the caller doesn't await it.
  (async () => {
    try {
      if (!userId) return;
      const rows = db.connection.prepare(
        `SELECT * FROM outbound_webhooks WHERE user_id = ? AND is_active = 1`
      ).all(userId) as WebhookRow[];

      const matching = rows.filter(r => {
        try {
          const events: string[] = JSON.parse(r.events || '[]');
          return Array.isArray(events) && events.includes(event);
        } catch {
          return false;
        }
      });

      if (matching.length === 0) return;

      const bodyObj = {
        event,
        delivered_at: new Date().toISOString(),
        data: payload,
      };
      const body = JSON.stringify(bodyObj);

      for (const hook of matching) {
        try {
          const signature = hook.secret ? sign(hook.secret, body) : '';
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Cadence-Event': event,
            'User-Agent': 'Cadence-Webhooks/1.0',
          };
          if (signature) headers['X-Cadence-Signature'] = signature;

          let status = 0;
          let respBody = '';
          try {
            const r = await postWithTimeout(hook.url, body, headers);
            status = r.status;
            respBody = r.text;
          } catch (e: any) {
            respBody = `error: ${e?.message || String(e)}`.slice(0, 2000);
          }

          try {
            db.connection.prepare(`
              INSERT INTO webhook_deliveries (id, webhook_id, event, payload, status_code, response_body)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(uuidv4(), hook.id, event, body.slice(0, 8000), status || null, respBody);
            db.connection.prepare(`
              UPDATE outbound_webhooks SET last_delivery_at = datetime('now'), last_status = ? WHERE id = ?
            `).run(status || null, hook.id);
          } catch {}
        } catch (e) {
          console.error('[outboundWebhooks] delivery failed for hook', hook.id, e);
        }
      }
    } catch (e) {
      console.error('[outboundWebhooks.dispatchWebhook] unexpected:', e);
    }
  })();
}

/**
 * Synchronous test delivery — used by the "Test webhook" button.
 * Returns the response status code (or null on transport error).
 */
export async function deliverTestWebhook(hookId: string): Promise<{ status: number | null; body: string }> {
  const hook = db.connection.prepare(`SELECT * FROM outbound_webhooks WHERE id = ?`).get(hookId) as WebhookRow | undefined;
  if (!hook) throw new Error('Webhook not found');

  const body = JSON.stringify({
    event: 'webhook.test',
    delivered_at: new Date().toISOString(),
    data: { message: 'Test delivery from Cadence' },
  });
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Cadence-Event': 'webhook.test',
    'User-Agent': 'Cadence-Webhooks/1.0',
  };
  if (hook.secret) headers['X-Cadence-Signature'] = sign(hook.secret, body);

  let status: number | null = null;
  let respBody = '';
  try {
    const r = await postWithTimeout(hook.url, body, headers);
    status = r.status;
    respBody = r.text;
  } catch (e: any) {
    respBody = `error: ${e?.message || String(e)}`.slice(0, 2000);
  }

  try {
    db.connection.prepare(`
      INSERT INTO webhook_deliveries (id, webhook_id, event, payload, status_code, response_body)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), hook.id, 'webhook.test', body.slice(0, 8000), status, respBody);
    db.connection.prepare(`
      UPDATE outbound_webhooks SET last_delivery_at = datetime('now'), last_status = ? WHERE id = ?
    `).run(status, hook.id);
  } catch {}

  return { status, body: respBody };
}
