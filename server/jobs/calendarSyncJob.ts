/**
 * Calendar Sync Background Job
 *
 * Runs periodically to:
 * 1. Pull new events from external calendars (Google, Microsoft)
 * 2. Push approved Cadence meetings to connected calendars
 * 3. Clean up old external events
 */

import { db } from '../database';
import { pullExternalEvents, syncMeetingToCalendar, getValidAccessToken } from '../services/calendarSync';

let syncIntervalId: NodeJS.Timeout | null = null;

/**
 * Sync all connected calendars
 */
async function syncAllCalendars(): Promise<void> {
  console.log('📅 Starting calendar sync job...');

  try {
    // Get all users with calendar connections
    const connections = db.connection.prepare(`
      SELECT DISTINCT user_id FROM calendar_connections WHERE sync_enabled = 1
    `).all() as { user_id: string }[];

    let syncedUsers = 0;
    let syncedEvents = 0;
    let syncedMeetings = 0;

    for (const { user_id } of connections) {
      try {
        // Pull external events
        const imported = await pullExternalEvents(user_id);
        syncedEvents += imported;

        // Push unsync'd approved meetings
        const unsynced = db.connection.prepare(`
          SELECT m.id FROM meetings m
          LEFT JOIN synced_meetings sm ON sm.meeting_id = m.id
          LEFT JOIN calendar_connections cc ON cc.user_id = m.host_id
          WHERE m.host_id = ?
          AND m.status = 'approved'
          AND m.date >= date('now')
          AND sm.id IS NULL
          AND cc.sync_enabled = 1
        `).all(user_id) as { id: string }[];

        for (const { id } of unsynced) {
          try {
            await syncMeetingToCalendar(id);
            syncedMeetings++;
          } catch (e) {
            console.error(`Failed to sync meeting ${id}:`, e);
          }
        }

        syncedUsers++;
      } catch (error) {
        console.error(`Failed to sync calendars for user ${user_id}:`, error);
      }
    }

    // Clean up old external events (older than 7 days)
    const cleanupResult = db.connection.prepare(`
      DELETE FROM external_events WHERE end_time < datetime('now', '-7 days')
    `).run();

    console.log(`✅ Calendar sync complete: ${syncedUsers} users, ${syncedEvents} events imported, ${syncedMeetings} meetings pushed, ${cleanupResult.changes} old events cleaned`);
  } catch (error) {
    console.error('❌ Calendar sync job failed:', error);
  }
}

/**
 * Sync calendars for a specific user (on-demand)
 */
export async function syncUserCalendars(userId: string): Promise<{
  eventsImported: number;
  meetingsSynced: number;
}> {
  const eventsImported = await pullExternalEvents(userId);

  // Push unsync'd approved meetings
  const unsynced = db.connection.prepare(`
    SELECT m.id FROM meetings m
    LEFT JOIN synced_meetings sm ON sm.meeting_id = m.id
    LEFT JOIN calendar_connections cc ON cc.user_id = m.host_id
    WHERE m.host_id = ?
    AND m.status = 'approved'
    AND m.date >= date('now')
    AND sm.id IS NULL
    AND cc.sync_enabled = 1
  `).all(userId) as { id: string }[];

  let meetingsSynced = 0;
  for (const { id } of unsynced) {
    try {
      await syncMeetingToCalendar(id);
      meetingsSynced++;
    } catch (e) {
      console.error(`Failed to sync meeting ${id}:`, e);
    }
  }

  return { eventsImported, meetingsSynced };
}

/**
 * Initialize the calendar sync scheduler
 * @param intervalMs - Sync interval in milliseconds (default: 15 minutes)
 */
export function initCalendarSyncScheduler(intervalMs: number = 15 * 60 * 1000): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }

  console.log(`🔄 Calendar sync scheduler initialized (every ${intervalMs / 60000} minutes)`);

  // Run immediately on startup after a delay
  setTimeout(() => {
    syncAllCalendars();
  }, 10000); // 10 second delay to let server fully start

  // Then run at interval
  syncIntervalId = setInterval(() => {
    syncAllCalendars();
  }, intervalMs);
}

/**
 * Stop the calendar sync scheduler
 */
export function stopCalendarSyncScheduler(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('📅 Calendar sync scheduler stopped');
  }
}

export default {
  initCalendarSyncScheduler,
  stopCalendarSyncScheduler,
  syncUserCalendars,
  syncAllCalendars
};
