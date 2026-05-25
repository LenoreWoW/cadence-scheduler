/**
 * Meeting Routes
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { syncMeetingToCalendar, deleteSyncedEvent, getExternalBusyTimes } from '../services/calendarSync';
import { awardXp, incrementBookingStat } from '../services/userStatsSync';
import { dispatchWebhook } from '../services/outboundWebhooks';
import { trackChallengeProgress } from './challenges';

const router = Router();

// ----- User-wide booking caps helper -----

function userCapsStart(period: 'week' | 'month' | 'year'): string {
  const now = new Date();
  if (period === 'week') {
    const day = now.getUTCDay();
    const start = new Date(now);
    start.setUTCDate(now.getUTCDate() - day);
    start.setUTCHours(0, 0, 0, 0);
    return start.toISOString().slice(0, 10);
  }
  if (period === 'month') {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  }
  return `${now.getUTCFullYear()}-01-01`;
}

/** Throws AppError(409) if any of the host's caps would be exceeded by one more booking. */
export function enforceUserBookingCaps(hostId: string): void {
  const caps = db.connection.prepare(
    `SELECT weekly_booking_cap, monthly_booking_cap, yearly_booking_cap FROM users WHERE id = ?`
  ).get(hostId) as any;
  if (!caps) return;
  const checks: Array<{ cap: number | null; period: 'week' | 'month' | 'year' }> = [
    { cap: caps.weekly_booking_cap, period: 'week' },
    { cap: caps.monthly_booking_cap, period: 'month' },
    { cap: caps.yearly_booking_cap, period: 'year' },
  ];
  for (const { cap, period } of checks) {
    if (cap === null || cap === undefined || cap === 0) continue;
    const from = userCapsStart(period);
    const row = db.connection.prepare(
      `SELECT COUNT(*) as c FROM meetings WHERE host_id = ? AND date >= ? AND status IN ('pending','approved')`
    ).get(hostId, from) as any;
    if ((row?.c || 0) >= cap) {
      throw new AppError('Host has reached the booking limit for this period', 409);
    }
  }
}

// ----- External ID template interpolation -----

export function interpolateExternalIdTemplate(template: string, ctx: { date: string; slug?: string; hostId: string; counter: number }): string {
  return template
    .replace(/\{\{date\}\}/g, ctx.date.replace(/-/g, ''))
    .replace(/\{\{slug\}\}/g, ctx.slug || '')
    .replace(/\{\{counter\}\}/g, String(ctx.counter))
    .replace(/\{\{uuid\}\}/g, uuidv4().slice(0, 8));
}


// Approval queue — meetings that need this user (as approver) to act
router.get('/pending-approval', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    let sql = `
      SELECT m.*, u.name as host_name, u.avatar as host_avatar
      FROM meetings m
      LEFT JOIN users u ON m.host_id = u.id
      WHERE m.status = 'pending' AND m.approval_required = 1
    `;
    const params: any[] = [];
    if (role !== 'admin') {
      sql += ' AND (m.approver_id = ? OR m.host_id = ?)';
      params.push(userId, userId);
    }
    sql += ' ORDER BY m.date ASC, m.time ASC';

    const meetings = db.connection.prepare(sql).all(...params) as any[];
    res.json(meetings.map(m => ({
      id: m.id,
      title: m.title,
      date: m.date,
      time: m.time,
      durationMinutes: m.duration_minutes,
      attendeeName: m.attendee_name,
      attendeeEmail: m.attendee_email,
      hostId: m.host_id,
      hostName: m.host_name,
      hostAvatar: m.host_avatar,
      notes: m.notes,
      meetingFormat: m.meeting_format || 'in-person',
      meetingLink: m.meeting_link,
      createdAt: m.created_at,
    })));
  } catch (error) {
    throw new AppError('Failed to fetch pending approvals', 500);
  }
});

