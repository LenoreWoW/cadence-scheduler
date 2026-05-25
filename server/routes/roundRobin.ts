/**
 * Round-Robin Booking Routes
 * Distributes bookings evenly across team members
 */

import { Router, Request, Response } from 'express';
import { db } from '../database';
import { authenticateToken } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Initialize round-robin state table.
// NOTE: Do NOT invoke this at module-load time — database.ts#runMigrations()
// calls it after core schema is in place.
export const initRoundRobinTable = () => {
  db.connection.exec(`
    CREATE TABLE IF NOT EXISTS round_robin_state (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      last_assigned_user_id TEXT,
      rotation_order TEXT DEFAULT '[]',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )
  `);
  
  db.connection.exec(`
    CREATE INDEX IF NOT EXISTS idx_round_robin_team ON round_robin_state(team_id)
  `);
};

/**
 * GET /api/round-robin/teams/:teamId/members
 * Get team members available for round-robin
 */
router.get('/teams/:teamId/members', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;

    const members = db.connection.prepare(`
      SELECT 
        u.id, 
        u.name, 
        u.email,
        u.avatar,
        u.title,
        ua.start_hour,
        ua.end_hour,
        ua.working_days,
        (
          SELECT COUNT(*) FROM meetings m 
          WHERE m.host_id = u.id 
          AND m.date >= date('now', '-7 days')
          AND m.status != 'cancelled'
        ) as recent_bookings
      FROM users u
      LEFT JOIN user_availability ua ON ua.user_id = u.id
      WHERE u.team_id = ? AND u.role IN ('admin', 'manager')
      ORDER BY u.name
    `).all(teamId);

    res.json(members);
  } catch (error) {
    console.error('Get round-robin members error:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

/**
 * GET /api/round-robin/teams/:teamId/state
 * Get current round-robin state for a team
 */
router.get('/teams/:teamId/state', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;

    let state = db.connection.prepare(`
      SELECT * FROM round_robin_state WHERE team_id = ?
    `).get(teamId) as any;

    if (!state) {
      // Initialize state for team
      const members = db.connection.prepare(`
        SELECT id FROM users WHERE team_id = ? AND role IN ('admin', 'manager')
        ORDER BY name
      `).all(teamId) as any[];

      const rotationOrder = members.map(m => m.id);
      const id = uuidv4();

      db.connection.prepare(`
        INSERT INTO round_robin_state (id, team_id, rotation_order, updated_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(id, teamId, JSON.stringify(rotationOrder));

      state = {
        id,
        team_id: teamId,
        last_assigned_user_id: null,
        rotation_order: JSON.stringify(rotationOrder),
        updated_at: new Date().toISOString()
      };
    }

    res.json({
      ...state,
      rotation_order: JSON.parse(state.rotation_order || '[]')
    });
  } catch (error) {
    console.error('Get round-robin state error:', error);
    res.status(500).json({ error: 'Failed to fetch round-robin state' });
  }
});

/**
 * POST /api/round-robin/teams/:teamId/book
 * Create a meeting using round-robin assignment
 */
router.post('/teams/:teamId/book', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { 
      date, 
      time, 
      duration = 30,
      title,
      attendeeName,
      attendeeEmail,
      notes,
      category = 'general',
      meetingFormat = 'in-person'
    } = req.body;

    // Validate required fields
    if (!date || !time || !attendeeName || !attendeeEmail) {
      return res.status(400).json({ 
        error: 'Missing required fields: date, time, attendeeName, attendeeEmail' 
      });
    }

    // Get round-robin state
    let state = db.connection.prepare(`
      SELECT * FROM round_robin_state WHERE team_id = ?
    `).get(teamId) as any;

    if (!state) {
      return res.status(404).json({ error: 'Team not found or round-robin not configured' });
    }

    const rotationOrder = JSON.parse(state.rotation_order || '[]');
    
    if (rotationOrder.length === 0) {
      return res.status(400).json({ error: 'No team members available for booking' });
    }

    // Find next available member
    let assignedMember = null;
    let lastIndex = state.last_assigned_user_id 
      ? rotationOrder.indexOf(state.last_assigned_user_id)
      : -1;

    for (let i = 0; i < rotationOrder.length; i++) {
      const nextIndex = (lastIndex + 1 + i) % rotationOrder.length;
      const candidateId = rotationOrder[nextIndex];

      // Check if candidate is available at this time
      const candidate = db.connection.prepare(`
        SELECT u.*, ua.start_hour, ua.end_hour, ua.working_days
        FROM users u
        LEFT JOIN user_availability ua ON ua.user_id = u.id
        WHERE u.id = ?
      `).get(candidateId) as any;

      if (!candidate) continue;

      // Parse availability
      const workingDays = JSON.parse(candidate.working_days || '[0,1,2,3,4]');
      const meetingDate = new Date(date);
      const dayOfWeek = meetingDate.getDay();

      // Check if working day
      if (!workingDays.includes(dayOfWeek)) continue;

      // Check time within working hours
      const hourStr = time.split(':')[0];
      const hour = parseInt(hourStr);
      if (hour < (candidate.start_hour || 9) || hour >= (candidate.end_hour || 17)) continue;

      // Check for conflicts
      const conflict = db.connection.prepare(`
        SELECT id FROM meetings 
        WHERE host_id = ? AND date = ? AND time = ? AND status != 'cancelled'
      `).get(candidateId, date, time);

      if (conflict) continue;

      assignedMember = candidate;
      
      // Update round-robin state
      db.connection.prepare(`
        UPDATE round_robin_state 
        SET last_assigned_user_id = ?, updated_at = datetime('now')
        WHERE team_id = ?
      `).run(candidateId, teamId);

      break;
    }

    if (!assignedMember) {
      return res.status(409).json({ 
        error: 'No team members available at the requested time',
        suggestion: 'Try a different time slot'
      });
    }

    // Create the meeting
    const meetingId = uuidv4();
    
    db.connection.prepare(`
      INSERT INTO meetings (
        id, title, date, time, duration_minutes, 
        attendee_name, attendee_email, host_id,
        status, booked_by, notes, category, meeting_format,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      meetingId,
      title || `Meeting with ${attendeeName}`,
      date,
      time,
      duration,
      attendeeName,
      attendeeEmail,
      assignedMember.id,
      'approved', // Auto-approve round-robin bookings
      'round-robin',
      notes || null,
      category,
      meetingFormat
    );

    res.status(201).json({
      meeting: {
        id: meetingId,
        title: title || `Meeting with ${attendeeName}`,
        date,
        time,
        duration,
        status: 'approved',
        category,
        meetingFormat
      },
      assignedTo: {
        id: assignedMember.id,
        name: assignedMember.name,
        email: assignedMember.email,
        avatar: assignedMember.avatar
      },
      message: `Meeting assigned to ${assignedMember.name} via round-robin`
    });
  } catch (error) {
    console.error('Round-robin booking error:', error);
    res.status(500).json({ error: 'Failed to create round-robin booking' });
  }
});

/**
 * PUT /api/round-robin/teams/:teamId/order
 * Update the rotation order for a team
 */
router.put('/teams/:teamId/order', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { teamId } = req.params;
    const { order } = req.body;

    // Check if user is admin
    const user = db.connection.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can modify rotation order' });
    }

    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Order must be an array of user IDs' });
    }

    // Verify all users belong to the team
    const teamMembers = db.connection.prepare(`
      SELECT id FROM users WHERE team_id = ? AND id IN (${order.map(() => '?').join(',')})
    `).all(teamId, ...order) as any[];

    if (teamMembers.length !== order.length) {
      return res.status(400).json({ error: 'All users must belong to the specified team' });
    }

    // Update order
    const result = db.connection.prepare(`
      UPDATE round_robin_state 
      SET rotation_order = ?, updated_at = datetime('now')
      WHERE team_id = ?
    `).run(JSON.stringify(order), teamId);

    if (result.changes === 0) {
      // Create new state if doesn't exist
      db.connection.prepare(`
        INSERT INTO round_robin_state (id, team_id, rotation_order, updated_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(uuidv4(), teamId, JSON.stringify(order));
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Update rotation order error:', error);
    res.status(500).json({ error: 'Failed to update rotation order' });
  }
});

/**
 * GET /api/round-robin/teams/:teamId/availability
 * Get combined team availability for round-robin booking
 */
router.get('/teams/:teamId/availability', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter required' });
    }

    const dateStr = date as string;
    const targetDate = new Date(dateStr);
    const dayOfWeek = targetDate.getDay();

    // Get all team members with their availability
    const members = db.connection.prepare(`
      SELECT 
        u.id, u.name,
        ua.start_hour, ua.end_hour, ua.working_days, ua.slot_duration
      FROM users u
      LEFT JOIN user_availability ua ON ua.user_id = u.id
      WHERE u.team_id = ? AND u.role IN ('admin', 'manager')
    `).all(teamId) as any[];

    // Get existing meetings for the date
    const existingMeetings = db.connection.prepare(`
      SELECT host_id, time, duration_minutes 
      FROM meetings 
      WHERE date = ? AND host_id IN (${members.map(() => '?').join(',')}) AND status != 'cancelled'
    `).all(dateStr, ...members.map(m => m.id)) as any[];

    // Build availability map by hour
    const hourlyAvailability: { [hour: string]: string[] } = {};

    for (const member of members) {
      const workingDays = JSON.parse(member.working_days || '[0,1,2,3,4]');
      if (!workingDays.includes(dayOfWeek)) continue;

      const startHour = member.start_hour || 9;
      const endHour = member.end_hour || 17;

      for (let hour = startHour; hour < endHour; hour++) {
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;
        
        // Check if member has a meeting at this time
        const hasConflict = existingMeetings.some(m => 
          m.host_id === member.id && m.time === timeStr
        );

        if (!hasConflict) {
          if (!hourlyAvailability[timeStr]) {
            hourlyAvailability[timeStr] = [];
          }
          hourlyAvailability[timeStr].push(member.id);
        }
      }
    }

    // Convert to slots format
    const availableSlots = Object.entries(hourlyAvailability)
      .filter(([_, memberIds]) => memberIds.length > 0)
      .map(([time, memberIds]) => ({
        time,
        availableMembers: memberIds.length,
        memberIds
      }))
      .sort((a, b) => a.time.localeCompare(b.time));

    res.json({
      date: dateStr,
      teamId,
      totalMembers: members.length,
      slots: availableSlots
    });
  } catch (error) {
    console.error('Get team availability error:', error);
    res.status(500).json({ error: 'Failed to fetch team availability' });
  }
});

export default router;

