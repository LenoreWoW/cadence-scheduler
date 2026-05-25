/**
 * Team booking links — Calendly-style URLs that route incoming bookings
 * through the team's round-robin rotation.
 *
 * Public surface: /book/team/:slug (frontend) → /api/team-booking-links/public/:slug
 * Authed surface: managers/admins of the team can create/update/delete links.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { awardXp, incrementBookingStat } from '../services/userStatsSync';
import { dispatchWebhook } from '../services/outboundWebhooks';
import { trackChallengeProgress } from './challenges';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

const publicBookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}:${req.params.slug}`,
  message: { error: 'Too many booking attempts. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function generateSlug(base: string, existing: string[]): string {
  const clean = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'team';
  let slug = clean;
  let i = 2;
  while (existing.includes(slug)) {
    slug = `${clean}-${i++}`;
  }
  return slug;
}

function canManageTeam(userId: string, teamId: string, role: string): boolean {
  if (role === 'admin') return true;
  const team = db.connection.prepare(`SELECT leader_id FROM teams WHERE id = ?`).get(teamId) as any;
  return team && team.leader_id === userId;
}

// ---- CRUD (auth) ----

router.get('/my', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const role = req.user!.role;
  const isAdmin = role === 'admin';

  // Teams the user can manage
  const teams = isAdmin
    ? db.connection.prepare(`SELECT id FROM teams`).all() as any[]
    : db.connection.prepare(`SELECT id FROM teams WHERE leader_id = ?`).all(userId) as any[];
  if (teams.length === 0) return res.json([]);

  const placeholders = teams.map(() => '?').join(',');
  const links = db.connection.prepare(
    `SELECT tbl.*, t.name as team_name, t.color as team_color
     FROM team_booking_links tbl
     JOIN teams t ON tbl.team_id = t.id
     WHERE tbl.team_id IN (${placeholders})
     ORDER BY tbl.created_at DESC`
  ).all(...teams.map(t => t.id)) as any[];

  res.json(links.map(l => ({
    id: l.id,
    teamId: l.team_id,
    teamName: l.team_name,
    teamColor: l.team_color,
    slug: l.slug,
    token: l.token,
    title: l.title,
    description: l.description,
    durationOptions: JSON.parse(l.duration_options || '[30]'),
    defaultDuration: l.default_duration,
    isActive: !!l.is_active,
    expiresAt: l.expires_at,
    maxBookingsPerDay: l.max_bookings_per_day,
    customMessage: l.custom_message,
    viewCount: l.view_count || 0,
    createdAt: l.created_at,
  })));
});

router.post('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { teamId, title, description, durationOptions, defaultDuration, maxBookingsPerDay, customMessage, expiresAt } = req.body ?? {};

  if (typeof teamId !== 'string') throw new AppError('teamId is required', 400);

  if (!canManageTeam(req.user!.userId, teamId, req.user!.role)) {
    throw new AppError('You can only create booking links for teams you lead', 403);
  }

  const team = db.connection.prepare(`SELECT name FROM teams WHERE id = ?`).get(teamId) as any;
  if (!team) throw new AppError('Team not found', 404);

  const slugList = (db.connection.prepare(`SELECT slug FROM team_booking_links`).all() as any[]).map(r => r.slug);
  const slug = generateSlug(team.name, slugList);
  const linkId = uuidv4();
  const token = uuidv4().replace(/-/g, '').substring(0, 16);

  db.connection.prepare(`
    INSERT INTO team_booking_links (id, team_id, slug, token, title, description, duration_options, default_duration, max_bookings_per_day, custom_message, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    linkId, teamId, slug, token,
    title || `Book a meeting with ${team.name}`,
    description ?? null,
    JSON.stringify(durationOptions || [15, 30, 45, 60]),
    defaultDuration || 30,
    maxBookingsPerDay ?? null,
    customMessage ?? null,
    expiresAt ?? null
  );

  res.status(201).json({ id: linkId, teamId, slug, token, title: title || `Book a meeting with ${team.name}` });
});

router.put('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const existing = db.connection.prepare(`SELECT * FROM team_booking_links WHERE id = ?`).get(req.params.id) as any;
  if (!existing) throw new AppError('Booking link not found', 404);
  if (!canManageTeam(req.user!.userId, existing.team_id, req.user!.role)) {
    throw new AppError('You can only update booking links for teams you lead', 403);
  }

  const { title, description, durationOptions, defaultDuration, isActive, maxBookingsPerDay, customMessage, expiresAt } = req.body ?? {};

  db.connection.prepare(`
    UPDATE team_booking_links SET
      title = COALESCE(?, title),
      description = ?,
      duration_options = COALESCE(?, duration_options),
      default_duration = COALESCE(?, default_duration),
      is_active = COALESCE(?, is_active),
      max_bookings_per_day = ?,
      custom_message = ?,
      expires_at = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title || null,
    description !== undefined ? description : existing.description,
    durationOptions ? JSON.stringify(durationOptions) : null,
    defaultDuration || null,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    maxBookingsPerDay !== undefined ? maxBookingsPerDay : existing.max_bookings_per_day,
    customMessage !== undefined ? customMessage : existing.custom_message,
    expiresAt !== undefined ? expiresAt : existing.expires_at,
    req.params.id
  );

  res.json({ success: true });
});

router.delete('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const existing = db.connection.prepare(`SELECT team_id FROM team_booking_links WHERE id = ?`).get(req.params.id) as any;
  if (!existing) throw new AppError('Booking link not found', 404);
  if (!canManageTeam(req.user!.userId, existing.team_id, req.user!.role)) {
    throw new AppError('You can only delete booking links for teams you lead', 403);
  }
  db.connection.prepare(`DELETE FROM team_booking_links WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

// ---- Public ----

router.get('/public/:slug', asyncHandler(async (req: Request, res: Response) => {
  const link = db.connection.prepare(`
    SELECT tbl.*, t.name as team_name, t.color as team_color, t.image as team_image
    FROM team_booking_links tbl
    JOIN teams t ON tbl.team_id = t.id
    WHERE tbl.slug = ? AND tbl.is_active = 1
  `).get(req.params.slug) as any;

  if (!link) throw new AppError('Booking link not found or inactive', 404);
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    throw new AppError('This booking link has expired', 410);
  }

  try {
    db.connection.prepare(`UPDATE team_booking_links SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?`).run(link.id);
  } catch {}

  res.json({
    id: link.id,
    slug: link.slug,
    title: link.title,
    description: link.description,
    durationOptions: JSON.parse(link.duration_options || '[30]'),
    defaultDuration: link.default_duration,
    customMessage: link.custom_message,
    team: {
      id: link.team_id,
      name: link.team_name,
      color: link.team_color,
      image: link.team_image,
    },
  });
}));

router.get('/public/:slug/slots', asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.query;
  if (!date) throw new AppError('Date is required', 400);

  const link = db.connection.prepare(`
    SELECT tbl.*, t.id as team_id
    FROM team_booking_links tbl
    JOIN teams t ON tbl.team_id = t.id
    WHERE tbl.slug = ? AND tbl.is_active = 1
  `).get(req.params.slug) as any;

  if (!link) throw new AppError('Booking link not found', 404);

  // For the team page we surface the union of working-hour slots across all
  // team members, minus slots where NO member is free. The actual member
  // assignment happens at booking time via round-robin.
  const members = db.connection.prepare(`
    SELECT u.id, ua.start_hour, ua.end_hour, ua.slot_duration, ua.buffer_minutes,
           ua.min_notice_minutes, ua.working_days, ua.time_off
    FROM users u
    LEFT JOIN user_availability ua ON ua.user_id = u.id
    WHERE u.team_id = ?
      AND u.role IN ('admin','manager','subordinate')
  `).all(link.team_id) as any[];

  if (members.length === 0) {
    return res.json({ slots: [] });
  }

  const requestedDate = new Date(`${date}T00:00:00`);
  const dayOfWeek = requestedDate.getDay();

  const slots: any[] = [];
  // Use a 30-minute baseline grid; per-member checks honor their own slot_duration via overlap math.
  const SLOT_STEP = 30;
  const now = new Date();

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_STEP) {
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const slotDate = new Date(`${date}T${timeStr}:00`);

      // Find at least one available member
      const anyFree = members.some((m: any) => {
        const days = JSON.parse(m.working_days || '[0,1,2,3,4]');
        if (!days.includes(dayOfWeek)) return false;
        const sh = m.start_hour ?? 9;
        const eh = m.end_hour ?? 17;
        if (hour < sh || hour >= eh) return false;

        const minNotice = m.min_notice_minutes ?? 120;
        if (slotDate <= new Date(now.getTime() + minNotice * 60_000)) return false;

        const buffer = m.buffer_minutes ?? 0;
        const reqStart = hour * 60 + minute - buffer;
        const reqEnd = hour * 60 + minute + (link.default_duration || 30) + buffer;

        const conflicts = db.connection.prepare(`
          SELECT time, duration_minutes FROM meetings
          WHERE host_id = ? AND date = ? AND status IN ('pending','approved')
        `).all(m.id, date) as any[];
        const conflict = conflicts.some((c: any) => {
          const [cH, cM] = c.time.split(':').map(Number);
          const cs = cH * 60 + cM - buffer;
          const ce = cH * 60 + cM + c.duration_minutes + buffer;
          return reqStart < ce && reqEnd > cs;
        });
        return !conflict;
      });

      if (anyFree) {
        slots.push({ time: timeStr, label: timeStr, available: true });
      }
    }
  }

  res.json({ slots });
}));

router.post('/public/:slug/book', publicBookingLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { date, time, duration, title, attendeeName, attendeeEmail, notes, meetingFormat, routingSubmissionId } = req.body ?? {};

  if (!date || !time || !attendeeName || !attendeeEmail) {
    throw new AppError('Missing required fields', 400);
  }
  if (typeof attendeeName !== 'string' || attendeeName.length < 1 || attendeeName.length > 100) {
    throw new AppError('Invalid attendee name', 400);
  }
  if (typeof attendeeEmail !== 'string' || !EMAIL_RE.test(attendeeEmail) || attendeeEmail.length > 254) {
    throw new AppError('Invalid attendee email', 400);
  }
  if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 2000)) {
    throw new AppError('Notes too long', 400);
  }

  const link = db.connection.prepare(`
    SELECT * FROM team_booking_links WHERE slug = ? AND is_active = 1
  `).get(req.params.slug) as any;

  if (!link) throw new AppError('Booking link not found or inactive', 404);
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    throw new AppError('This booking link has expired', 410);
  }

  const bookingDuration = duration || link.default_duration || 30;
  const durationOptions = JSON.parse(link.duration_options || '[30]');
  if (!durationOptions.includes(bookingDuration)) {
    throw new AppError('Invalid duration selected', 400);
  }

  // Delegate to the round-robin endpoint internally — we call its core logic
  // here by replicating the assignment loop. Simpler to inline than route-call.
  const state = db.connection.prepare(`SELECT * FROM round_robin_state WHERE team_id = ?`).get(link.team_id) as any;
  if (!state) {
    throw new AppError('This team has no round-robin rotation set up', 404);
  }
  const rotationOrder: string[] = JSON.parse(state.rotation_order || '[]');
  if (rotationOrder.length === 0) {
    throw new AppError('No team members available for booking', 400);
  }

  let assignedMember: any = null;
  const lastIndex = state.last_assigned_user_id ? rotationOrder.indexOf(state.last_assigned_user_id) : -1;
  const meetingDate = new Date(`${date}T00:00:00`);
  const dayOfWeek = meetingDate.getDay();
  const [reqH, reqM] = (time as string).split(':').map(Number);

  let getExternalBusyTimes: any = null;
  try {
    const cs = await import('../services/calendarSync');
    getExternalBusyTimes = cs.getExternalBusyTimes;
  } catch {}

  for (let i = 0; i < rotationOrder.length; i++) {
    const nextIndex = (lastIndex + 1 + i) % rotationOrder.length;
    const candidateId = rotationOrder[nextIndex];
    const candidate = db.connection.prepare(`
      SELECT u.*, ua.start_hour, ua.end_hour, ua.buffer_minutes, ua.min_notice_minutes, ua.working_days, ua.time_off
      FROM users u
      LEFT JOIN user_availability ua ON ua.user_id = u.id
      WHERE u.id = ?
    `).get(candidateId) as any;
    if (!candidate) continue;

    const workingDays = JSON.parse(candidate.working_days || '[0,1,2,3,4]');
    if (!workingDays.includes(dayOfWeek)) continue;
    const timeOff = JSON.parse(candidate.time_off || '[]');
    const isTimeOff = timeOff.some((off: any) =>
      typeof off === 'string' ? off === date : (date >= off.start && date <= off.end)
    );
    if (isTimeOff) continue;

    const sh = candidate.start_hour ?? 9;
    const eh = candidate.end_hour ?? 17;
    if (reqH < sh || reqH >= eh) continue;

    const minNotice = candidate.min_notice_minutes ?? 120;
    const slotStart = new Date(`${date}T${time}:00`);
    if (slotStart <= new Date(Date.now() + minNotice * 60_000)) continue;

    const buffer = candidate.buffer_minutes ?? 0;
    const reqStartMin = reqH * 60 + reqM - buffer;
    const reqEndMin = reqH * 60 + reqM + bookingDuration + buffer;
    const sameDay = db.connection.prepare(`
      SELECT time, duration_minutes FROM meetings
      WHERE host_id = ? AND date = ? AND status IN ('pending','approved')
    `).all(candidateId, date) as any[];
    const conflict = sameDay.some((m: any) => {
      const [mH, mM] = m.time.split(':').map(Number);
      const mStart = mH * 60 + mM - buffer;
      const mEnd = mH * 60 + mM + m.duration_minutes + buffer;
      return reqStartMin < mEnd && reqEndMin > mStart;
    });
    if (conflict) continue;

    if (getExternalBusyTimes) {
      try {
        const busy = getExternalBusyTimes(candidateId, date);
        const slotStartMs = slotStart.getTime();
        const slotEndMs = slotStartMs + bookingDuration * 60_000;
        const externalConflict = busy.some((b: any) => {
          const bs = new Date(b.start).getTime();
          const be = new Date(b.end).getTime();
          return slotStartMs < be && slotEndMs > bs;
        });
        if (externalConflict) continue;
      } catch {}
    }

    assignedMember = candidate;
    db.connection.prepare(`UPDATE round_robin_state SET last_assigned_user_id = ?, updated_at = datetime('now') WHERE team_id = ?`).run(candidateId, link.team_id);
    break;
  }

  if (!assignedMember) {
    throw new AppError('No team members available at the requested time', 409);
  }

  const meetingId = uuidv4();
  const attendeeToken = uuidv4();
  const meetingTitle = title || `Meeting with ${attendeeName}`;

  // Native conferencing — look up assigned member's preferred platform and try
  // to create a real Zoom/Teams meeting. Falls back to the host's static link.
  const format = meetingFormat || 'in-person';
  let finalMeetingLink: string | null = null;
  let finalPlatform: string | null = null;
  let zoomMeetingIdPersist: string | null = null;
  let teamsMeetingIdPersist: string | null = null;
  if (format === 'online') {
    const memberSettings = db.connection.prepare(
      `SELECT meeting_link, preferred_platform FROM user_meeting_settings WHERE user_id = ?`
    ).get(assignedMember.id) as any;
    if (memberSettings) {
      finalMeetingLink = memberSettings.meeting_link || null;
      finalPlatform = memberSettings.preferred_platform || null;
    }
    const platform = String(finalPlatform || '').toLowerCase();
    const startMs = new Date(`${date}T${time}:00`);
    try {
      if (platform === 'zoom') {
        const { isZoomConfigured, createZoomMeeting } = await import('../services/zoomMeetings');
        if (isZoomConfigured()) {
          const z = await createZoomMeeting({
            topic: meetingTitle,
            startTimeISO: startMs.toISOString(),
            durationMinutes: bookingDuration,
            timezone: 'UTC',
            hostEmail: assignedMember.email || undefined,
          });
          finalMeetingLink = z.joinUrl;
          zoomMeetingIdPersist = z.id;
        }
      } else if (platform === 'teams') {
        const { isTeamsConfigured, createTeamsMeeting } = await import('../services/teamsMeetings');
        if (isTeamsConfigured()) {
          const endMs = new Date(startMs.getTime() + bookingDuration * 60_000);
          const t = await createTeamsMeeting({
            subject: meetingTitle,
            startTimeISO: startMs.toISOString(),
            endTimeISO: endMs.toISOString(),
            hostUserId: assignedMember.id,
          });
          finalMeetingLink = t.joinUrl;
          teamsMeetingIdPersist = t.id;
        }
      }
    } catch (e) {
      console.error('Native conferencing failed for team booking:', e);
    }
  }

  db.connection.prepare(`
    INSERT INTO meetings (id, title, date, time, duration_minutes, attendee_name, attendee_email, host_id, status, booked_by, notes, category, meeting_format, meeting_link, meeting_platform, attendee_token, zoom_meeting_id, teams_meeting_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'team-round-robin', ?, 'general', ?, ?, ?, ?, ?, ?)
  `).run(
    meetingId, meetingTitle, date, time, bookingDuration,
    attendeeName, attendeeEmail, assignedMember.id, notes || null,
    format, finalMeetingLink, finalPlatform, attendeeToken,
    zoomMeetingIdPersist, teamsMeetingIdPersist
  );

  try {
    db.connection.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, link)
      VALUES (?, ?, 'booking.request', ?, ?, ?)
    `).run(
      uuidv4(),
      assignedMember.id,
      `New team booking: ${meetingTitle}`,
      `${attendeeName} requested ${date} at ${time} via team link`,
      `/?view=my-meetings`
    );
  } catch {}

  // Stats / XP / webhook / challenges hooks
  try { awardXp(assignedMember.id, 10, 'team booking'); } catch {}
  try { incrementBookingStat(assignedMember.id); } catch {}
  try {
    dispatchWebhook(assignedMember.id, 'booking.created', {
      meetingId, title: meetingTitle, date, time, duration: bookingDuration,
      attendeeName, attendeeEmail, source: 'team_booking_link', slug: req.params.slug,
    });
  } catch {}
  try { trackChallengeProgress(assignedMember.id, 'bookings_received', 1); } catch {}

  // Stitch routing-form submission, if any, to the new meeting.
  if (typeof routingSubmissionId === 'string' && routingSubmissionId.length > 0) {
    try {
      db.connection.prepare(`UPDATE meetings SET routing_submission_id = ? WHERE id = ?`).run(routingSubmissionId, meetingId);
      db.connection.prepare(`
        UPDATE routing_form_submissions SET meeting_id = ?, attendee_email = ? WHERE id = ?
      `).run(meetingId, attendeeEmail, routingSubmissionId);
    } catch (e) {
      console.error('Failed to attach routing submission to team meeting:', e);
    }
  }

  // Workflow dispatch — fire-and-forget.
  (async () => {
    try {
      const { dispatchTrigger, scheduleForMeeting } = await import('../services/workflowEngine');
      await dispatchTrigger('booking.created', {
        meeting: db.connection.prepare(`SELECT * FROM meetings WHERE id = ?`).get(meetingId),
        attendee: { name: attendeeName, email: attendeeEmail },
        host: { id: assignedMember.id, name: assignedMember.name, email: assignedMember.email },
        link: { slug: req.params.slug, teamId: link.team_id },
      });
      await scheduleForMeeting(meetingId);
    } catch (e) { console.error('workflow dispatch failed:', e); }
  })();

  // Fire-and-forget emails
  (async () => {
    try {
      const { sendBookingConfirmation, sendBookingHostNotification } = await import('../services/bookingEmails');
      await sendBookingConfirmation({
        meetingId, attendeeToken, meetingTitle, date, time,
        durationMinutes: bookingDuration, attendeeName, attendeeEmail,
        hostName: assignedMember.name, hostEmail: assignedMember.email, notes,
        meetingLink: finalMeetingLink || undefined,
      });
      if (assignedMember.email) {
        await sendBookingHostNotification({
          meetingId, meetingTitle, date, time,
          durationMinutes: bookingDuration, attendeeName, attendeeEmail,
          hostName: assignedMember.name, hostEmail: assignedMember.email, notes,
          meetingLink: finalMeetingLink || undefined,
        });
      }
    } catch (e) {
      console.error('Failed to send team-booking emails:', e);
    }
  })();

  res.status(201).json({
    id: meetingId,
    title: meetingTitle,
    date, time,
    durationMinutes: bookingDuration,
    attendeeName, attendeeEmail,
    assignedTo: { id: assignedMember.id, name: assignedMember.name },
    status: 'pending',
    attendeeToken,
  });
}));

export default router;
