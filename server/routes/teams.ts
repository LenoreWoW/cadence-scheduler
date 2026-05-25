/**
 * Team Management Routes
 * 
 * Permission Matrix:
 * - Admin: Full access to all teams
 * - Manager: Can create teams (becomes leader), manage teams they lead
 * - Subordinate/Guest: View only
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, requireRole, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Helper: Check if user is admin or team leader
function isTeamLeaderOrAdmin(userId: string, userRole: string, teamId: string): boolean {
  if (userRole === 'admin') return true;
  
  const team = db.connection.prepare('SELECT leader_id FROM teams WHERE id = ?').get(teamId) as any;
  return team?.leader_id === userId;
}

// Get all teams (public)
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teams = db.connection.prepare(`
      SELECT t.*, COUNT(u.id) as member_count, leader.name as leader_name
      FROM teams t
      LEFT JOIN users u ON u.team_id = t.id
      LEFT JOIN users leader ON leader.id = t.leader_id
      GROUP BY t.id
      ORDER BY t.name ASC
    `).all() as any[];

    res.json(teams.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      image: t.image,
      leaderId: t.leader_id,
      leaderName: t.leader_name,
      memberCount: t.member_count,
      createdAt: t.created_at,
      updatedAt: t.updated_at
    })));
  } catch (error) {
    throw new AppError('Failed to fetch teams', 500);
  }
});

// Get single team with members
router.get('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const team = db.connection.prepare(`
      SELECT t.*, leader.name as leader_name
      FROM teams t
      LEFT JOIN users leader ON leader.id = t.leader_id
      WHERE t.id = ?
    `).get(req.params.id) as any;
    
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    const members = db.connection.prepare(`
      SELECT id, username, name, role, title, avatar
      FROM users WHERE team_id = ?
    `).all(req.params.id) as any[];

    res.json({
      id: team.id,
      name: team.name,
      color: team.color,
      image: team.image,
      leaderId: team.leader_id,
      leaderName: team.leader_name,
      members: members.map(m => ({
        id: m.id,
        username: m.username,
        name: m.name,
        role: m.role,
        title: m.title,
        avatar: m.avatar
      })),
      createdAt: team.created_at,
      updatedAt: team.updated_at
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch team', 500);
  }
});

// Create team (admin or manager - managers become team leaders)
router.post('/', authenticateToken, requireRole('admin', 'manager'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, color, image } = req.body;

    if (!name) {
      throw new AppError('Team name is required', 400);
    }

    const teamId = uuidv4();
    const user = req.user!;
    
    // Managers automatically become leaders of teams they create
    const leaderId = user.role === 'manager' ? user.userId : null;

    db.connection.prepare(`
      INSERT INTO teams (id, name, color, image, leader_id) VALUES (?, ?, ?, ?, ?)
    `).run(teamId, name, color || '#8A1538', image || null, leaderId);

    res.status(201).json({
      id: teamId,
      name,
      color: color || '#8A1538',
      image,
      leaderId
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create team', 500);
  }
});

// Update team (admin can update any, managers can update their own teams)
router.put('/:id', authenticateToken, requireRole('admin', 'manager'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, color, image, leaderId } = req.body;
    const user = req.user!;

    const existing = db.connection.prepare('SELECT id, leader_id FROM teams WHERE id = ?').get(id) as any;
    if (!existing) {
      throw new AppError('Team not found', 404);
    }

    // Check permission: admin can update any, managers only their own teams
    if (!isTeamLeaderOrAdmin(user.userId, user.role, id)) {
      throw new AppError('You can only update teams you lead', 403);
    }

    // Only admins can change the leader
    const newLeaderId = user.role === 'admin' ? (leaderId !== undefined ? leaderId : existing.leader_id) : existing.leader_id;

    db.connection.prepare(`
      UPDATE teams SET
        name = COALESCE(?, name),
        color = COALESCE(?, color),
        image = COALESCE(?, image),
        leader_id = ?,
        updated_at = ?
      WHERE id = ?
    `).run(name, color, image, newLeaderId, new Date().toISOString(), id);

    res.json({ message: 'Team updated' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update team', 500);
  }
});

// Delete team (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = db.connection.prepare('DELETE FROM teams WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      throw new AppError('Team not found', 404);
    }

    // Unassign users from deleted team
    db.connection.prepare('UPDATE users SET team_id = NULL WHERE team_id = ?').run(id);

    res.json({ message: 'Team deleted' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete team', 500);
  }
});

// Add member to team (admin or team leader)
router.post('/:id/members', authenticateToken, requireRole('admin', 'manager'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const currentUser = req.user!;

    const team = db.connection.prepare('SELECT id, leader_id FROM teams WHERE id = ?').get(id) as any;
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    // Check permission
    if (!isTeamLeaderOrAdmin(currentUser.userId, currentUser.role, id)) {
      throw new AppError('You can only add members to teams you lead', 403);
    }

    const targetUser = db.connection.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      throw new AppError('User not found', 404);
    }

    db.connection.prepare('UPDATE users SET team_id = ? WHERE id = ?').run(id, userId);

    res.json({ message: 'Member added to team' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to add member', 500);
  }
});

// Remove member from team (admin or team leader)
router.delete('/:id/members/:userId', authenticateToken, requireRole('admin', 'manager'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, userId } = req.params;
    const currentUser = req.user!;

    // Check permission
    if (!isTeamLeaderOrAdmin(currentUser.userId, currentUser.role, id)) {
      throw new AppError('You can only remove members from teams you lead', 403);
    }

    const targetUser = db.connection.prepare('SELECT team_id FROM users WHERE id = ?').get(userId) as any;
    if (!targetUser || targetUser.team_id !== id) {
      throw new AppError('User is not in this team', 400);
    }

    db.connection.prepare('UPDATE users SET team_id = NULL WHERE id = ?').run(userId);

    res.json({ message: 'Member removed from team' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to remove member', 500);
  }
});

export default router;
