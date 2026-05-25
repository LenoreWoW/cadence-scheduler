/**
 * Booking Links Routes - Calendly-style public booking
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
import { getActiveOOO } from './ooo';
import { isBlocked } from './blocklist';

// Public booking endpoint is unauthenticated by design — apply per-IP-per-slug throttling.
const publicBookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}:${req.params.slug}`,
  message: { error: 'Too many booking attempts. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const router = Router();

// Helper to wrap async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Helper to generate a URL-safe slug from name
function generateSlug(name: string, existingSlugs: string[]): string {
  let baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  if (!baseSlug) baseSlug = 'booking';
  
  let slug = baseSlug;
  let counter = 1;
  
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

// ---- Cal.com-parity helpers used by the public booking flow ----

interface LinkFreqRow {
  max_per_attendee_count: number | null;
  max_per_attendee_period: string | null;
  max_total_minutes: number | null;
  total_minutes_period: string | null;
}

function periodStartDate(period: string | null | undefined): string {
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
  // default 'day'
  return now.toISOString().slice(0, 10);
}

function enforceFrequencyLimits(linkRow: LinkFreqRow, hostId: string, attendeeEmail: string, bookingDurationMinutes: number) {
  if (linkRow.max_per_attendee_count && linkRow.max_per_attendee_count > 0) {
    const from = periodStartDate(linkRow.max_per_attendee_period);
    const row = db.connection.prepare(`
      SELECT COUNT(*) as c FROM meetings
      WHERE host_id = ? AND attendee_email = ? AND date >= ? AND status IN ('pending','approved')
    `).get(hostId, attendeeEmail, from) as any;
    if ((row?.c || 0) >= linkRow.max_per_attendee_count) {
      throw new AppError('Booking frequency limit reached for this attendee', 429);
    }
  }
  if (linkRow.max_total_minutes && linkRow.max_total_minutes > 0) {
    const from = periodStartDate(linkRow.total_minutes_period);
    const row = db.connection.prepare(`
      SELECT COALESCE(SUM(duration_minutes), 0) as total
      FROM meetings
      WHERE host_id = ? AND date >= ? AND status IN ('pending','approved')
    `).get(hostId, from) as any;
    const used = Number(row?.total || 0);
    if (used + bookingDurationMinutes > linkRow.max_total_minutes) {
      throw new AppError('Total booking duration limit reached for this period', 429);
    }
  }
}

function getRestrictionForLink(linkId: string): { daysOfWeek: number[]; startHour: number; endHour: number } | null {
  const row = db.connection.prepare(`
    SELECT days_of_week, start_hour, end_hour FROM restriction_schedules WHERE booking_link_id = ?
  `).get(linkId) as any;
  if (!row) return null;
  try {
    return {
      daysOfWeek: JSON.parse(row.days_of_week || '[]'),
      startHour: row.start_hour,
      endHour: row.end_hour,
    };
  } catch {
    return null;
  }
}

function getDateOverride(userId: string, dateYYYYMMDD: string): { startHour: number | null; endHour: number | null; available: boolean } | null {
  const row = db.connection.prepare(`
    SELECT start_hour, end_hour, available FROM date_overrides WHERE user_id = ? AND date = ?
  `).get(userId, dateYYYYMMDD) as any;
  if (!row) return null;
  return {
    startHour: row.start_hour,
    endHour: row.end_hour,
    available: !!row.available,
  };
}

function getCommonSchedule(scheduleId: string | null | undefined): any | null {
  if (!scheduleId) return null;
  const row = db.connection.prepare(`SELECT availability FROM common_schedules WHERE id = ?`).get(scheduleId) as any;
  if (!row?.availability) return null;
  try { return JSON.parse(row.availability); } catch { return null; }
}

// Get all booking links for authenticated user
router.get('/my-links', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const links = db.connection.prepare(`
      SELECT bl.*,
        (SELECT COUNT(*) FROM meetings m WHERE m.booked_by = 'guest' AND m.host_id = bl.user_id) as total_bookings
      FROM booking_links bl
      WHERE bl.user_id = ?
      ORDER BY bl.created_at DESC
    `).all(req.user!.userId) as any[];

    const result = links.map(link => {
      const views = link.view_count || 0;
      const bookings = link.total_bookings || 0;
      return {
        id: link.id,
        slug: link.slug,
        token: link.token,
        title: link.title,
        description: link.description,
        durationOptions: JSON.parse(link.duration_options || '[30]'),
        defaultDuration: link.default_duration,
        isActive: !!link.is_active,
        expiresAt: link.expires_at,
        maxBookingsPerDay: link.max_bookings_per_day,
        bufferBefore: link.buffer_before,
        bufferAfter: link.buffer_after,
        customMessage: link.custom_message,
        questions: JSON.parse(link.questions || '[]'),
        viewCount: views,
        // Conversion is approximate — total guest bookings on this host vs link views.
        // Until we tag bookings with which link they came from, this is the best estimator.
        conversionRate: views > 0 ? Math.round((bookings / views) * 100) : null,
        createdAt: link.created_at,
        updatedAt: link.updated_at
      };
    });

    res.json(result);
  } catch (error) {
    throw new AppError('Failed to fetch booking links', 500);
  }
});

// Create a new booking link
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      title, description, durationOptions, defaultDuration, 
      maxBookingsPerDay, bufferBefore, bufferAfter, customMessage, expiresAt 
    } = req.body;

    // Get user info for slug generation
    const user = db.connection.prepare('SELECT name FROM users WHERE id = ?').get(req.user!.userId) as any;
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Get existing slugs
    const existingSlugs = db.connection.prepare('SELECT slug FROM booking_links').all() as any[];
    const slugList = existingSlugs.map(s => s.slug);

    const linkId = uuidv4();
    const slug = generateSlug(user.name, slugList);
    const token = uuidv4().replace(/-/g, '').substring(0, 16);

    db.connection.prepare(`
      INSERT INTO booking_links (
        id, user_id, slug, token, title, description, duration_options, 
        default_duration, max_bookings_per_day, buffer_before, buffer_after, 
        custom_message, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      linkId,
      req.user!.userId,
      slug,
      token,
      title || 'Book a Meeting',
      description || null,
      JSON.stringify(durationOptions || [15, 30, 45, 60]),
      defaultDuration || 30,
      maxBookingsPerDay || null,
      bufferBefore || 0,
      bufferAfter || 0,
      customMessage || null,
      expiresAt || null
    );

    res.status(201).json({
      id: linkId,
      slug,
      token,
      title: title || 'Book a Meeting',
      description,
      durationOptions: durationOptions || [15, 30, 45, 60],
      defaultDuration: defaultDuration || 30,
      isActive: true,
      maxBookingsPerDay,
      bufferBefore: bufferBefore || 0,
      bufferAfter: bufferAfter || 0,
      customMessage,
      expiresAt
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create booking link', 500);
  }
});

// Update a booking link
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      slug, title, description, durationOptions, defaultDuration,
      isActive, maxBookingsPerDay, bufferBefore, bufferAfter, customMessage, expiresAt,
      questions
    } = req.body;

    // Verify ownership
    const existing = db.connection.prepare(
      'SELECT * FROM booking_links WHERE id = ? AND user_id = ?'
    ).get(id, req.user!.userId) as any;

    if (!existing) {
      throw new AppError('Booking link not found', 404);
    }

    // Check slug uniqueness if changing
    if (slug && slug !== existing.slug) {
      const slugExists = db.connection.prepare(
        'SELECT id FROM booking_links WHERE slug = ? AND id != ?'
      ).get(slug, id);
      if (slugExists) {
        throw new AppError('Slug already in use', 409);
      }
    }

    // Validate questions shape if provided
    let questionsJson: string | null = null;
    if (questions !== undefined) {
      if (!Array.isArray(questions) || questions.length > 20) {
        throw new AppError('questions must be an array of up to 20 items', 400);
      }
      for (const q of questions) {
        if (!q || typeof q !== 'object') throw new AppError('Invalid question', 400);
        if (typeof q.label !== 'string' || q.label.length === 0 || q.label.length > 200) {
          throw new AppError('Question label must be 1-200 characters', 400);
        }
        if (q.type && !['text', 'textarea', 'select', 'checkbox'].includes(q.type)) {
          throw new AppError(`Invalid question type: ${q.type}`, 400);
        }
        if (q.options !== undefined && (!Array.isArray(q.options) || q.options.length > 20)) {
          throw new AppError('Question options must be an array of up to 20 items', 400);
        }
      }
      questionsJson = JSON.stringify(questions);
    }

    db.connection.prepare(`
      UPDATE booking_links SET
        slug = COALESCE(?, slug),
        title = COALESCE(?, title),
        description = ?,
        duration_options = COALESCE(?, duration_options),
        default_duration = COALESCE(?, default_duration),
        is_active = COALESCE(?, is_active),
        max_bookings_per_day = ?,
        buffer_before = COALESCE(?, buffer_before),
        buffer_after = COALESCE(?, buffer_after),
        custom_message = ?,
        expires_at = ?,
        questions = COALESCE(?, questions),
        updated_at = ?
      WHERE id = ?
    `).run(
      slug || null,
      title || null,
      description !== undefined ? description : existing.description,
      durationOptions ? JSON.stringify(durationOptions) : null,
      defaultDuration || null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      maxBookingsPerDay !== undefined ? maxBookingsPerDay : existing.max_bookings_per_day,
      bufferBefore || null,
      bufferAfter || null,
      customMessage !== undefined ? customMessage : existing.custom_message,
      expiresAt !== undefined ? expiresAt : existing.expires_at,
      questionsJson,
      new Date().toISOString(),
      id
    );

    res.json({ message: 'Booking link updated' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update booking link', 500);
  }
});

// Delete a booking link
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = db.connection.prepare(
      'DELETE FROM booking_links WHERE id = ? AND user_id = ?'
    ).run(id, req.user!.userId);

    if (result.changes === 0) {
      throw new AppError('Booking link not found', 404);
    }

    res.json({ message: 'Booking link deleted' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete booking link', 500);
  }
});

// ============ PUBLIC ENDPOINTS (No Auth Required) ============

// Get public booking page data by slug
router.get('/public/:slug', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const link = db.connection.prepare(`
      SELECT bl.*, u.id as host_id, u.name as host_name, u.title as host_title, 
             u.avatar as host_avatar, u.email as host_email,
             ua.start_hour, ua.end_hour, ua.slot_duration, ua.buffer_minutes, 
             ua.min_notice_minutes, ua.working_days, ua.time_off,
             t.name as team_name, t.color as team_color
      FROM booking_links bl
      JOIN users u ON bl.user_id = u.id
      LEFT JOIN user_availability ua ON u.id = ua.user_id
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE bl.slug = ? AND bl.is_active = 1
    `).get(slug) as any;

    if (!link) {
      return res.status(404).json({ error: 'Booking link not found or inactive' });
    }

    // Check expiration
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This booking link has expired' });
    }

    // Bump view count — fire-and-forget, never block the page load.
    try {
      db.connection.prepare(`UPDATE booking_links SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?`).run(link.id);
    } catch (e) {
      // view_count column may not exist on very old DBs; safe to ignore.
    }

    // Analytics pixels + restriction schedule loaded separately to keep the
    // main query lean.
    let pixels: any[] = [];
    try {
      pixels = db.connection.prepare(
        `SELECT provider, tracking_id FROM analytics_pixels WHERE booking_link_id = ? AND is_active = 1`
      ).all(link.id) as any[];
    } catch {}
    const restriction = getRestrictionForLink(link.id);

    // If the host has an active OOO row with a delegate, surface that on the
    // public page so the UI can show "you're being booked with X instead".
    let oooNotice: { delegateName: string | null; closed: boolean } | null = null;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const active = getActiveOOO(link.host_id, today);
      if (active) {
        oooNotice = {
          delegateName: active.delegate?.name ?? null,
          closed: !active.delegate,
        };
      }
    } catch {}

    res.json({
      id: link.id,
      slug: link.slug,
      title: link.title,
      description: link.description,
      durationOptions: JSON.parse(link.duration_options || '[30]'),
      defaultDuration: link.default_duration,
      customMessage: link.custom_message,
      questions: JSON.parse(link.questions || '[]'),
      host: {
        id: link.host_id,
        name: link.host_name,
        title: link.host_title,
        avatar: link.host_avatar,
        // Hide host email if the link configures it.
        email: link.hide_organizer_email ? null : link.host_email,
        team: link.team_name ? { name: link.team_name, color: link.team_color } : null,
        availability: link.start_hour !== null ? {
          startHour: link.start_hour,
          endHour: link.end_hour,
          slotDuration: link.slot_duration,
          bufferMinutes: link.buffer_minutes,
          minNoticeMinutes: link.min_notice_minutes,
          days: JSON.parse(link.working_days || '[]'),
          timeOff: JSON.parse(link.time_off || '[]')
        } : null
      },
      bufferBefore: link.buffer_before,
      bufferAfter: link.buffer_after,
      brandLogoUrl: link.brand_logo_url || null,
      brandColor: link.brand_color || null,
      brandFont: link.brand_font || null,
      restrictionSchedule: restriction,
      analyticsPixels: pixels.map((p: any) => ({ provider: p.provider, trackingId: p.tracking_id })),
      oooNotice,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch booking page', 500);
  }
}));

// Get available slots for a date (public)
router.get('/public/:slug/slots', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { date } = req.query;

    if (!date) {
      throw new AppError('Date is required', 400);
    }

    const link = db.connection.prepare(`
      SELECT bl.*, u.id as host_id,
             ua.start_hour, ua.end_hour, ua.slot_duration, ua.buffer_minutes,
             ua.min_notice_minutes, ua.working_days, ua.time_off
      FROM booking_links bl
      JOIN users u ON bl.user_id = u.id
      LEFT JOIN user_availability ua ON u.id = ua.user_id
      WHERE bl.slug = ? AND bl.is_active = 1
    `).get(slug) as any;

    if (!link) {
      throw new AppError('Booking link not found', 404);
    }

    // Bookable-window check — refuse dates further out than the link allows.
    if (link.bookable_window_days) {
      const reqDateOnly = new Date(`${date as string}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((reqDateOnly.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays > link.bookable_window_days) {
        return res.json({ slots: [], outsideBookableWindow: true });
      }
    }

    // Get existing meetings for this date
    const existingMeetings = db.connection.prepare(`
      SELECT time, duration_minutes FROM meetings
      WHERE host_id = ? AND date = ? AND status IN ('pending', 'approved')
    `).all(link.host_id, date) as any[];

    // Check daily booking limit
    if (link.max_bookings_per_day) {
      const dailyCount = db.connection.prepare(`
        SELECT COUNT(*) as count FROM meetings
        WHERE host_id = ? AND date = ? AND status IN ('pending', 'approved')
      `).get(link.host_id, date) as any;

      if (dailyCount.count >= link.max_bookings_per_day) {
        return res.json({ slots: [], maxedOut: true });
      }
    }

    // ---- OOO short-circuit: if the host is out and has no delegate, no slots. ----
    // If a delegate IS set, the booking POST endpoint re-routes; slots can still
    // be shown (using the host's availability as a UI hint).
    try {
      const ooo = getActiveOOO(link.host_id, date as string);
      if (ooo && !ooo.delegate) {
        return res.json({ slots: [], outOfOffice: true });
      }
    } catch {}

    // Per-link availability override — if set, use that JSON in place of the
    // host's global user_availability. Same shape so the rest of the math is identical.
    let override: any = null;
    if (link.availability_override) {
      try { override = JSON.parse(link.availability_override); } catch {}
    }

    // common_schedule_id wins over availability_override (it's an explicit
    // saved preset; override is freeform).
    const commonSchedule = getCommonSchedule(link.common_schedule_id);
    const source = commonSchedule || override;

    const availability = {
      startHour: source?.startHour ?? link.start_hour ?? 9,
      endHour: source?.endHour ?? link.end_hour ?? 17,
      slotDuration: source?.slotDuration ?? link.slot_duration ?? 30,
      bufferMinutes: source?.bufferMinutes ?? link.buffer_minutes ?? 0,
      days: source?.days ?? JSON.parse(link.working_days || '[0,1,2,3,4]'),
      timeOff: source?.timeOff ?? JSON.parse(link.time_off || '[]'),
      minNoticeMinutes: source?.minNoticeMinutes ?? link.min_notice_minutes ?? 120,
    };

    // Per-date override beats the above for start/end hour and may close the
    // date entirely.
    const dateOverride = getDateOverride(link.host_id, date as string);
    if (dateOverride && !dateOverride.available) {
      return res.json({ slots: [], dateClosed: true });
    }
    if (dateOverride?.startHour !== null && dateOverride?.startHour !== undefined) {
      availability.startHour = dateOverride.startHour;
    }
    if (dateOverride?.endHour !== null && dateOverride?.endHour !== undefined) {
      availability.endHour = dateOverride.endHour;
    }

    const slotCapacity = link.slot_capacity && link.slot_capacity > 0 ? link.slot_capacity : 1;

    const requestedDate = new Date(date as string);
    const dayOfWeek = requestedDate.getDay();

    // Check if it's a working day
    if (!availability.days.includes(dayOfWeek)) {
      return res.json({ slots: [], notWorkingDay: true });
    }

    // Restriction schedule narrows the window further for this booking link.
    const restriction = getRestrictionForLink(link.id);
    if (restriction) {
      if (!restriction.daysOfWeek.includes(dayOfWeek)) {
        return res.json({ slots: [], restricted: true });
      }
      if (restriction.startHour > availability.startHour) availability.startHour = restriction.startHour;
      if (restriction.endHour < availability.endHour) availability.endHour = restriction.endHour;
      if (availability.endHour <= availability.startHour) {
        return res.json({ slots: [], restricted: true });
      }
    }

    // Check time off
    const dateStr = date as string;
    const isTimeOff = availability.timeOff.some((off: any) => {
      if (typeof off === 'string') {
        return off === dateStr;
      }
      return dateStr >= off.start && dateStr <= off.end;
    });

    if (isTimeOff) {
      return res.json({ slots: [], timeOff: true });
    }

    // Generate time slots
    const slots: any[] = [];
    const now = new Date();
    const minNotice = new Date(now.getTime() + availability.minNoticeMinutes * 60000);

    for (let hour = availability.startHour; hour < availability.endHour; hour++) {
      for (let minute = 0; minute < 60; minute += availability.slotDuration) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Check if slot is in the past or within min notice period
        const slotDate = new Date(`${dateStr}T${timeStr}:00`);
        if (slotDate <= minNotice) {
          continue;
        }

        // For group events (slot_capacity > 1) we count overlapping meetings
        // and treat the slot as full only when count >= capacity. For 1-on-1
        // events we keep the prior boolean conflict check.
        const slotStartMin = hour * 60 + minute - (link.buffer_before || 0);
        const slotEndMin = hour * 60 + minute + availability.slotDuration;
        const overlappingCount = existingMeetings.filter((meeting: any) => {
          const [mHour, mMinute] = meeting.time.split(':').map(Number);
          const mStart = mHour * 60 + mMinute;
          const mEnd = mStart + meeting.duration_minutes + (link.buffer_after || 0);
          return slotStartMin < mEnd && slotEndMin > mStart;
        }).length;
        const hasConflict = overlappingCount >= slotCapacity;

        if (!hasConflict) {
          const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
          slots.push({
            time: timeStr,
            label: timeStr,
            hour,
            minute,
            period,
            available: true
          });
        }
      }
    }

    res.json({ slots });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch available slots', 500);
  }
}));

// Create a booking through public link (no auth required, but rate-limited and validated)
router.post('/public/:slug/book', publicBookingLimiter, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const {
      date, time, duration, title,
      attendeeName, attendeeEmail, notes,
      meetingFormat, meetingLink,
      routingSubmissionId
    } = req.body;

    if (!date || !time || !attendeeName || !attendeeEmail) {
      throw new AppError('Missing required fields', 400);
    }

    // ---- input validation (public surface — hard caps + format checks) ----
    if (typeof attendeeName !== 'string' || attendeeName.length < 1 || attendeeName.length > 100) {
      throw new AppError('Invalid attendee name', 400);
    }
    if (typeof attendeeEmail !== 'string' || !EMAIL_RE.test(attendeeEmail) || attendeeEmail.length > 254) {
      throw new AppError('Invalid attendee email', 400);
    }
    if (title !== undefined && (typeof title !== 'string' || title.length > 200)) {
      throw new AppError('Title too long', 400);
    }
    if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 2000)) {
      throw new AppError('Notes too long', 400);
    }
    if (meetingLink !== undefined && meetingLink !== null && meetingLink !== '') {
      if (
        typeof meetingLink !== 'string' ||
        (!meetingLink.startsWith('http://') && !meetingLink.startsWith('https://')) ||
        meetingLink.length > 500
      ) {
        throw new AppError('Invalid meeting link', 400);
      }
    }

    // Get booking link + host availability in a single read (mirror slots-endpoint behavior)
    const link = db.connection.prepare(`
      SELECT bl.*, u.id as host_id, u.name as host_name, u.email as host_email,
             ums.meeting_link as default_meeting_link, ums.preferred_platform,
             ua.start_hour, ua.end_hour, ua.slot_duration, ua.buffer_minutes,
             ua.min_notice_minutes, ua.working_days, ua.time_off
      FROM booking_links bl
      JOIN users u ON bl.user_id = u.id
      LEFT JOIN user_meeting_settings ums ON u.id = ums.user_id
      LEFT JOIN user_availability ua ON u.id = ua.user_id
      WHERE bl.slug = ? AND bl.is_active = 1
    `).get(slug) as any;

    if (!link) {
      throw new AppError('Booking link not found or inactive', 404);
    }

    // ---- expiration check (the slot endpoint enforces this; re-check on POST) ----
    if (link.expires_at) {
      const expires = new Date(link.expires_at);
      if (!isNaN(expires.getTime()) && expires < new Date()) {
        throw new AppError('This booking link has expired', 410);
      }
    }

    // ---- OOO redirect: re-route to the delegate if set; refuse if no delegate. ----
    // Run BEFORE conflict checks so the rest of the logic targets the right host.
    try {
      const ooo = getActiveOOO(link.host_id, date);
      if (ooo) {
        if (!ooo.delegate) {
          throw new AppError('Host is currently out of office', 410);
        }
        // Re-target the booking to the delegate. Pick up delegate's host info
        // and email + preferred platform/link so downstream logic still works.
        const delegateRow = db.connection.prepare(`
          SELECT u.id as host_id, u.name as host_name, u.email as host_email,
                 ums.meeting_link as default_meeting_link, ums.preferred_platform
          FROM users u
          LEFT JOIN user_meeting_settings ums ON u.id = ums.user_id
          WHERE u.id = ?
        `).get(ooo.delegate.id) as any;
        if (delegateRow) {
          link.host_id = delegateRow.host_id;
          link.user_id = delegateRow.host_id;
          link.host_name = delegateRow.host_name;
          link.host_email = delegateRow.host_email;
          link.default_meeting_link = delegateRow.default_meeting_link;
          link.preferred_platform = delegateRow.preferred_platform;
        }
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
    }

    // ---- Blocklist check: refuse if attendee email matches any pattern. ----
    if (isBlocked(link.host_id, attendeeEmail)) {
      throw new AppError('Booking not allowed', 403);
    }

    // Validate duration
    const durationOptions = JSON.parse(link.duration_options || '[30]');
    const bookingDuration = duration || link.default_duration;
    if (!durationOptions.includes(bookingDuration)) {
      throw new AppError('Invalid duration selected', 400);
    }

    // ---- Frequency + total-duration limits ----
    enforceFrequencyLimits(link, link.host_id, attendeeEmail, bookingDuration);

    // Per-link availability override — JSON shape mirrors user_availability.
    let override: any = null;
    if (link.availability_override) {
      try { override = JSON.parse(link.availability_override); } catch {}
    }

    // common_schedule_id wins over availability_override.
    const commonSchedule = getCommonSchedule(link.common_schedule_id);
    if (commonSchedule) override = commonSchedule;

    // Per-date override beats the above for start/end hour, and may close the date.
    const dateOverride = getDateOverride(link.host_id, date);
    if (dateOverride && !dateOverride.available) {
      throw new AppError('Host is not available on this date', 400);
    }

    // Bookable-window check
    if (link.bookable_window_days) {
      const reqDateOnly = new Date(`${date}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((reqDateOnly.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays > link.bookable_window_days) {
        throw new AppError(`Bookings cannot be made more than ${link.bookable_window_days} days in advance`, 400);
      }
    }

    // ---- working-day + time-off check ----
    const requestedDate = new Date(`${date}T00:00:00`);
    const dayOfWeek = requestedDate.getDay();
    const workingDays: number[] = override?.days ?? JSON.parse(link.working_days || '[0,1,2,3,4]');
    if (!workingDays.includes(dayOfWeek)) {
      throw new AppError('Not a working day', 400);
    }
    const timeOff: any[] = override?.timeOff ?? JSON.parse(link.time_off || '[]');
    const isTimeOff = timeOff.some((off: any) => {
      if (typeof off === 'string') return off === date;
      return date >= off.start && date <= off.end;
    });
    if (isTimeOff) {
      throw new AppError('Host is not available on this date', 400);
    }

    // ---- Restriction schedule + date-override hour-window enforcement ----
    const [reqHourForWindow] = (time as string).split(':').map(Number);
    let windowStart = override?.startHour ?? link.start_hour ?? 0;
    let windowEnd = override?.endHour ?? link.end_hour ?? 24;
    if (dateOverride?.startHour !== null && dateOverride?.startHour !== undefined) {
      windowStart = dateOverride.startHour;
    }
    if (dateOverride?.endHour !== null && dateOverride?.endHour !== undefined) {
      windowEnd = dateOverride.endHour;
    }
    const restriction = getRestrictionForLink(link.id);
    if (restriction) {
      if (!restriction.daysOfWeek.includes(dayOfWeek)) {
        throw new AppError('Not allowed on this day', 400);
      }
      if (restriction.startHour > windowStart) windowStart = restriction.startHour;
      if (restriction.endHour < windowEnd) windowEnd = restriction.endHour;
    }
    if (reqHourForWindow < windowStart || reqHourForWindow >= windowEnd) {
      throw new AppError('Time slot is outside the allowed window', 400);
    }

    // ---- min-notice check ----
    const minNoticeMinutes = override?.minNoticeMinutes ?? link.min_notice_minutes ?? 120;
    const slotDateTime = new Date(`${date}T${time}:00`);
    const earliestAllowed = new Date(Date.now() + minNoticeMinutes * 60_000);
    if (slotDateTime <= earliestAllowed) {
      throw new AppError(`Bookings require at least ${minNoticeMinutes} minutes advance notice`, 400);
    }

    // ---- daily booking limit ----
    if (link.max_bookings_per_day) {
      const dailyCount = db.connection.prepare(`
        SELECT COUNT(*) as count FROM meetings
        WHERE host_id = ? AND date = ? AND status IN ('pending', 'approved')
      `).get(link.host_id, date) as any;
      if (dailyCount.count >= link.max_bookings_per_day) {
        throw new AppError('Daily booking limit reached for this date', 409);
      }
    }

    // ---- buffer-aware overlap check (mirrors slot-endpoint conflict logic) ----
    const [reqHour, reqMinute] = (time as string).split(':').map(Number);
    const reqStart = reqHour * 60 + reqMinute - (link.buffer_before || 0);
    const reqEnd = reqHour * 60 + reqMinute + bookingDuration + (link.buffer_after || 0);

    const sameDayMeetings = db.connection.prepare(`
      SELECT id, time, duration_minutes FROM meetings
      WHERE host_id = ? AND date = ? AND status IN ('pending', 'approved')
    `).all(link.host_id, date) as any[];

    // Group events: allow up to N bookings per slot via slot_capacity.
    const slotCapacity = link.slot_capacity && link.slot_capacity > 0 ? link.slot_capacity : 1;
    const overlappingCount = sameDayMeetings.filter(m => {
      const [mH, mM] = m.time.split(':').map(Number);
      const mStart = mH * 60 + mM - (link.buffer_before || 0);
      const mEnd = mH * 60 + mM + m.duration_minutes + (link.buffer_after || 0);
      return reqStart < mEnd && reqEnd > mStart;
    }).length;
    if (overlappingCount >= slotCapacity) {
      throw new AppError('This time slot is no longer available', 409);
    }

    // ---- external calendar (Google/Outlook) busy-times check ----
    try {
      const { getExternalBusyTimes } = await import('../services/calendarSync');
      const busy = getExternalBusyTimes(link.host_id, date);
      const externalConflict = busy.some((b: { start: string; end: string }) => {
        const bStart = new Date(b.start).getTime();
        const bEnd = new Date(b.end).getTime();
        const reqStartMs = slotDateTime.getTime();
        const reqEndMs = reqStartMs + bookingDuration * 60_000;
        return reqStartMs < bEnd && reqEndMs > bStart;
      });
      if (externalConflict) {
        throw new AppError('This time slot conflicts with an external calendar event', 409);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      // If the calendar tables don't exist yet (fresh install) or sync is unconfigured,
      // a missing connection just means no external events to check — fall through.
    }

    // Determine meeting link
    const format = meetingFormat || 'in-person';
    let finalMeetingLink = meetingLink;
    let finalPlatform = null;

    if (format === 'online' && !meetingLink && link.default_meeting_link) {
      finalMeetingLink = link.default_meeting_link;
      finalPlatform = link.preferred_platform;
    }

    const meetingId = uuidv4();
    const attendeeToken = uuidv4();
    const meetingTitle = title || `Meeting with ${attendeeName}`;

    const approvalRequired = !!link.approval_required;

    // Native conferencing wiring — create a Zoom or Teams meeting if the host
    // prefers one and we have the integration configured. Lazy-imported so the
    // route doesn't pay the cost when conferencing is unconfigured. Falls back
    // to the host's static link silently on any error.
    let zoomMeetingIdPersist: string | null = null;
    let teamsMeetingIdPersist: string | null = null;
    if (format === 'online') {
      const platform = String(link.preferred_platform || '').toLowerCase();
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
              hostEmail: link.host_email || undefined,
            });
            finalMeetingLink = z.joinUrl;
            finalPlatform = 'zoom';
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
              hostUserId: link.host_id,
            });
            finalMeetingLink = t.joinUrl;
            finalPlatform = 'teams';
            teamsMeetingIdPersist = t.id;
          }
        }
      } catch (e) {
        console.error('Native conferencing creation failed (falling back to static link):', e);
      }
    }

    db.connection.prepare(`
      INSERT INTO meetings (
        id, title, date, time, duration_minutes, attendee_name, attendee_email,
        host_id, status, booked_by, notes, category, meeting_format, meeting_link, meeting_platform,
        attendee_token, approval_required, approver_id,
        zoom_meeting_id, teams_meeting_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'guest', ?, 'general', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      meetingId, meetingTitle, date, time, bookingDuration,
      attendeeName, attendeeEmail, link.host_id, notes || null,
      format, finalMeetingLink || null, finalPlatform,
      attendeeToken,
      approvalRequired ? 1 : 0,
      approvalRequired ? link.host_id : null,
      zoomMeetingIdPersist, teamsMeetingIdPersist
    );

    // Log activity
    db.connection.prepare(`
      INSERT INTO activity_logs (id, action, details, performed_by, role)
      VALUES (?, 'PUBLIC_BOOK', ?, ?, 'guest')
    `).run(uuidv4(), `Booked "${meetingTitle}" via public link`, attendeeName);

    // Stitch routing-form submission, if any, to the new meeting.
    if (typeof routingSubmissionId === 'string' && routingSubmissionId.length > 0) {
      try {
        db.connection.prepare(`UPDATE meetings SET routing_submission_id = ? WHERE id = ?`).run(routingSubmissionId, meetingId);
        db.connection.prepare(`
          UPDATE routing_form_submissions SET meeting_id = ?, attendee_email = ? WHERE id = ?
        `).run(meetingId, attendeeEmail, routingSubmissionId);
      } catch (e) {
        console.error('Failed to attach routing submission to meeting:', e);
      }
    }

    // Workflow dispatch — fire-and-forget so a slow workflow doesn't delay the response.
    (async () => {
      try {
        const { dispatchTrigger, scheduleForMeeting } = await import('../services/workflowEngine');
        await dispatchTrigger('booking.created', {
          meeting: db.connection.prepare(`SELECT * FROM meetings WHERE id = ?`).get(meetingId),
          attendee: { name: attendeeName, email: attendeeEmail },
          host: { id: link.host_id, name: link.host_name, email: link.host_email },
          link: { slug, id: link.id },
        });
        await scheduleForMeeting(meetingId);
      } catch (e) { console.error('workflow dispatch failed:', e); }
    })();

    // Stats / XP / webhook / challenges — best-effort, never block the response.
    try { awardXp(link.host_id, 10, 'public booking'); } catch {}
    try { incrementBookingStat(link.host_id); } catch {}
    try {
      dispatchWebhook(link.host_id, 'booking.created', {
        meetingId, title: meetingTitle, date, time, duration: bookingDuration,
        attendeeName, attendeeEmail, source: 'booking_link', slug,
      });
    } catch {}
    try { trackChallengeProgress(link.host_id, 'bookings_received', 1); } catch {}

    // Notify host in-app
    try {
      db.connection.prepare(`
        INSERT INTO notifications (id, user_id, type, title, body, link)
        VALUES (?, ?, 'booking.request', ?, ?, ?)
      `).run(
        uuidv4(),
        link.host_id,
        `New booking request: ${meetingTitle}`,
        `${attendeeName} requested ${date} at ${time}`,
        `/?view=my-meetings`
      );
    } catch (e) {
      console.error('Failed to create in-app notification:', e);
    }

    // Fire-and-forget confirmation emails (attendee + host) with ICS attachment.
    // Don't block the response on email delivery.
    (async () => {
      try {
        const { sendBookingConfirmation, sendBookingHostNotification } = await import('../services/bookingEmails');
        // Hide host email on the attendee-facing confirmation if the link says so.
        const visibleHostEmail = link.hide_organizer_email ? undefined : link.host_email;
        const customReplyTo = link.custom_reply_to || undefined;
        await sendBookingConfirmation({
          meetingId, attendeeToken, meetingTitle, date, time,
          durationMinutes: bookingDuration, attendeeName, attendeeEmail,
          hostName: link.host_name, hostEmail: visibleHostEmail,
          meetingLink: finalMeetingLink, notes,
          replyTo: customReplyTo,
        });
        // Host notification still always goes to the actual host inbox.
        if (link.host_email) {
          await sendBookingHostNotification({
            meetingId, meetingTitle, date, time,
            durationMinutes: bookingDuration, attendeeName, attendeeEmail,
            hostName: link.host_name, hostEmail: link.host_email,
            meetingLink: finalMeetingLink, notes,
            replyTo: customReplyTo,
          });
        }
      } catch (e) {
        console.error('Failed to send booking emails:', e);
      }
    })();

    res.status(201).json({
      id: meetingId,
      title: meetingTitle,
      date,
      time,
      durationMinutes: bookingDuration,
      attendeeName,
      attendeeEmail,
      hostName: link.host_name,
      status: 'pending',
      meetingFormat: format,
      attendeeToken,  // returned so the success page can offer a "manage booking" link
      // If the link configures a redirect URL, surface it for the frontend success page.
      redirectUrlOnSuccess: link.redirect_url_on_success || null,
      message: 'Your meeting request has been submitted! You will receive a confirmation once approved.'
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create booking', 500);
  }
}));

// ============================================================================
// Public reschedule / cancel via tokenized link (no auth, but rate-limited)
// ============================================================================

const manageBookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.ip}:${req.params.token}`,
  message: { error: 'Too many attempts. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/booking-links/manage/:token — fetch booking details for the attendee
router.get('/manage/:token', manageBookingLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const meeting = db.connection.prepare(`
    SELECT m.*, u.name as host_name
    FROM meetings m
    JOIN users u ON m.host_id = u.id
    WHERE m.attendee_token = ?
  `).get(token) as any;

  if (!meeting) {
    throw new AppError('Booking not found', 404);
  }

  res.json({
    id: meeting.id,
    title: meeting.title,
    date: meeting.date,
    time: meeting.time,
    durationMinutes: meeting.duration_minutes,
    attendeeName: meeting.attendee_name,
    attendeeEmail: meeting.attendee_email,
    hostId: meeting.host_id,
    hostName: meeting.host_name,
    status: meeting.status,
    meetingLink: meeting.meeting_link,
    meetingFormat: meeting.meeting_format,
    notes: meeting.notes,
    canModify: ['pending', 'approved'].includes(meeting.status),
  });
}));

// POST /api/booking-links/manage/:token/cancel
router.post('/manage/:token/cancel', manageBookingLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const meeting = db.connection.prepare(`
    SELECT m.*, u.name as host_name, u.email as host_email
    FROM meetings m
    JOIN users u ON m.host_id = u.id
    WHERE m.attendee_token = ?
  `).get(token) as any;

  if (!meeting) throw new AppError('Booking not found', 404);
  if (!['pending', 'approved'].includes(meeting.status)) {
    throw new AppError('This booking can no longer be cancelled', 400);
  }

  // Meeting must be in the future
  const meetingStart = new Date(`${meeting.date}T${meeting.time}:00`);
  if (meetingStart <= new Date()) {
    throw new AppError('Past meetings cannot be cancelled', 400);
  }

  db.connection.prepare(`UPDATE meetings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(meeting.id);

  db.connection.prepare(`
    INSERT INTO activity_logs (id, action, details, performed_by, role)
    VALUES (?, 'CANCEL_BY_ATTENDEE', ?, ?, 'guest')
  `).run(uuidv4(), `Attendee cancelled "${meeting.title}"`, meeting.attendee_name);

  // Notify host in-app + by email
  try {
    db.connection.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, link)
      VALUES (?, ?, 'booking.cancelled', ?, ?, ?)
    `).run(
      uuidv4(),
      meeting.host_id,
      `Booking cancelled: ${meeting.title}`,
      `${meeting.attendee_name} cancelled ${meeting.date} at ${meeting.time}`,
      `/?view=my-meetings`
    );
  } catch (e) {
    console.error('Failed to write notification:', e);
  }

  // Best-effort sync deletion for the host's external calendar
  try {
    const { deleteSyncedEvent } = await import('../services/calendarSync');
    deleteSyncedEvent(meeting.id).catch((err: any) => console.error('Failed to delete synced event:', err));
  } catch (e) {
    // calendar sync may be unconfigured
  }

  // Email the host
  try {
    if (meeting.host_email) {
      const { sendBookingCancelled } = await import('../services/bookingEmails');
      await sendBookingCancelled({
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        date: meeting.date,
        time: meeting.time,
        durationMinutes: meeting.duration_minutes,
        attendeeName: meeting.attendee_name,
        attendeeEmail: meeting.host_email, // send the cancellation notice TO the host
        hostName: meeting.host_name,
        hostEmail: meeting.host_email,
        cancelledBy: `${meeting.attendee_name} (attendee)`,
      });
    }
  } catch (e) {
    console.error('Failed to email host of cancellation:', e);
  }

  // Webhook dispatch
  try {
    dispatchWebhook(meeting.host_id, 'booking.cancelled', {
      meetingId: meeting.id, title: meeting.title,
      date: meeting.date, time: meeting.time,
      attendeeName: meeting.attendee_name, attendeeEmail: meeting.attendee_email,
      cancelledBy: 'attendee',
    });
  } catch {}

  // Workflow dispatch + cancel pending scheduled executions for this meeting
  (async () => {
    try {
      const { dispatchTrigger } = await import('../services/workflowEngine');
      await dispatchTrigger('booking.cancelled', {
        meeting,
        attendee: { name: meeting.attendee_name, email: meeting.attendee_email },
        host: { id: meeting.host_id, name: meeting.host_name, email: meeting.host_email },
      });
      try {
        db.connection.prepare(
          `UPDATE workflow_executions SET status = 'cancelled' WHERE meeting_id = ? AND status = 'scheduled'`
        ).run(meeting.id);
      } catch {}
    } catch (e) { console.error('workflow dispatch failed:', e); }
  })();

  res.json({ success: true, status: 'cancelled' });
}));

// POST /api/booking-links/manage/:token/reschedule { date, time }
router.post('/manage/:token/reschedule', manageBookingLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const { date, time } = req.body ?? {};

  if (!date || !time || typeof date !== 'string' || typeof time !== 'string') {
    throw new AppError('Date and time are required', 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new AppError('Invalid date/time format', 400);
  }

  const meeting = db.connection.prepare(`
    SELECT m.*, u.name as host_name, u.email as host_email,
           ua.buffer_minutes, ua.min_notice_minutes
    FROM meetings m
    JOIN users u ON m.host_id = u.id
    LEFT JOIN user_availability ua ON u.id = ua.user_id
    WHERE m.attendee_token = ?
  `).get(token) as any;

  if (!meeting) throw new AppError('Booking not found', 404);
  if (!['pending', 'approved'].includes(meeting.status)) {
    throw new AppError('This booking can no longer be rescheduled', 400);
  }

  // Min-notice
  const minNoticeMinutes = meeting.min_notice_minutes ?? 120;
  const newStart = new Date(`${date}T${time}:00`);
  if (newStart <= new Date(Date.now() + minNoticeMinutes * 60_000)) {
    throw new AppError(`Reschedule requires at least ${minNoticeMinutes} minutes notice`, 400);
  }

  // Conflict check excluding self
  const buffer = meeting.buffer_minutes ?? 0;
  const reqStart = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]) - buffer;
  const reqEnd = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]) + meeting.duration_minutes + buffer;
  const sameDay = db.connection.prepare(`
    SELECT id, time, duration_minutes FROM meetings
    WHERE host_id = ? AND date = ? AND status IN ('pending','approved') AND id != ?
  `).all(meeting.host_id, date, meeting.id) as any[];
  const conflict = sameDay.some(m => {
    const [mH, mM] = m.time.split(':').map(Number);
    const mStart = mH * 60 + mM - buffer;
    const mEnd = mH * 60 + mM + m.duration_minutes + buffer;
    return reqStart < mEnd && reqEnd > mStart;
  });
  if (conflict) {
    throw new AppError('That time is no longer available', 409);
  }

  db.connection.prepare(`
    UPDATE meetings
    SET date = ?, time = ?, status = 'pending',
        reminder_24h_sent = 0, reminder_1h_sent = 0,
        host_reminder_24h_sent = 0, host_reminder_1h_sent = 0,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(date, time, meeting.id);

  db.connection.prepare(`
    INSERT INTO activity_logs (id, action, details, performed_by, role)
    VALUES (?, 'RESCHEDULE_BY_ATTENDEE', ?, ?, 'guest')
  `).run(uuidv4(), `Attendee rescheduled "${meeting.title}" to ${date} ${time}`, meeting.attendee_name);

  try {
    db.connection.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, link)
      VALUES (?, ?, 'booking.rescheduled', ?, ?, ?)
    `).run(
      uuidv4(),
      meeting.host_id,
      `Booking rescheduled: ${meeting.title}`,
      `${meeting.attendee_name} moved the meeting to ${date} at ${time}`,
      `/?view=my-meetings`
    );
  } catch (e) {
    console.error('Failed to write notification:', e);
  }

  // Re-send confirmation email to attendee with new time
  try {
    const { sendBookingConfirmation } = await import('../services/bookingEmails');
    await sendBookingConfirmation({
      meetingId: meeting.id,
      attendeeToken: token,
      meetingTitle: meeting.title,
      date,
      time,
      durationMinutes: meeting.duration_minutes,
      attendeeName: meeting.attendee_name,
      attendeeEmail: meeting.attendee_email,
      hostName: meeting.host_name,
      hostEmail: meeting.host_email,
      meetingLink: meeting.meeting_link,
      notes: meeting.notes,
    });
  } catch (e) {
    console.error('Failed to resend confirmation:', e);
  }

  // Webhook dispatch
  try {
    dispatchWebhook(meeting.host_id, 'booking.rescheduled', {
      meetingId: meeting.id, title: meeting.title,
      date, time,
      attendeeName: meeting.attendee_name, attendeeEmail: meeting.attendee_email,
      rescheduledBy: 'attendee',
    });
  } catch {}

  res.json({ success: true, status: 'pending', date, time });
}));

export default router;
