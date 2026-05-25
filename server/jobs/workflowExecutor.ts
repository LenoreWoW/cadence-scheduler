/**
 * Workflow Executor
 *
 * Polls `workflow_executions` for `status = 'scheduled'` rows whose
 * `scheduled_at` has elapsed and runs each one's actions. Each execution is
 * wrapped so a single bad workflow doesn't stop the loop.
 */

import { db } from '../database';
import {
  loadWorkflow,
  executeAction,
  evaluateConditions,
  buildContextFromMeetingId,
} from '../services/workflowEngine';

interface ExecutionRow {
  id: string;
  workflow_id: string;
  meeting_id: string | null;
  trigger_event: string;
  status: string;
  scheduled_at: string | null;
}

async function runOne(exec: ExecutionRow): Promise<void> {
  const workflow = loadWorkflow(exec.workflow_id);
  if (!workflow) {
    db.connection.prepare(
      `UPDATE workflow_executions SET status = 'failed', error = ?, executed_at = datetime('now') WHERE id = ?`
    ).run('workflow not found', exec.id);
    return;
  }
  if (!workflow.active) {
    db.connection.prepare(
      `UPDATE workflow_executions SET status = 'cancelled', executed_at = datetime('now') WHERE id = ?`
    ).run(exec.id);
    return;
  }

  // Build context. Time-based triggers always have a meeting.
  let context: any = {};
  if (exec.meeting_id) {
    const ctx = buildContextFromMeetingId(exec.meeting_id);
    if (!ctx) {
      db.connection.prepare(
        `UPDATE workflow_executions SET status = 'cancelled', error = ?, executed_at = datetime('now') WHERE id = ?`
      ).run('meeting deleted', exec.id);
      return;
    }
    context = ctx;
  }

  if (!evaluateConditions(workflow.conditions, context)) {
    db.connection.prepare(
      `UPDATE workflow_executions SET status = 'skipped', actions_executed = ?, executed_at = datetime('now') WHERE id = ?`
    ).run(JSON.stringify({ reason: 'conditions not met' }), exec.id);
    return;
  }

  const results: any[] = [];
  for (const action of workflow.actions) {
    try {
      const r = await executeAction(action, context, exec.meeting_id, workflow.id);
      results.push({ type: action?.type, ...r });
    } catch (e: any) {
      results.push({ type: action?.type, success: false, error: e?.message || String(e) });
    }
  }
  const status = results.every(r => r.success) ? 'done' : 'failed';
  db.connection.prepare(
    `UPDATE workflow_executions SET status = ?, actions_executed = ?, executed_at = datetime('now') WHERE id = ?`
  ).run(status, JSON.stringify(results), exec.id);
}

async function runDueExecutions(): Promise<void> {
  let rows: ExecutionRow[] = [];
  try {
    rows = db.connection.prepare(
      `SELECT id, workflow_id, meeting_id, trigger_event, status, scheduled_at
       FROM workflow_executions
       WHERE status = 'scheduled'
         AND scheduled_at IS NOT NULL
         AND scheduled_at <= datetime('now')
       ORDER BY scheduled_at ASC
       LIMIT 100`
    ).all() as ExecutionRow[];
  } catch (e) {
    console.error('[workflowExecutor] failed to query due executions:', e);
    return;
  }
  if (rows.length === 0) return;

  for (const row of rows) {
    try {
      await runOne(row);
    } catch (e: any) {
      console.error('[workflowExecutor] execution', row.id, 'crashed:', e);
      try {
        db.connection.prepare(
          `UPDATE workflow_executions SET status = 'failed', error = ?, executed_at = datetime('now') WHERE id = ?`
        ).run(String(e?.message || e).slice(0, 1000), row.id);
      } catch {}
    }
  }
}

/**
 * Start the polling loop. The first run is deferred by 90s so we don't compete
 * with boot-time DB migrations / other init work.
 */
export function initWorkflowExecutor(intervalMs: number = 60_000): NodeJS.Timeout {
  console.log('⚙️  Workflow executor initialized (interval:', intervalMs, 'ms)');
  setTimeout(() => {
    runDueExecutions().catch(err => console.error('[workflowExecutor] initial run failed:', err));
  }, 90_000);
  return setInterval(() => {
    runDueExecutions().catch(err => console.error('[workflowExecutor] periodic run failed:', err));
  }, intervalMs);
}
