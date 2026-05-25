/**
 * Meeting Routes
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { syncMeetingToCalendar, deleteSyncedEvent, getExternalBusyTimes } from '../services/calendarSync';

const router = Router();

// Get meetings (filtered by role)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const { hostId, status, startDate, endDate } = req.query;

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
      additionalAttendees, hostId, notes, category, meetingFormat, meetingLink, meetingPlatform
    } = req.body;

    if (!title || !date || !time || !hostId || !attendeeName || !attendeeEmail) {
      throw new AppError('Missing required fields', 400);
    }

    // Validate meeting format
    const format = meetingFormat || 'in-person';
    if (!['online', 'in-person'].includes(format)) {
      throw new AppError('Invalid meeting format', 400);
    }

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

    db.connection.prepare(`
      INSERT INTO meetings (id, title, date, time, duration_minutes, attendee_name, attendee_email, additional_attendees, user_id, host_id, status, booked_by, notes, category, meeting_format, meeting_link, meeting_platform)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      meetingId, title, date, time, durationMinutes || 30,
      attendeeName, attendeeEmail, additionalAttendees || null,
      userId, hostId, status, bookedBy, notes || null, category || 'general',
      format, finalMeetingLink || null, finalMeetingPlatform || null
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
    }

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
