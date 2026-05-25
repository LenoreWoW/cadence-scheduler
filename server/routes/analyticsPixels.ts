/**
 * Analytics Pixels — per-link tracking pixel configs. Exposed via the public
 * booking page so the frontend can drop in GA/GTM/PostHog/Fathom/Plausible
 * snippets at page load.
 */

import { Router, Response, NextFunction, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

const ALLOWED_PROVIDERS = ['ga4', 'gtm', 'posthog', 'fathom', 'plausible'] as const;

function assertOwnsLink(userId: string, linkId: string): void {
  const row = db.connection.prepare(
    `SELECT id FROM booking_links WHERE id = ? AND user_id = ?`
  ).get(linkId, userId) as any;
  if (!row) throw new AppError('Booking link not found', 404);
}

function assertOwnsPixel(userId: string, pixelId: string): { booking_link_id: string } {
  const row = db.connection.prepare(`
    SELECT ap.id, ap.booking_link_id
    FROM analytics_pixels ap
    JOIN booking_links bl ON bl.id = ap.booking_link_id
    WHERE ap.id = ? AND bl.user_id = ?
  `).get(pixelId, userId) as any;
  if (!row) throw new AppError('Analytics pixel not found', 404);
  return row;
}

router.post('/links/:linkId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  assertOwnsLink(req.user!.userId, req.params.linkId);

  const { provider, trackingId, isActive } = req.body ?? {};
  if (!ALLOWED_PROVIDERS.includes(provider)) {
    throw new AppError(`provider must be one of: ${ALLOWED_PROVIDERS.join(', ')}`, 400);
  }
  if (typeof trackingId !== 'string' || trackingId.length < 1 || trackingId.length > 200) {
    throw new AppError('trackingId must be 1-200 characters', 400);
  }
  const active = isActive === undefined ? 1 : (isActive ? 1 : 0);

  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO analytics_pixels (id, booking_link_id, provider, tracking_id, is_active)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.params.linkId, provider, trackingId, active);

  res.status(201).json({ id, provider, trackingId, isActive: !!active });
}));

router.get('/links/:linkId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  assertOwnsLink(req.user!.userId, req.params.linkId);
  const rows = db.connection.prepare(`
    SELECT id, provider, tracking_id, is_active, created_at
    FROM analytics_pixels WHERE booking_link_id = ?
    ORDER BY created_at DESC
  `).all(req.params.linkId) as any[];
  res.json(rows.map(r => ({
    id: r.id,
    provider: r.provider,
    trackingId: r.tracking_id,
    isActive: !!r.is_active,
    createdAt: r.created_at,
  })));
}));

router.put('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  assertOwnsPixel(req.user!.userId, req.params.id);

  const { provider, trackingId, isActive } = req.body ?? {};
  if (provider !== undefined && !ALLOWED_PROVIDERS.includes(provider)) {
    throw new AppError(`provider must be one of: ${ALLOWED_PROVIDERS.join(', ')}`, 400);
  }
  if (trackingId !== undefined && (typeof trackingId !== 'string' || trackingId.length < 1 || trackingId.length > 200)) {
    throw new AppError('trackingId must be 1-200 characters', 400);
  }
  const activeVal = isActive === undefined ? null : (isActive ? 1 : 0);

  db.connection.prepare(`
    UPDATE analytics_pixels SET
      provider = COALESCE(?, provider),
      tracking_id = COALESCE(?, tracking_id),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(provider ?? null, trackingId ?? null, activeVal, req.params.id);

  res.json({ success: true });
}));

router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  assertOwnsPixel(req.user!.userId, req.params.id);
  db.connection.prepare(`DELETE FROM analytics_pixels WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
}));

export default router;
