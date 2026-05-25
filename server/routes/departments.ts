/**
 * Departments — corporate hierarchy for teams and users.
 *
 * Admin-only CRUD. A department can have a head user, a parent department
 * (for nested hierarchies), and rolls up teams via `teams.department_id`.
 */

import { Router, Response, NextFunction, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

const adminOnly = [authenticateToken, requireRole('admin')];

interface DeptRow {
  id: string;
  name: string;
  description: string | null;
  head_user_id: string | null;
  parent_id: string | null;
  head_name: string | null;
  created_at: string;
}

interface DeptNode {
  id: string;
  name: string;
  description: string | null;
  headUserId: string | null;
  headName: string | null;
  parentId: string | null;
  createdAt: string;
  children: DeptNode[];
  teamCount: number;
  userCount: number;
}

// GET / — list all departments as a flat list AND a tree
router.get('/', ...adminOnly, asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const rows = db.connection.prepare(`
    SELECT d.*, u.name as head_name
    FROM departments d
    LEFT JOIN users u ON u.id = d.head_user_id
    ORDER BY d.name ASC
  `).all() as DeptRow[];

  const teamCounts = new Map<string, number>();
  const userCounts = new Map<string, number>();
  for (const row of db.connection.prepare(
    `SELECT department_id, COUNT(*) as c FROM teams WHERE department_id IS NOT NULL GROUP BY department_id`
  ).all() as any[]) {
    teamCounts.set(row.department_id, row.c);
  }
  for (const row of db.connection.prepare(
    `SELECT department_id, COUNT(*) as c FROM users WHERE department_id IS NOT NULL GROUP BY department_id`
  ).all() as any[]) {
    userCounts.set(row.department_id, row.c);
  }

  const nodes: Record<string, DeptNode> = {};
  for (const r of rows) {
    nodes[r.id] = {
      id: r.id,
      name: r.name,
      description: r.description,
      headUserId: r.head_user_id,
      headName: r.head_name,
      parentId: r.parent_id,
      createdAt: r.created_at,
      teamCount: teamCounts.get(r.id) || 0,
      userCount: userCounts.get(r.id) || 0,
      children: [],
    };
  }
  const tree: DeptNode[] = [];
  for (const node of Object.values(nodes)) {
    if (node.parentId && nodes[node.parentId]) {
      nodes[node.parentId].children.push(node);
    } else {
      tree.push(node);
    }
  }

  res.json({ flat: Object.values(nodes), tree });
}));

// POST / — create
router.post('/', ...adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, headUserId, parentId } = req.body ?? {};
  if (typeof name !== 'string' || name.length === 0 || name.length > 100) {
    throw new AppError('Name is required (1-100 chars)', 400);
  }

  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO departments (id, name, description, head_user_id, parent_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, description || null, headUserId || null, parentId || null);

  res.status(201).json({ id, name, description, headUserId, parentId });
}));

// PUT /:id — update
router.put('/:id', ...adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, headUserId, parentId } = req.body ?? {};
  const existing = db.connection.prepare(`SELECT * FROM departments WHERE id = ?`).get(id) as any;
  if (!existing) throw new AppError('Department not found', 404);

  // Prevent setting parent to self
  if (parentId && parentId === id) throw new AppError('Department cannot be its own parent', 400);

  db.connection.prepare(`
    UPDATE departments SET
      name = COALESCE(?, name),
      description = ?,
      head_user_id = ?,
      parent_id = ?
    WHERE id = ?
  `).run(
    name || null,
    description !== undefined ? description : existing.description,
    headUserId !== undefined ? headUserId : existing.head_user_id,
    parentId !== undefined ? parentId : existing.parent_id,
    id
  );

  res.json({ success: true });
}));

// DELETE /:id — delete (children become orphaned at root)
router.delete('/:id', ...adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = db.connection.prepare(`DELETE FROM departments WHERE id = ?`).run(req.params.id);
  if (result.changes === 0) throw new AppError('Department not found', 404);
  res.json({ success: true });
}));

// POST /:id/move-team — assign a team to this department
router.post('/:id/move-team', ...adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { teamId } = req.body ?? {};
  if (typeof teamId !== 'string' || !teamId) throw new AppError('teamId is required', 400);

  const dept = db.connection.prepare(`SELECT id FROM departments WHERE id = ?`).get(id);
  if (!dept) throw new AppError('Department not found', 404);

  const team = db.connection.prepare(`SELECT id FROM teams WHERE id = ?`).get(teamId);
  if (!team) throw new AppError('Team not found', 404);

  db.connection.prepare(`UPDATE teams SET department_id = ? WHERE id = ?`).run(id, teamId);
  res.json({ success: true });
}));

export default router;
