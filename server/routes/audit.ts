/**
 * Audit log viewer — admins page through `activity_logs` and export to CSV.
 */

import { Router, Response, NextFunction, Request } from 'express';
import { db } from '../database';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

const adminOnly = [authenticateToken, requireRole('admin')];

interface FilterArgs {
  where: string;
  params: any[];
}

function buildFilters(query: any): FilterArgs {
  const where: string[] = [];
  const params: any[] = [];

  if (query.action) {
    where.push(`action = ?`);
    params.push(query.action);
  }
  if (query.userId) {
    where.push(`performed_by = ?`);
    params.push(query.userId);
  }
  if (query.from) {
    where.push(`created_at >= ?`);
    params.push(query.from);
  }
  if (query.to) {
    where.push(`created_at <= ?`);
    params.push(query.to);
  }
  if (query.search) {
    where.push(`(details LIKE ? OR performed_by LIKE ? OR action LIKE ?)`);
    const like = `%${query.search}%`;
    params.push(like, like, like);
  }

  return {
    where: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// GET / — paginated
router.get('/', ...adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1')) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? '50')) || 50));
  const offset = (page - 1) * pageSize;

  const { where, params } = buildFilters(req.query);
  const totalRow = db.connection.prepare(`SELECT COUNT(*) as c FROM activity_logs ${where}`).get(...params) as any;
  const rows = db.connection.prepare(`
    SELECT * FROM activity_logs ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as any[];

  res.json({
    page,
    pageSize,
    total: totalRow.c,
    totalPages: Math.ceil(totalRow.c / pageSize),
    items: rows.map(r => ({
      id: r.id,
      action: r.action,
      details: r.details,
      performedBy: r.performed_by,
      role: r.role,
      createdAt: r.created_at,
    })),
  });
}));

// GET /export.csv — stream CSV
router.get('/export.csv', ...adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { where, params } = buildFilters(req.query);
  const rows = db.connection.prepare(`
    SELECT id, action, details, performed_by, role, created_at
    FROM activity_logs ${where}
    ORDER BY created_at DESC
    LIMIT 100000
  `).all(...params) as any[];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="activity_logs_${Date.now()}.csv"`);
  res.write('id,action,details,performed_by,role,created_at\n');
  for (const r of rows) {
    res.write([r.id, r.action, r.details, r.performed_by, r.role, r.created_at].map(csvEscape).join(',') + '\n');
  }
  res.end();
}));

export default router;