// Get meetings (filtered by role)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const { hostId, status, startDate, endDate, externalId } = req.query;

    let sql = `
      SELECT m.*, u.name as host_name, u.avatar as host_avatar
      FROM meetings m
      LEFT JOIN users u ON m.host_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Role-based filtering
    if (role === 'guest') {
      sql += ' AND m.user_id = ?';
      params.push(userId);
    } else if (role !== 'admin') {
      sql += ' AND (m.host_id = ? OR m.user_id = ?)';
      params.push(userId, userId);
    }

    if (hostId) {
      sql += ' AND m.host_id = ?';
      params.push(hostId);
    }

    if (status) {
      sql += ' AND m.status = ?';
      params.push(status);
    }

    if (startDate) {
      sql += ' AND m.date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND m.date <= ?';
      params.push(endDate);
    }

    if (externalId) {
      sql += ' AND m.external_id = ?';
      params.push(externalId);
    }

    sql += ' ORDER BY m.date ASC, m.time ASC';

    const meetings = db.connection.prepare(sql).all(...params) as any[];

    const result = meetings.map(m => ({
      id: m.id,
      title: m.title,
      date: m.date,
      time: m.time,
      durationMinutes: m.duration_minutes,
      attendeeName: m.attendee_name,
      attendeeEmail: m.attendee_email,
      additionalAttendees: m.additional_attendees,
      userId: m.user_id,
      hostId: m.host_id,
      hostName: m.host_name,
      hostAvatar: m.host_avatar,
      status: m.status,
      bookedBy: m.booked_by,
      notes: m.notes,
      category: m.category,
      meetingFormat: m.meeting_format || 'in-person',
      meetingLink: m.meeting_link,
      meetingPlatform: m.meeting_platform,
      locationAddress: m.location_address,
      externalId: m.external_id,
      recordingUrl: m.recording_url,
      reassignedFromUserId: m.reassigned_from_user_id,
      createdAt: m.created_at,
      updatedAt: m.updated_at
    }));

    res.json(result);
  } catch (error) {
    throw new AppError('Failed to fetch meetings', 500);
  }
});

// Get meetings for a specific host (public for booking)
router.get('/host/:hostId', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { hostId } = req.params;
    const { date } = req.query;

    let sql = `
      SELECT id, date, time, duration_minutes, status
      FROM meetings
      WHERE host_id = ? AND status IN ('pending', 'approved')
    `;
    const params: any[] = [hostId];

    if (date) {
      sql += ' AND date = ?';
      params.push(date);
    }

    sql += ' ORDER BY date ASC, time ASC';

    const meetings = db.connection.prepare(sql).all(...params) as any[];

    // Include external busy times from calendar sync
    const externalBusy = date ? getExternalBusyTimes(hostId, date as string) : [];

    res.json({
      meetings: meetings.map(m => ({
        id: m.id,
        date: m.date,
        time: m.time,
        durationMinutes: m.duration_minutes,
        status: m.status
      })),
      externalBusyTimes: externalBusy.map(b => ({
        start: b.start,
        end: b.end,
        source: 'external'
      }))
    });
  } catch (error) {
    throw new AppError('Failed to fetch host meetings', 500);
  }
});

// Get single meeting
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const meeting = db.connection.prepare(`
      SELECT m.*, u.name as host_name, u.avatar as host_avatar
      FROM meetings m
      LEFT JOIN users u ON m.host_id = u.id
      WHERE m.id = ?
    `).get(req.params.id) as any;

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    const callerId = req.user?.userId;
    const callerRole = req.user?.role;
    const isAuthorized = callerRole === 'admin' || meeting.host_id === callerId || meeting.user_id === callerId;
    if (!isAuthorized) {
      throw new AppError('Forbidden', 403);
    }

    res.json({
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
      time: meeting.time,
      durationMinutes: meeting.duration_minutes,
      attendeeName: meeting.attendee_name,
      attendeeEmail: meeting.attendee_email,
      additionalAttendees: meeting.additional_attendees,
      userId: meeting.user_id,
      hostId: meeting.host_id,
      hostName: meeting.host_name,
      hostAvatar: meeting.host_avatar,
      status: meeting.status,
      bookedBy: meeting.booked_by,
      notes: meeting.notes,
      category: meeting.category,
      meetingFormat: meeting.meeting_format || 'in-person',
      meetingLink: meeting.meeting_link,
      meetingPlatform: meeting.meeting_platform,
      locationAddress: meeting.location_address,
      externalId: meeting.external_id,
      recordingUrl: meeting.recording_url,
      reassignedFromUserId: meeting.reassigned_from_user_id,
      createdAt: meeting.created_at,
      updatedAt: meeting.updated_at
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch meeting', 500);
  }
});

// Create meeting (auth required — public booking goes through /api/booking-links/public/:slug/book)
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      title, date, time, durationMinutes, attendeeName, attendeeEmail,
      additionalAttendees, hostId, notes, category, meetingFormat, meetingLink, meetingPlatform,
      locationAddress, externalId,
    } = req.body;

    if (!title || !date || !time || !hostId || !attendeeName || !attendeeEmail) {
      throw new AppError('Missing required fields', 400);
    }

    // Validate meeting format
    const format = meetingFormat || 'in-person';
    if (!['online', 'in-person'].includes(format)) {
      throw new AppError('Invalid meeting format', 400);
    }

    // Validate locationAddress (only meaningful for in-person)
    let locationAddressClean: string | null = null;
    if (locationAddress !== undefined && locationAddress !== null && locationAddress !== '') {
      if (typeof locationAddress !== 'string' || locationAddress.length > 500) {
        throw new AppError('Invalid locationAddress', 400);
      }
      locationAddressClean = locationAddress;
    }
    if (externalId !== undefined && externalId !== null && externalId !== '') {
      if (typeof externalId !== 'string' || externalId.length > 200) {
        throw new AppError('Invalid externalId', 400);
      }
    }

    // ---- User-wide booking caps (weekly/monthly/yearly) ----
    enforceUserBookingCaps(hostId);

    // If online, meeting link is recommended (but we can use host's default)
    let finalMeetingLink = meetingLink;
    let finalMeetingPlatform = meetingPlatform;
    
    if (format === 'online' && !meetingLink) {
      // Try to get host's default meeting link
      const hostSettings = db.connection.prepare(`
        SELECT meeting_link, preferred_platform FROM user_meeting_settings WHERE user_id = ?
      `).get(hostId) as any;
      
      if (hostSettings) {
        finalMeetingLink = hostSettings.meeting_link;
        finalMeetingPlatform = hostSettings.preferred_platform;
      }
    }

    // Check for conflicts
    const existing = db.connection.prepare(`
      SELECT id FROM meetings
      WHERE host_id = ? AND date = ? AND time = ? AND status IN ('pending', 'approved')
    `).get(hostId, date, time);

    if (existing) {
      throw new AppError('Time slot is already booked', 409);
    }

    const meetingId = uuidv4();
    const userId = req.user?.userId || null;
    const bookedBy = req.user?.role || 'guest';

    // Auto-approve for managers/admins, pending for guests
    const status = ['admin', 'manager', 'subordinate'].includes(bookedBy) ? 'approved' : 'pending';

    // Native conferencing — create a Zoom/Teams meeting if configured for the
    // host's preferred platform. Fall back to the static link on any error.
    let zoomMeetingIdPersist: string | null = null;
    let teamsMeetingIdPersist: string | null = null;
    if (format === 'online' && finalMeetingPlatform) {
      const platform = String(finalMeetingPlatform).toLowerCase();
      const dur = Number(durationMinutes || 30);
      const startMs = new Date(`${date}T${time}:00`);
      try {
        if (platform === 'zoom') {
          const { isZoomConfigured, createZoomMeeting } = await import('../services/zoomMeetings');
          if (isZoomConfigured()) {
            const hostRow = db.connection.prepare(`SELECT email FROM users WHERE id = ?`).get(hostId) as any;
            const z = await createZoomMeeting({
              topic: title,
              startTimeISO: startMs.toISOString(),
              durationMinutes: dur,
              timezone: 'UTC',
              hostEmail: hostRow?.email || undefined,
            });
            finalMeetingLink = z.joinUrl;
            zoomMeetingIdPersist = z.id;
          }
        } else if (platform === 'teams') {
          const { isTeamsConfigured, createTeamsMeeting } = await import('../services/teamsMeetings');
          if (isTeamsConfigured()) {
            const endMs = new Date(startMs.getTime() + dur * 60_000);
            const t = await createTeamsMeeting({
              subject: title,
              startTimeISO: startMs.toISOString(),
              endTimeISO: endMs.toISOString(),
              hostUserId: hostId,
            });
            finalMeetingLink = t.joinUrl;
            teamsMeetingIdPersist = t.id;
          }
        } else if (platform === 'daily') {
          const { isDailyConfigured, createDailyRoom } = await import('../services/dailyVideo');
          if (isDailyConfigured(hostId)) {
            const room = await createDailyRoom({
              topic: title,
              durationMinutes: dur,
              forUserId: hostId,
            });
            finalMeetingLink = room.url;
          }
        }
      } catch (e) {
        console.error('Native conferencing creation failed (using static link):', e);
      }
    }

    db.connection.prepare(`
      INSERT INTO meetings (id, title, date, time, duration_minutes, attendee_name, attendee_email, additional_attendees, user_id, host_id, status, booked_by, notes, category, meeting_format, meeting_link, meeting_platform, zoom_meeting_id, teams_meeting_id, location_address, external_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      meetingId, title, date, time, durationMinutes || 30,
      attendeeName, attendeeEmail, additionalAttendees || null,
      userId, hostId, status, bookedBy, notes || null, category || 'general',
      format, finalMeetingLink || null, finalMeetingPlatform || null,
      zoomMeetingIdPersist, teamsMeetingIdPersist,
      format === 'in-person' ? locationAddressClean : null,
      typeof externalId === 'string' && externalId.length > 0 ? externalId : null,
    );

    // Log activity
    const formatLabel = format === 'online' ? '(Online)' : '(In-Person)';
    db.connection.prepare(`
      INSERT INTO activity_logs (id, action, details, performed_by, role)
      VALUES (?, 'BOOK', ?, ?, ?)
    `).run(uuidv4(), `Scheduled "${title}" ${formatLabel}`, attendeeName, bookedBy);

    // Sync to external calendars if meeting is auto-approved
    if (status === 'approved') {
      syncMeetingToCalendar(meetingId).catch(err => {
        console.error('Failed to sync meeting to calendar:', err);
      });
    }

    // Stats / XP / webhook / challenges hooks
    try { awardXp(hostId, 10, 'new booking'); } catch {}
    try { incrementBookingStat(hostId); } catch {}
    try {
      dispatchWebhook(hostId, 'booking.created', {
        meetingId, title, date, time,
        duration: durationMinutes || 30,
        attendeeName, attendeeEmail,
        source: 'internal',
      });
    } catch {}
    try { trackChallengeProgress(hostId, 'bookings_received', 1); } catch {}

    // Workflow dispatch — fire-and-forget.
    (async () => {
      try {
        const { dispatchTrigger, scheduleForMeeting } = await import('../services/workflowEngine');
        const host = db.connection.prepare(`SELECT id, name, email FROM users WHERE id = ?`).get(hostId) as any;
        const meeting = db.connection.prepare(`SELECT * FROM meetings WHERE id = ?`).get(meetingId);
        await dispatchTrigger('booking.created', {
          meeting,
          attendee: { name: attendeeName, email: attendeeEmail },
          host: host ? { id: host.id, name: host.name, email: host.email } : { id: hostId },
        });
        if (status === 'approved') {
          await scheduleForMeeting(meetingId);
        }
      } catch (e) { console.error('workflow dispatch failed:', e); }
    })();

    res.status(201).json({
      id: meetingId,
      title,
      date,
      time,
      durationMinutes: durationMinutes || 30,
      attendeeName,
      attendeeEmail,
      hostId,
      status,
      category: category || 'general',
      meetingFormat: format,
      meetingLink: finalMeetingLink,
      meetingPlatform: finalMeetingPlatform
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create meeting', 500);
  }
});

