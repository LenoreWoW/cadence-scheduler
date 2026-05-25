/**
 * Retention job — daily cleanup of large-tail tables. Defaults:
 *   - activity_logs: 365 days (override via LOG_RETENTION_DAYS)
 *   - webhook_deliveries: 90 days
 *   - notifications: 180 days
 *
 * Logs the number of rows pruned on each run.
 */

import { db } from '../database';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function logRetentionDays(): number {
  const env = process.env.LOG_RETENTION_DAYS;
  const n = env ? parseInt(env, 10) : 365;
  return Number.isFinite(n) && n > 0 ? n : 365;
}

function runOnce(): void {
  try {
    const logDays = logRetentionDays();
    const webhookDays = 90;
    const notifDays = 180;

    const logsResult = db.connection.prepare(
      `DELETE FROM activity_logs WHERE created_at < datetime('now', '-' || ? || ' days')`
    ).run(logDays);

    let webhookResult = { changes: 0 };
    try {
      webhookResult = db.connection.prepare(
        `DELETE FROM webhook_deliveries WHERE delivered_at < datetime('now', '-' || ? || ' days')`
      ).run(webhookDays);
    } catch {}

    let notifResult = { changes: 0 };
    try {
      notifResult = db.connection.prepare(
        `DELETE FROM notifications WHERE created_at < datetime('now', '-' || ? || ' days') AND read = 1`
      ).run(notifDays);
    } catch {}

    console.log(
      `🧹 Retention: activity_logs -${logsResult.changes} (>${logDays}d), ` +
      `webhook_deliveries -${webhookResult.changes} (>${webhookDays}d), ` +
      `notifications -${notifResult.changes} (>${notifDays}d)`
    );
  } catch (e) {
    console.error('[retentionJob] failed:', e);
  }
}

/** Run daily. Returns the interval so callers can clear it if needed. */
export function initRetentionJob(intervalMs: number = ONE_DAY_MS): NodeJS.Timeout {
  console.log('🧹 Retention job initialized');
  // Run once a minute after boot so we don't compete with seeding.
  setTimeout(() => runOnce(), 60_000);
  return setInterval(runOnce, intervalMs);
}
