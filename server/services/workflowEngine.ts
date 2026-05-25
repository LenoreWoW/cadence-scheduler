/**
 * Workflow Engine
 *
 * Evaluates conditions, interpolates templates, dispatches triggers and
 * executes individual action types for the workflows feature.
 *
 * Trigger types:
 *   - booking.created | booking.cancelled | booking.approved | booking.rejected
 *     → evaluated + executed immediately on dispatch
 *   - before_meeting | after_meeting
 *     → scheduled into workflow_executions with a future-dated `scheduled_at`
 *       and picked up by the background worker (jobs/workflowExecutor.ts).
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';

// ---------- types ----------

export type TriggerEvent =
  | 'booking.created'
  | 'booking.cancelled'
  | 'booking.approved'
  | 'booking.rejected'
  | 'booking.reassigned'
  | 'before_meeting'
  | 'after_meeting';

export interface Condition {
  field: string;
  op: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt';
  value: any;
}

export interface Action {
  type: 'send_email' | 'send_webhook' | 'notify_host' | 'tag_attendee' | 'create_followup';
  config: any;
}

export interface TriggerContext {
  meeting?: any;
  attendee?: { name?: string; email?: string };
  host?: { id?: string; name?: string; email?: string };
  [k: string]: any;
}

interface ActionResult {
  success: boolean;
  error?: string;
  info?: any;
}

// ---------- helpers ----------

function htmlEscape(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Pull a value out of the trigger context via dotted field name. */
function getField(field: string, context: TriggerContext): any {
  if (!field) return undefined;
  const parts = field.split('.');
  let cur: any = context;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function evaluateConditions(conditions: Condition[] | null | undefined, context: TriggerContext): boolean {
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) return true;
  for (const c of conditions) {
    if (!c || typeof c !== 'object') continue;
    const actual = getField(c.field, context);
    const expected = c.value;
    let pass = false;
    switch (c.op) {
      case 'equals':
        pass = actual == expected;
        break;
      case 'not_equals':
        pass = actual != expected;
        break;
      case 'contains':
        pass = typeof actual === 'string' && typeof expected === 'string'
          ? actual.includes(expected)
          : Array.isArray(actual) && actual.includes(expected);
        break;
      case 'gt':
        pass = Number(actual) > Number(expected);
        break;
      case 'lt':
        pass = Number(actual) < Number(expected);
        break;
      default:
        pass = false;
    }
    if (!pass) return false;
  }
  return true;
}

/**
 * Replace {{token}} placeholders. Currently supported:
 *   attendee_name, attendee_email,
 *   meeting_title, date, time,
 *   host_name, host_email
 * All replacements are HTML-escaped to make them safe for direct insertion
 * into email bodies. (For plain-text webhook payloads the escape is harmless.)
 */
export function interpolate(template: string, context: TriggerContext): string {
  if (typeof template !== 'string') return '';
  const meeting = context.meeting || {};
  const attendee = context.attendee || {};
  const host = context.host || {};

  const map: Record<string, any> = {
    attendee_name: attendee.name ?? meeting.attendee_name,
    attendee_email: attendee.email ?? meeting.attendee_email,
    meeting_title: meeting.title,
    date: meeting.date,
    time: meeting.time,
    host_name: host.name,
    host_email: host.email,
  };

  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_m, key: string) => {
    if (key in map) return htmlEscape(map[key]);
    return ''; // unknown token → empty
  });
}

// ---------- action executor ----------