// Update meeting status
router.patch('/:id/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const meeting = db.connection.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as any;
    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    // Only host can approve/reject
    if (['approved', 'rejected'].includes(status) && meeting.host_id !== req.user!.userId && req.user!.role !== 'admin') {
      throw new AppError('Only the host can approve or reject', 403);
    }

    db.connection.prepare(`
      UPDATE meetings SET status = ?, updated_at = ? WHERE id = ?
    `).run(status, new Date().toISOString(), id);

    // Sync to external calendars
    if (status === 'approved') {
      syncMeetingToCalendar(id).catch(err => {
        console.error('Failed to sync meeting to calendar:', err);
      });
    } else if (status === 'cancelled' || status === 'rejected') {
      deleteSyncedEvent(id).catch(err => {
        console.error('Failed to delete synced event:', err);
      });
      // Best-effort cleanup of native conferencing meetings (Zoom/Teams).
      if (meeting.zoom_meeting_id) {
        (async () => {
          try {
            const { isZoomConfigured, deleteZoomMeeting } = await import('../services/zoomMeetings');
            if (isZoomConfigured()) await deleteZoomMeeting(meeting.zoom_meeting_id);
          } catch (e) { console.error('Zoom meeting delete failed:', e); }
        })();
      }
      if (meeting.teams_meeting_id) {
        (async () => {
          try {
            const { isTeamsConfigured, deleteTeamsMeeting } = await import('../services/teamsMeetings');
            if (isTeamsConfigured()) await deleteTeamsMeeting(meeting.teams_meeting_id, meeting.host_id);
          } catch (e) { console.error('Teams meeting delete failed:', e); }
        })();
      }
    }

    // Webhook + XP hooks for status changes
    const webhookBase = {
      meetingId: meeting.id, title: meeting.title,
      date: meeting.date, time: meeting.time,
      attendeeName: meeting.attendee_name, attendeeEmail: meeting.attendee_email,
    };
    try {
      if (status === 'approved') {
        dispatchWebhook(meeting.host_id, 'booking.approved', webhookBase);
        awardXp(meeting.host_id, 5, 'approved_booking');
      } else if (status === 'rejected') {
        dispatchWebhook(meeting.host_id, 'booking.rejected', webhookBase);
      } else if (status === 'cancelled') {
        dispatchWebhook(meeting.host_id, 'booking.cancelled', { ...webhookBase, cancelledBy: req.user?.username });
      }
    } catch {}

    // Workflow dispatch + schedule/unschedule.
    (async () => {
      try {
        const { dispatchTrigger, scheduleForMeeting } = await import('../services/workflowEngine');
        const host = db.connection.prepare(`SELECT id, name, email FROM users WHERE id = ?`).get(meeting.host_id) as any;
        const ctx = {
          meeting,
          attendee: { name: meeting.attendee_name, email: meeting.attendee_email },
          host: host ? { id: host.id, name: host.name, email: host.email } : { id: meeting.host_id },
        };
        if (status === 'approved') {
          await dispatchTrigger('booking.approved', ctx);
          await scheduleForMeeting(meeting.id);
        } else if (status === 'rejected') {
          await dispatchTrigger('booking.rejected', ctx);
          try {
            db.connection.prepare(
              `UPDATE workflow_executions SET status = 'cancelled' WHERE meeting_id = ? AND status = 'scheduled'`
            ).run(meeting.id);
          } catch {}
        } else if (status === 'cancelled') {
          await dispatchTrigger('booking.cancelled', ctx);
          try {
            db.connection.prepare(
              `UPDATE workflow_executions SET status = 'cancelled' WHERE meeting_id = ? AND status = 'scheduled'`
            ).run(meeting.id);
          } catch {}
        }
      } catch (e) { console.error('workflow dispatch failed:', e); }
    })();

    // Email notifications + in-app feed entries
    (async () => {
      try {
        const host = db.connection.prepare(`SELECT name, email FROM users WHERE id = ?`).get(meeting.host_id) as any;
        const base = {
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          date: meeting.date,
          time: meeting.time,
          durationMinutes: meeting.duration_minutes,
          attendeeName: meeting.attendee_name,
          attendeeEmail: meeting.attendee_email,
          hostName: host?.name ?? 'Your host',
          hostEmail: host?.email,
          meetingLink: meeting.meeting_link,
          notes: meeting.notes,
        };
        if (status === 'approved') {
          const { sendBookingApproved } = await import('../services/bookingEmails');
          await sendBookingApproved({ ...base, attendeeToken: meeting.attendee_token });
        } else if (status === 'cancelled' || status === 'rejected') {
          const { sendBookingCancelled } = await import('../services/bookingEmails');
          await sendBookingCancelled({ ...base, cancelledBy: req.user?.username });
        }
      } catch (e) {
        console.error('Failed to send booking-status email:', e);
      }
    })();

    // Log activity
    db.connection.prepare(`
      INSERT INTO activity_logs (id, action, details, performed_by, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), status.toUpperCase(), `Meeting ID ${id}`, req.user!.username, req.user!.role);

    res.json({ message: `Meeting ${status}` });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update meeting', 500);
  }
});

// Reschedule meeting
router.patch('/:id/reschedule', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { date, time } = req.body;

    if (!date || !time) {
      throw new AppError('Date and time required', 400);
    }

    const meeting = db.connection.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as any;
    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    // Check conflicts
    const existing = db.connection.prepare(`
      SELECT id FROM meetings
      WHERE host_id = ? AND date = ? AND time = ? AND status IN ('pending', 'approved') AND id != ?
    `).get(meeting.host_id, date, time, id);

    if (existing) {
      throw new AppError('Time slot is already booked', 409);
    }

    db.connection.prepare(`
      UPDATE meetings SET date = ?, time = ?, status = 'approved', updated_at = ? WHERE id = ?
    `).run(date, time, new Date().toISOString(), id);

    // Log activity
    db.connection.prepare(`
      INSERT INTO activity_logs (id, action, details, performed_by, role)
      VALUES (?, 'RESCHEDULE', ?, ?, ?)
    `).run(uuidv4(), `Rescheduled "${meeting.title}" to ${date} ${time}`, req.user!.username, req.user!.role);

    res.json({ message: 'Meeting rescheduled', date, time });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to reschedule meeting', 500);
  }
});

// Reassign a meeting to a different host (round-robin reassignment).
// Host, admin, or team-leader may reassign. The new host must be on the same team.
router.post('/:id/reassign', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newHostId, reason } = req.body || {};

    if (typeof newHostId !== 'string' || newHostId.length === 0) {
      throw new AppError('newHostId is required', 400);
    }
    if (reason !== undefined && reason !== null && (typeof reason !== 'string' || reason.length > 500)) {
      throw new AppError('Invalid reason', 400);
    }

    const meeting = db.connection.prepare(`
      SELECT m.*, u.team_id as host_team_id
      FROM meetings m
      LEFT JOIN users u ON u.id = m.host_id
      WHERE m.id = ?
    `).get(id) as any;
    if (!meeting) throw new AppError('Meeting not found', 404);

    const callerId = req.user!.userId;
    const callerRole = req.user!.role;

    // Authorization: host, admin, or team leader of the meeting host's team.
    let allowed = false;
    if (callerRole === 'admin') allowed = true;
    if (meeting.host_id === callerId) allowed = true;
    if (!allowed && meeting.host_team_id) {
      const team = db.connection.prepare(
        `SELECT leader_id FROM teams WHERE id = ?`
      ).get(meeting.host_team_id) as any;
      if (team && team.leader_id === callerId) allowed = true;
    }
    if (!allowed) throw new AppError('Forbidden', 403);

    // New host must exist and be on the same team as the prior host.
    const newHost = db.connection.prepare(
      `SELECT id, name, email, team_id FROM users WHERE id = ?`
    ).get(newHostId) as any;
    if (!newHost) throw new AppError('New host not found', 404);
    if (meeting.host_team_id && newHost.team_id !== meeting.host_team_id) {
      throw new AppError('New host must belong to the same team', 400);
    }

    const previousHostId = meeting.host_id;

    db.connection.prepare(`
      UPDATE meetings
      SET host_id = ?, reassigned_from_user_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newHostId, previousHostId, id);

    // Activity log
    db.connection.prepare(`
      INSERT INTO activity_logs (id, action, details, performed_by, role)
      VALUES (?, 'REASSIGN', ?, ?, ?)
    `).run(
      uuidv4(),
      `Reassigned "${meeting.title}" from ${previousHostId} to ${newHostId}${reason ? ` (${reason})` : ''}`,
      req.user!.username,
      req.user!.role
    );

    // Notify attendee (and new host) via email — best effort.
    (async () => {
      try {
        const { getEmailProvider } = await import('../services/emailProvider');
        const provider = getEmailProvider();
        const subject = `Your meeting host has changed: ${meeting.title}`;
        const html = `<!DOCTYPE html><html><body style="margin:0;padding:20px;background:#f5f5f5;font-family:-apple-system,'Segoe UI',sans-serif;">
          <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;">
            <div style="background:#129b82;color:white;padding:30px;text-align:center;"><h1 style="margin:0;font-size:22px;">Meeting reassigned</h1></div>
            <div style="padding:30px;color:#1a1a1a;">
              <p>Hi ${meeting.attendee_name || 'there'},</p>
              <p>Your meeting <strong>${meeting.title}</strong> on ${meeting.date} at ${meeting.time} has been reassigned to <strong>${newHost.name}</strong>.</p>
              ${reason ? `<p style="color:#666;">Reason: ${reason}</p>` : ''}
              <p style="color:#666;font-size:13px;">No action is required from you — the meeting time and link are unchanged.</p>
            </div>
          </div>
        </body></html>`;
        if (meeting.attendee_email) {
          await provider.send({
            to: meeting.attendee_email,
            subject,
            html,
            text: `Your meeting "${meeting.title}" on ${meeting.date} at ${meeting.time} has been reassigned to ${newHost.name}.`,
          });
        }
      } catch (e) {
        console.error('Failed to email reassignment notice:', e);
      }
    })();

    // Workflow dispatch: booking.reassigned
    (async () => {
      try {
        const { dispatchTrigger } = await import('../services/workflowEngine');
        await dispatchTrigger('booking.reassigned', {
          meeting,
          attendee: { name: meeting.attendee_name, email: meeting.attendee_email },
          host: { id: newHost.id, name: newHost.name, email: newHost.email },
          previousHostId,
          reason: reason || null,
        });
      } catch (e) { console.error('Reassign workflow dispatch failed:', e); }
    })();

    res.json({
      message: 'Meeting reassigned',
      newHostId,
      previousHostId,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to reassign meeting', 500);
  }
});

// Delete meeting
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const meeting = db.connection.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as any;
    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    // Only host, creator, or admin can delete
    if (meeting.host_id !== req.user!.userId && meeting.user_id !== req.user!.userId && req.user!.role !== 'admin') {
      throw new AppError('Unauthorized', 403);
    }

    db.connection.prepare('DELETE FROM meetings WHERE id = ?').run(id);

    res.json({ message: 'Meeting deleted' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete meeting', 500);
  }
});

export default router;
