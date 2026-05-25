/**
 * Booking Links Routes - Calendly-style public booking
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

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

// Get all booking links for authenticated user
router.get('/my-links', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const links = db.connection.prepare(`
      SELECT * FROM booking_links WHERE user_id = ? ORDER BY created_at DESC
    `).all(req.user!.userId) as any[];

    const result = links.map(link => ({
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
      createdAt: link.created_at,
      updatedAt: link.updated_at
    }));

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
      isActive, maxBookingsPerDay, bufferBefore, bufferAfter, customMessage, expiresAt 
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

    res.json({
      id: link.id,
      slug: link.slug,
      title: link.title,
      description: link.description,
      durationOptions: JSON.parse(link.duration_options || '[30]'),
      defaultDuration: link.default_duration,
      customMessage: link.custom_message,
      host: {
        id: link.host_id,
        name: link.host_name,
        title: link.host_title,
        avatar: link.host_avatar,
        email: link.host_email,
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

    // Generate available slots
    const availability = {
      startHour: link.start_hour || 9,
      endHour: link.end_hour || 17,
      slotDuration: link.slot_duration || 30,
      bufferMinutes: link.buffer_minutes || 0,
      days: JSON.parse(link.working_days || '[0,1,2,3,4]'),
      timeOff: JSON.parse(link.time_off || '[]'),
      minNoticeMinutes: link.min_notice_minutes || 120
    };

    const requestedDate = new Date(date as string);
    const dayOfWeek = requestedDate.getDay();

    // Check if it's a working day
    if (!availability.days.includes(dayOfWeek)) {
      return res.json({ slots: [], notWorkingDay: true });
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

        // Check for conflicts with existing meetings
        const hasConflict = existingMeetings.some((meeting: any) => {
          const [mHour, mMinute] = meeting.time.split(':').map(Number);
          const meetingStart = mHour * 60 + mMinute;
          const meetingEnd = meetingStart + meeting.duration_minutes + (link.buffer_after || 0);
          const slotStart = hour * 60 + minute - (link.buffer_before || 0);
          const slotEnd = hour * 60 + minute + availability.slotDuration;
          
          return (slotStart < meetingEnd && slotEnd > meetingStart);
        });

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
      meetingFormat, meetingLink
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

    // Get booking link and host info
    const link = db.connection.prepare(`
      SELECT bl.*, u.id as host_id, u.name as host_name,
             ums.meeting_link as default_meeting_link, ums.preferred_platform
      FROM booking_links bl
      JOIN users u ON bl.user_id = u.id
      LEFT JOIN user_meeting_settings ums ON u.id = ums.user_id
      WHERE bl.slug = ? AND bl.is_active = 1
    `).get(slug) as any;

    if (!link) {
      throw new AppError('Booking link not found or inactive', 404);
    }

    // Validate duration
    const durationOptions = JSON.parse(link.duration_options || '[30]');
    const bookingDuration = duration || link.default_duration;
    if (!durationOptions.includes(bookingDuration)) {
      throw new AppError('Invalid duration selected', 400);
    }

    // Check for conflicts
    const existing = db.connection.prepare(`
      SELECT id FROM meetings
      WHERE host_id = ? AND date = ? AND time = ? AND status IN ('pending', 'approved')
    `).get(link.host_id, date, time);

    if (existing) {
      throw new AppError('This time slot is no longer available', 409);
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
    const meetingTitle = title || `Meeting with ${attendeeName}`;

    db.connection.prepare(`
      INSERT INTO meetings (
        id, title, date, time, duration_minutes, attendee_name, attendee_email,
        host_id, status, booked_by, notes, category, meeting_format, meeting_link, meeting_platform
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'guest', ?, 'general', ?, ?, ?)
    `).run(
      meetingId, meetingTitle, date, time, bookingDuration,
      attendeeName, attendeeEmail, link.host_id, notes || null,
      format, finalMeetingLink || null, finalPlatform
    );

    // Log activity
    db.connection.prepare(`
      INSERT INTO activity_logs (id, action, details, performed_by, role)
      VALUES (?, 'PUBLIC_BOOK', ?, ?, 'guest')
    `).run(uuidv4(), `Booked "${meetingTitle}" via public link`, attendeeName);

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
      message: 'Your meeting request has been submitted! You will receive a confirmation once approved.'
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create booking', 500);
  }
}));

export default router;