export async function executeAction(
  action: Action,
  context: TriggerContext,
  meetingId: string | null,
  workflowId: string
): Promise<ActionResult> {
  if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
    return { success: false, error: 'invalid action shape' };
  }

  try {
    switch (action.type) {
      case 'send_email': {
        const cfg = action.config || {};
        let to: string | null = null;
        if (cfg.to === 'attendee') to = context.attendee?.email ?? context.meeting?.attendee_email ?? null;
        else if (cfg.to === 'host') to = context.host?.email ?? null;
        else if (cfg.to === 'custom') to = typeof cfg.customEmail === 'string' ? cfg.customEmail : null;
        if (!to) return { success: false, error: 'no email recipient resolved' };

        const subject = interpolate(cfg.subject || 'Notification', context);
        const body = interpolate(cfg.body || '', context);

        const { getEmailProvider } = await import('./emailProvider');
        const provider = getEmailProvider();
        const result = await provider.send({
          to,
          subject,
          html: `<div style="font-family:system-ui,sans-serif">${body.replace(/\n/g, '<br/>')}</div>`,
          text: body,
        });
        return { success: !!result.success, info: { to, subject, messageId: result.messageId } };
      }

      case 'send_webhook': {
        const cfg = action.config || {};
        const url: string = typeof cfg.url === 'string' ? cfg.url : '';
        if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
          return { success: false, error: 'invalid webhook url' };
        }
        const payload = {
          event: 'workflow.action',
          workflow_id: workflowId,
          meeting_id: meetingId,
          delivered_at: new Date().toISOString(),
          data: {
            meeting: context.meeting ?? null,
            attendee: context.attendee ?? null,
            host: context.host ?? null,
          },
        };
        const body = JSON.stringify(payload);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'Cadence-Workflows/1.0',
          'X-Cadence-Event': 'workflow.action',
        };
        if (typeof cfg.secret === 'string' && cfg.secret.length > 0) {
          headers['X-Cadence-Signature'] = crypto.createHmac('sha256', cfg.secret).update(body).digest('hex');
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          const resp = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
          const text = await resp.text().catch(() => '');
          return { success: resp.ok, info: { status: resp.status, body: text.slice(0, 500) } };
        } finally {
          clearTimeout(timer);
        }
      }

      case 'notify_host': {
        const cfg = action.config || {};
        const hostUserId = context.host?.id ?? context.meeting?.host_id;
        if (!hostUserId) return { success: false, error: 'no host id resolved' };
        const title = interpolate(cfg.title || 'Workflow notification', context);
        const body = interpolate(cfg.body || '', context);
        db.connection.prepare(`
          INSERT INTO notifications (id, user_id, type, title, body, link)
          VALUES (?, ?, 'workflow', ?, ?, ?)
        `).run(
          uuidv4(),
          hostUserId,
          title.slice(0, 200),
          body.slice(0, 1000),
          meetingId ? `/?view=my-meetings` : null
        );
        return { success: true, info: { hostUserId } };
      }

      case 'tag_attendee': {
        // Simplest version: append a tag line to the meeting's notes.
        const cfg = action.config || {};
        const tag = typeof cfg.tag === 'string' ? cfg.tag.slice(0, 80) : 'tagged';
        if (!meetingId) return { success: false, error: 'no meeting id for tag_attendee' };
        const row = db.connection.prepare(`SELECT notes FROM meetings WHERE id = ?`).get(meetingId) as any;
        if (!row) return { success: false, error: 'meeting not found' };
        const prefix = row.notes ? `${row.notes}\n` : '';
        const newNotes = `${prefix}[workflow-tag] ${tag}`.slice(0, 4000);
        db.connection.prepare(`UPDATE meetings SET notes = ?, updated_at = datetime('now') WHERE id = ?`).run(newNotes, meetingId);
        return { success: true, info: { tag } };
      }

      case 'create_followup': {
        // Schedule a 7-day-out reminder using the notifications table.
        const cfg = action.config || {};
        const hostUserId = context.host?.id ?? context.meeting?.host_id;
        if (!hostUserId) return { success: false, error: 'no host id for follow-up' };
        const title = interpolate(cfg.title || 'Follow up reminder', context);
        const body = interpolate(cfg.body || `Follow up on meeting with {{attendee_name}}`, context);
        // Notifications table has no scheduled_at — store the date in the body
        // and rely on read=0 + creation timestamp. We use an ISO date in the
        // title so the UI can render it. Best-effort, "good enough" per spec.
        const followupDate = new Date();
        followupDate.setDate(followupDate.getDate() + 7);
        db.connection.prepare(`
          INSERT INTO notifications (id, user_id, type, title, body, link)
          VALUES (?, ?, 'workflow.followup', ?, ?, ?)
        `).run(
          uuidv4(),
          hostUserId,
          `${title} (due ${followupDate.toISOString().split('T')[0]})`.slice(0, 200),
          body.slice(0, 1000),
          meetingId ? `/?view=my-meetings` : null
        );
        return { success: true, info: { scheduledFor: followupDate.toISOString() } };
      }

      default:
        return { success: false, error: `unknown action type: ${(action as any).type}` };
    }
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
}

