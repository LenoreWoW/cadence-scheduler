/**
 * Workflows Routes
 *
 * Cal.com-style automations. Each workflow:
 *   trigger_type    — when to run
 *   trigger_config  — extra params (e.g. offsetMinutes for time triggers)
 *   conditions      — pre-action filter
 *   actions         — what to do
 *
 * Booking-event triggers run inline via dispatchTrigger() from the booking
 * routes. Time-based triggers (`before_meeting`, `after_meeting`) are
 * scheduled into workflow_executions and run by jobs/workflowExecutor.ts.
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// ---------- shape validation ----------

const TRIGGER_TYPES = new Set([
  'booking.created',
  'booking.cancelled',
  'booking.approved',
  'booking.rejected',
  'before_meeting',
  'after_meeting',
]);
const ACTION_TYPES = new Set(['send_email', 'send_webhook', 'notify_host', 'tag_attendee', 'create_followup']);
const CONDITION_OPS = new Set(['equals', 'not_equals', 'contains', 'gt', 'lt']);

interface WorkflowInput {
  name: string;
  triggerType: string;
  triggerConfig?: any;
  conditions?: any[];
  actions: any[];
  active?: boolean;
}

function validateAction(action: any): void {
  if (!action || typeof action !== 'object' || !ACTION_TYPES.has(action.type)) {
    throw new AppError(`Invalid action type: ${action?.type}`, 400);
  }
  const cfg = action.config || {};
  switch (action.type) {
    case 'send_email': {
      if (!['attendee', 'host', 'custom'].includes(cfg.to)) {
        throw new AppError('send_email.to must be attendee, host, or custom', 400);
      }
      if (cfg.to === 'custom') {
        if (typeof cfg.customEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.customEmail)) {
          throw new AppError('send_email.customEmail must be a valid email', 400);
        }
      }
      if (typeof cfg.subject !== 'string' || cfg.subject.length < 1 || cfg.subject.length > 200) {
        throw new AppError('send_email.subject must be 1-200 characters', 400);
      }
      if (typeof cfg.body !== 'string' || cfg.body.length > 10_000) {
        throw new AppError('send_email.body must be a string up to 10000 chars', 400);
      }
      break;
    }
    case 'send_webhook': {
      if (typeof cfg.url !== 'string' || !(cfg.url.startsWith('http://') || cfg.url.startsWith('https://'))) {
        throw new AppError('send_webhook.url must be a valid http(s) URL', 400);
      }
      if (cfg.url.length > 500) throw new AppError('send_webhook.url too long', 400);
      if (cfg.secret !== undefined && typeof cfg.secret !== 'string') {
        throw new AppError('send_webhook.secret must be a string', 400);
      }
      break;
    }
    case 'notify_host': {
      if (typeof cfg.title !== 'string' || cfg.title.length < 1 || cfg.title.length > 200) {
        throw new AppError('notify_host.title must be 1-200 characters', 400);
      }
      if (cfg.body !== undefined && (typeof cfg.body !== 'string' || cfg.body.length > 1000)) {
        throw new AppError('notify_host.body must be a string up to 1000 chars', 400);
      }
      break;
    }
    case 'tag_attendee': {
      if (typeof cfg.tag !== 'string' || cfg.tag.length < 1 || cfg.tag.length > 80) {
        throw new AppError('tag_attendee.tag must be 1-80 characters', 400);
      }
      break;
    }
    case 'create_followup': {
      if (cfg.title !== undefined && (typeof cfg.title !== 'string' || cfg.title.length > 200)) {
        throw new AppError('create_followup.title must be a string up to 200 chars', 400);
      }
      if (cfg.body !== undefined && (typeof cfg.body !== 'string' || cfg.body.length > 1000)) {
        throw new AppError('create_followup.body must be a string up to 1000 chars', 400);
      }
      break;
    }
  }
}

function validateWorkflow(input: any, partial = false): WorkflowInput {
  if (!input || typeof input !== 'object') throw new AppError('Invalid body', 400);

  if (!partial || input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.length < 1 || input.name.length > 200) {
      throw new AppError('name must be 1-200 characters', 400);
    }
  }

  if (!partial || input.triggerType !== undefined) {
    if (!TRIGGER_TYPES.has(input.triggerType)) {
      throw new AppError(`Invalid triggerType: ${input.triggerType}`, 400);
    }
  }

  const triggerType = input.triggerType ?? '';
  const triggerConfig = input.triggerConfig ?? {};
  if (!partial || input.triggerConfig !== undefined || input.triggerType !== undefined) {
    if (typeof triggerConfig !== 'object' || Array.isArray(triggerConfig)) {
      throw new AppError('triggerConfig must be an object', 400);
    }
    if (triggerType === 'before_meeting' || triggerType === 'after_meeting') {
      const off = Number(triggerConfig.offsetMinutes);
      if (!Number.isFinite(off)) {
        throw new AppError(`${triggerType} requires triggerConfig.offsetMinutes (number)`, 400);
      }
      if (Math.abs(off) > 60 * 24 * 30) {
        throw new AppError('offsetMinutes out of range (±30 days)', 400);
      }
    }
  }

  let conditions: any[] = [];
  if (input.conditions !== undefined) {
    if (!Array.isArray(input.conditions)) throw new AppError('conditions must be an array', 400);
    if (input.conditions.length > 10) throw new AppError('Up to 10 conditions allowed', 400);
    for (const c of input.conditions) {
      if (!c || typeof c !== 'object') throw new AppError('Invalid condition', 400);
      if (typeof c.field !== 'string') throw new AppError('condition.field must be a string', 400);
      if (!CONDITION_OPS.has(c.op)) throw new AppError(`Invalid condition.op: ${c.op}`, 400);
    }
    conditions = input.conditions;
  }

  let actions: any[] = [];
  if (!partial || input.actions !== undefined) {
    if (!Array.isArray(input.actions) || input.actions.length === 0) {
      throw new AppError('actions must be a non-empty array', 400);
    }
    if (input.actions.length > 10) throw new AppError('Up to 10 actions allowed', 400);
    for (const a of input.actions) validateAction(a);
    actions = input.actions;
  }

  return {
    name: input.name,
    triggerType,
    triggerConfig,
    conditions,
    actions,
    active: input.active,
  };
}

function mapRow(row: any): any {
  return {
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id,
    name: row.name,
    triggerType: row.trigger_type,
    triggerConfig: safeParse(row.trigger_config, {}),
    conditions: safeParse(row.conditions, []),
    actions: safeParse(row.actions, []),
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function safeParse<T>(s: any, fallback: T): T {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}

// ---------- CRUD ----------

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const v = validateWorkflow(req.body);
  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO workflows (id, user_id, team_id, name, trigger_type, trigger_config, conditions, actions, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.user!.userId,
    null,
    v.name,
    v.triggerType,
    JSON.stringify(v.triggerConfig ?? {}),
    JSON.stringify(v.conditions ?? []),
    JSON.stringify(v.actions),
    v.active === false ? 0 : 1
  );
  const row = db.connection.prepare(`SELECT * FROM workflows WHERE id = ?`).get(id);
  res.status(201).json(mapRow(row));
});

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const rows = db.connection.prepare(
    `SELECT * FROM workflows WHERE user_id = ? ORDER BY created_at DESC`
  ).all(req.user!.userId) as any[];
  res.json(rows.map(mapRow));
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const row = db.connection.prepare(
    `SELECT * FROM workflows WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user!.userId) as any;
  if (!row) throw new AppError('Workflow not found', 404);
  res.json(mapRow(row));
});

router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const existing = db.connection.prepare(
    `SELECT * FROM workflows WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user!.userId) as any;
  if (!existing) throw new AppError('Workflow not found', 404);

  const merged = {
    name: req.body?.name ?? existing.name,
    triggerType: req.body?.triggerType ?? existing.trigger_type,
    triggerConfig: req.body?.triggerConfig ?? safeParse(existing.trigger_config, {}),
    conditions: req.body?.conditions ?? safeParse(existing.conditions, []),
    actions: req.body?.actions ?? safeParse(existing.actions, []),
    active: req.body?.active === undefined ? !!existing.active : !!req.body.active,
  };
  const v = validateWorkflow(merged);

  db.connection.prepare(`
    UPDATE workflows SET
      name = ?,
      trigger_type = ?,
      trigger_config = ?,
      conditions = ?,
      actions = ?,
      active = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    v.name,
    v.triggerType,
    JSON.stringify(v.triggerConfig ?? {}),
    JSON.stringify(v.conditions ?? []),
    JSON.stringify(v.actions),
    merged.active ? 1 : 0,
    req.params.id
  );

  const row = db.connection.prepare(`SELECT * FROM workflows WHERE id = ?`).get(req.params.id);
  res.json(mapRow(row));
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const result = db.connection.prepare(
    `DELETE FROM workflows WHERE id = ? AND user_id = ?`
  ).run(req.params.id, req.user!.userId);
  if (result.changes === 0) throw new AppError('Workflow not found', 404);
  res.json({ message: 'Workflow deleted' });
});

// ---------- test ----------

router.post('/:id/test', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const row = db.connection.prepare(
    `SELECT * FROM workflows WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user!.userId) as any;
  if (!row) throw new AppError('Workflow not found', 404);

  const host = db.connection.prepare(`SELECT id, name, email FROM users WHERE id = ?`).get(req.user!.userId) as any;
  const sampleContext = {
    meeting: {
      id: 'test-meeting',
      title: 'Test meeting from workflow editor',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      duration_minutes: 30,
      attendee_name: 'Sample Attendee',
      attendee_email: host?.email ?? 'test@example.com',
      host_id: req.user!.userId,
      notes: 'This is a workflow test run.',
    },
    attendee: { name: 'Sample Attendee', email: host?.email ?? 'test@example.com' },
    host: { id: req.user!.userId, name: host?.name ?? 'Host', email: host?.email },
  };

  const { executeAction, evaluateConditions } = await import('../services/workflowEngine');
  const actions = safeParse<any[]>(row.actions, []);
  const conditions = safeParse<any[]>(row.conditions, []);
  const conditionsPass = evaluateConditions(conditions, sampleContext);

  const results: any[] = [];
  if (conditionsPass) {
    for (const action of actions) {
      try {
        const r = await executeAction(action, sampleContext, null, row.id);
        results.push({ type: action?.type, ...r });
      } catch (e: any) {
        results.push({ type: action?.type, success: false, error: e?.message || String(e) });
      }
    }
  }

  res.json({
    conditionsPass,
    results,
    sampleContext,
  });
});

router.get('/:id/executions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const row = db.connection.prepare(
    `SELECT id FROM workflows WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user!.userId);
  if (!row) throw new AppError('Workflow not found', 404);

  const rows = db.connection.prepare(`
    SELECT id, workflow_id, meeting_id, trigger_event, status, actions_executed, error, scheduled_at, executed_at
    FROM workflow_executions
    WHERE workflow_id = ?
    ORDER BY COALESCE(executed_at, scheduled_at) DESC
    LIMIT 50
  `).all(req.params.id) as any[];

  res.json(rows.map(r => ({
    id: r.id,
    workflowId: r.workflow_id,
    meetingId: r.meeting_id,
    triggerEvent: r.trigger_event,
    status: r.status,
    actionsExecuted: safeParse(r.actions_executed, null),
    error: r.error,
    scheduledAt: r.scheduled_at,
    executedAt: r.executed_at,
  })));
});

export default router;
