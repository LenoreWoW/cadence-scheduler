/**
 * Outbound webhooks management — per-user CRUD of webhook endpoints
 * that receive booking events. The signing secret is returned ONLY on
 * creation; subsequent GETs omit it.
 */

import { Router, Response, NextFunction, Request } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { deliverTestWebhook } from '../services/outboundWebhooks';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_EVENTS = new Set([
  'booking.created',
  'booking.cancelled',
  'booking.rescheduled',
  'booking.approved',
  'booking.rejected',
]);

function validateEvents(events: any): string[] {
  if (!Array.isArray(events)) throw new AppError('events must be an array', 400);
  if (events.length > 20) throw new AppError('Too many events', 400);
  for (const e of events) {
    if (typeof e !== 'string' || !VALID_EVENTS.has(e)) {
      throw new AppError(`Invalid event: ${e}`, 400);
    }
  }
  return events;
}

function validateUrl(url: any): string {
  if (typeof url !== 'string' || url.length === 0 || url.length > 500) {
    throw new AppError('Invalid url', 400);
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new AppError('url must start with http(s)://', 400);
  }
  return url;
}

// POST / — create
router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, url, secret, events } = req.body ?? {};
  if (typeof name !== 'string' || name.length === 0 || name.length > 100) {
    throw new AppError('Invalid name', 400);
  }
  validateUrl(url);
  const validatedEvents = validateEvents(events);
  const finalSecret = typeof secret === 'string' && secret.length > 0
    ? secret
    : crypto.randomBytes(24).toString('hex');

  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO outbound_webhooks (id, user_id, name, url, secret, events, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(id, req.user!.userId, name, url, finalSecret, JSON.stringify(validatedEvents));

  res.status(201).json({
    id, name, url, secret: finalSecret, events: validatedEvents, isActive: true,
  });
}));

// GET / — list (without secret)
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rows = db.connection.prepare(`
    SELECT id, name, url, events, is_active, last_delivery_at, last_status, created_at
    FROM outbound_webhooks WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.user!.userId) as any[];
  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    url: r.url,
    events: JSON.parse(r.events || '[]'),
    isActive: !!r.is_active,
    lastDeliveryAt: r.last_delivery_at,
    lastStatus: r.last_status,
    createdAt: r.created_at,
  })));
}));

// PUT /:id — update
router.put('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const existing = db.connection.prepare(
    `SELECT * FROM outbound_webhooks WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user!.userId) as any;
  if (!existing) throw new AppError('Webhook not found', 404);

  const { name, url, events, isActive } = req.body ?? {};
  let eventsJson: string | null = null;
  if (events !== undefined) eventsJson = JSON.stringify(validateEvents(events));
  if (url !== undefined) validateUrl(url);

  db.connection.prepare(`
    UPDATE outbound_webhooks SET
      name = COALESCE(?, name),
      url = COALESCE(?, url),
      events = COALESCE(?, events),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    name || null,
    url || null,
    eventsJson,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    req.params.id
  );
  res.json({ success: true });
}));

// DELETE /:id
router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = db.connection.prepare(
    `DELETE FROM outbound_webhooks WHERE id = ? AND user_id = ?`
  ).run(req.params.id, req.user!.userId);
  if (result.changes === 0) throw new AppError('Webhook not found', 404);
  res.json({ success: true });
}));

// POST /:id/test — synchronous test delivery
router.post('/:id/test', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const exists = db.connection.prepare(
    `SELECT id FROM outbound_webhooks WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user!.userId);
  if (!exists) throw new AppError('Webhook not found', 404);

  const result = await deliverTestWebhook(req.params.id);
  res.json({ status: result.status, body: result.body });
}));

// GET /:id/deliveries — last 50
router.get('/:id/deliveries', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const exists = db.connection.prepare(
    `SELECT id FROM outbound_webhooks WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user!.userId);
  if (!exists) throw new AppError('Webhook not found', 404);

  const rows = db.connection.prepare(`
    SELECT id, event, status_code, response_body, delivered_at
    FROM webhook_deliveries WHERE webhook_id = ?
    ORDER BY delivered_at DESC LIMIT 50
  `).all(req.params.id) as any[];
  res.json(rows.map(r => ({
    id: r.id,
    event: r.event,
    statusCode: r.status_code,
    responseBody: r.response_body,
    deliveredAt: r.delivered_at,
  })));
}));

export default router;