// ---------- dispatch ----------

interface WorkflowRow {
  id: string;
  user_id: string;
  team_id: string | null;
  name: string;
  trigger_type: string;
  trigger_config: string;
  conditions: string;
  actions: string;
  active: number;
}

function parseWorkflow(row: WorkflowRow) {
  let triggerConfig: any = {};
  let conditions: Condition[] = [];
  let actions: Action[] = [];
  try { triggerConfig = JSON.parse(row.trigger_config || '{}'); } catch {}
  try { conditions = JSON.parse(row.conditions || '[]'); } catch {}
  try { actions = JSON.parse(row.actions || '[]'); } catch {}
  return { ...row, triggerConfig, conditions, actions };
}

/**
 * For instant triggers (`booking.*`), find active workflows for the host (or team),
 * evaluate conditions, and run actions immediately. Failures are recorded per
 * execution but do not throw.
 *
 * For `before_meeting` / `after_meeting`, this is a no-op — they're scheduled
 * via `scheduleForMeeting()` when the meeting is created/approved.
 */
export async function dispatchTrigger(triggerEvent: TriggerEvent, context: TriggerContext): Promise<void> {
  if (triggerEvent === 'before_meeting' || triggerEvent === 'after_meeting') {
    // Time-based triggers are scheduled, not dispatched.
    return;
  }

  const hostId = context.host?.id ?? context.meeting?.host_id;
  if (!hostId) {
    console.warn('[workflowEngine] dispatchTrigger called with no host id');
    return;
  }

  let rows: WorkflowRow[] = [];
  try {
    rows = db.connection.prepare(
      `SELECT * FROM workflows WHERE active = 1 AND trigger_type = ? AND (user_id = ? OR team_id IN (
         SELECT team_id FROM users WHERE id = ?
       ))`
    ).all(triggerEvent, hostId, hostId) as WorkflowRow[];
  } catch (e) {
    console.error('[workflowEngine] failed to load workflows:', e);
    return;
  }

  for (const raw of rows) {
    const wf = parseWorkflow(raw);
    try {
      if (!evaluateConditions(wf.conditions, context)) {
        continue;
      }
      const results: any[] = [];
      for (const action of wf.actions) {
        const r = await executeAction(action, context, context.meeting?.id ?? null, wf.id);
        results.push({ type: action?.type, ...r });
      }
      const status = results.every(r => r.success) ? 'done' : 'failed';
      db.connection.prepare(`
        INSERT INTO workflow_executions (id, workflow_id, meeting_id, trigger_event, status, actions_executed, executed_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(uuidv4(), wf.id, context.meeting?.id ?? null, triggerEvent, status, JSON.stringify(results));
    } catch (e: any) {
      console.error('[workflowEngine] workflow', wf.id, 'failed:', e);
      try {
        db.connection.prepare(`
          INSERT INTO workflow_executions (id, workflow_id, meeting_id, trigger_event, status, error, executed_at)
          VALUES (?, ?, ?, ?, 'failed', ?, datetime('now'))
        `).run(uuidv4(), wf.id, context.meeting?.id ?? null, triggerEvent, String(e?.message || e).slice(0, 1000));
      } catch {}
    }
  }
}

/**
 * Insert scheduled rows into workflow_executions for any `before_meeting` /
 * `after_meeting` workflows owned by the host of this meeting.
 *
 * triggerConfig.offsetMinutes:
 *   - positive for `before_meeting`  → schedule at (meeting_start - n minutes)
 *   - positive for `after_meeting`   → schedule at (meeting_start + n minutes)
 *   - the spec also allows negative offsets on `after_meeting` for "before"
 *     behavior, but we treat the trigger_type as the source of truth.
 */
export async function scheduleForMeeting(meetingId: string): Promise<void> {
  if (!meetingId) return;
  let meeting: any;
  try {
    meeting = db.connection.prepare(`SELECT * FROM meetings WHERE id = ?`).get(meetingId);
  } catch (e) {
    console.error('[workflowEngine] scheduleForMeeting failed to load meeting:', e);
    return;
  }
  if (!meeting) return;
  if (!meeting.date || !meeting.time) return;

  const start = new Date(`${meeting.date}T${meeting.time}:00`);
  if (isNaN(start.getTime())) return;

  let rows: WorkflowRow[] = [];
  try {
    rows = db.connection.prepare(
      `SELECT * FROM workflows
       WHERE active = 1
         AND (trigger_type = 'before_meeting' OR trigger_type = 'after_meeting')
         AND (user_id = ? OR team_id IN (SELECT team_id FROM users WHERE id = ?))`
    ).all(meeting.host_id, meeting.host_id) as WorkflowRow[];
  } catch (e) {
    console.error('[workflowEngine] scheduleForMeeting failed to load workflows:', e);
    return;
  }

  for (const raw of rows) {
    const wf = parseWorkflow(raw);
    const offset = Number(wf.triggerConfig?.offsetMinutes);
    if (!Number.isFinite(offset)) continue;

    const scheduledAt = new Date(start.getTime());
    if (wf.trigger_type === 'before_meeting') {
      scheduledAt.setTime(scheduledAt.getTime() - Math.abs(offset) * 60_000);
    } else {
      // after_meeting: positive offset → after, negative → before
      scheduledAt.setTime(scheduledAt.getTime() + offset * 60_000);
    }
    // Don't schedule something already in the past.
    if (scheduledAt.getTime() <= Date.now()) continue;

    try {
      db.connection.prepare(`
        INSERT INTO workflow_executions (id, workflow_id, meeting_id, trigger_event, status, scheduled_at, executed_at)
        VALUES (?, ?, ?, ?, 'scheduled', ?, NULL)
      `).run(
        uuidv4(),
        wf.id,
        meetingId,
        wf.trigger_type,
        scheduledAt.toISOString().replace('T', ' ').slice(0, 19)
      );
    } catch (e) {
      console.error('[workflowEngine] failed to insert scheduled execution:', e);
    }
  }
}

/** Internal: load + parse a workflow row by id. Exported for the executor job. */
export function loadWorkflow(workflowId: string) {
  const row = db.connection.prepare(`SELECT * FROM workflows WHERE id = ?`).get(workflowId) as WorkflowRow | undefined;
  if (!row) return null;
  return parseWorkflow(row);
}

/** Build the trigger context from a meeting id by joining the host record. */
export function buildContextFromMeetingId(meetingId: string): TriggerContext | null {
  const row = db.connection.prepare(`
    SELECT m.*, u.name as host_name, u.email as host_email
    FROM meetings m
    LEFT JOIN users u ON m.host_id = u.id
    WHERE m.id = ?
  `).get(meetingId) as any;
  if (!row) return null;
  return {
    meeting: row,
    attendee: { name: row.attendee_name, email: row.attendee_email },
    host: { id: row.host_id, name: row.host_name, email: row.host_email },
  };
}
