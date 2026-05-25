/**
 * User Stats Sync Service
 *
 * Best-effort helpers that keep `user_stats` current as side-effects of
 * other actions (booking, login, attendance). Never throw — failures are
 * logged but don't impact the parent request.
 *
 * The level curve mirrors the frontend's `achievementService` LEVEL_XP table
 * so client and server agree on what "level 5" means.
 */

import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

// Cumulative XP required to *reach* each level. Index 0 = level 1 (0 XP).
// Mirror of LEVEL_XP in services/achievementService on the frontend.
export const LEVEL_XP = [0, 50, 150, 300, 500, 750, 1100, 1500, 2000, 3000, 5000];

/** Pure helper — given a total XP, return the user's level (1-based). */
export function recalcLevel(xp: number): number {
  if (typeof xp !== 'number' || !isFinite(xp) || xp < 0) return 1;
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) {
    if (xp >= LEVEL_XP[i]) level = i + 1;
    else break;
  }
  return level;
}

/** Make sure a `user_stats` row exists for the given user. */
function ensureStatsRow(userId: string): void {
  try {
    const row = db.connection.prepare(`SELECT user_id FROM user_stats WHERE user_id = ?`).get(userId);
    if (!row) {
      db.connection.prepare(`
        INSERT INTO user_stats (id, user_id, total_bookings, total_cancellations, meetings_attended, xp, level)
        VALUES (?, ?, 0, 0, 0, 0, 1)
      `).run(uuidv4(), userId);
    }
  } catch (e) {
    // Stats row creation is best-effort.
  }
}

/**
 * Award XP and bump the user's level if a threshold was crossed.
 * Inserts an in-app notification on level-up so the UI can celebrate it.
 */
export function awardXp(userId: string, amount: number, reason: string = 'reward'): void {
  try {
    if (!userId || typeof amount !== 'number' || amount === 0) return;
    ensureStatsRow(userId);

    const before = db.connection.prepare(
      `SELECT xp, level FROM user_stats WHERE user_id = ?`
    ).get(userId) as any;
    const oldXp = before?.xp ?? 0;
    const oldLevel = before?.level ?? recalcLevel(oldXp);
    const newXp = Math.max(0, oldXp + amount);
    const newLevel = recalcLevel(newXp);

    db.connection.prepare(`
      UPDATE user_stats SET xp = ?, level = ?, updated_at = datetime('now') WHERE user_id = ?
    `).run(newXp, newLevel, userId);

    if (newLevel > oldLevel) {
      try {
        db.connection.prepare(`
          INSERT INTO notifications (id, user_id, type, title, body, link)
          VALUES (?, ?, 'level.up', ?, ?, ?)
        `).run(
          uuidv4(),
          userId,
          `Level up! You're now level ${newLevel}`,
          `Earned ${amount} XP from ${reason}. Keep going!`,
          '/?view=achievements'
        );
      } catch {}
    }
  } catch (e) {
    console.error('[userStatsSync.awardXp] failed:', e);
  }
}

/** Increment total_bookings and award 10 XP. */
export function incrementBookingStat(userId: string): void {
  try {
    if (!userId) return;
    ensureStatsRow(userId);
    db.connection.prepare(`
      UPDATE user_stats SET total_bookings = total_bookings + 1, updated_at = datetime('now') WHERE user_id = ?
    `).run(userId);
    awardXp(userId, 10, 'new booking');
  } catch (e) {
    console.error('[userStatsSync.incrementBookingStat] failed:', e);
  }
}

/** Increment total_cancellations. */
export function incrementCancellationStat(userId: string): void {
  try {
    if (!userId) return;
    ensureStatsRow(userId);
    db.connection.prepare(`
      UPDATE user_stats SET total_cancellations = total_cancellations + 1, updated_at = datetime('now') WHERE user_id = ?
    `).run(userId);
  } catch (e) {
    console.error('[userStatsSync.incrementCancellationStat] failed:', e);
  }
}

/** Increment meetings_attended and award 15 XP. */
export function incrementAttendanceStat(userId: string): void {
  try {
    if (!userId) return;
    ensureStatsRow(userId);
    db.connection.prepare(`
      UPDATE user_stats SET meetings_attended = meetings_attended + 1, updated_at = datetime('now') WHERE user_id = ?
    `).run(userId);
    awardXp(userId, 15, 'meeting attendance');
  } catch (e) {
    console.error('[userStatsSync.incrementAttendanceStat] failed:', e);
  }
}
