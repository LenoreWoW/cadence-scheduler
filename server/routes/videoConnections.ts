/**
 * Video Connections routes
 *
 * Manages per-user video provider credentials (currently Daily.co). Same
 * plaintext-storage policy as the existing OAuth tokens — see README.
 */
import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { getRecordings, isDailyConfigured } from '../services/dailyVideo';

const router = Router();

const SUPPORTED_PROVIDERS = new Set(['daily']);

interface VideoConnectionRow {
  id: string;
  user_id: string;
  provider: string;
  api_key: string | null;
  domain: string | null;
  room_template: string | null;
  enabled: number;
  created_at: string;
}

// List my connections
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = db.connection.prepare(`
      SELECT id, user_id, provider, api_key, domain, room_template, enabled, created_at
      FROM video_connections
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(req.user!.userId) as VideoConnectionRow[];

    res.json(rows.map(r => ({
      id: r.id,
      provider: r.provider,
      domain: r.domain,
      roomTemplate: r.room_template,
      enabled: !!r.enabled,
      hasApiKey: !!r.api_key,
      createdAt: r.created_at,
    })));
  } catch (error) {
    throw new AppError('Failed to fetch video connections', 500);
  }
});

// Upsert a connection
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider, apiKey, domain, roomTemplate } = req.body || {};

    if (typeof provider !== 'string' || !SUPPORTED_PROVIDERS.has(provider)) {
      throw new AppError(`Unsupported provider: ${provider}`, 400);
    }
    if (typeof apiKey !== 'string' || apiKey.length < 8 || apiKey.length > 500) {
      throw new AppError('apiKey is required (8-500 chars)', 400);
    }
    if (domain !== undefined && domain !== null && (typeof domain !== 'string' || domain.length > 200)) {
      throw new AppError('Invalid domain', 400);
    }
    if (roomTemplate !== undefined && roomTemplate !== null && (typeof roomTemplate !== 'string' || roomTemplate.length > 100)) {
      throw new AppError('Invalid roomTemplate', 400);
    }

    const existing = db.connection.prepare(`
      SELECT id FROM video_connections WHERE user_id = ? AND provider = ?
    `).get(req.user!.userId, provider) as any;

    let id: string;
    if (existing) {
      id = existing.id;
      db.connection.prepare(`
        UPDATE video_connections
        SET api_key = ?, domain = ?, room_template = ?, enabled = 1
        WHERE id = ?
      `).run(apiKey, domain || null, roomTemplate || null, id);
    } else {
      id = uuidv4();
      db.connection.prepare(`
        INSERT INTO video_connections (id, user_id, provider, api_key, domain, room_template, enabled)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(id, req.user!.userId, provider, apiKey, domain || null, roomTemplate || null);
    }

    res.status(201).json({
      id,
      provider,
      domain: domain || null,
      roomTemplate: roomTemplate || null,
      enabled: true,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to save video connection', 500);
  }
});

// Delete a connection
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = db.connection.prepare(`
      DELETE FROM video_connections WHERE id = ? AND user_id = ?
    `).run(id, req.user!.userId);
    if (result.changes === 0) throw new AppError('Connection not found', 404);
    res.json({ message: 'Video connection deleted' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete video connection', 500);
  }
});

// List recordings for a meeting/room (Daily only)
router.get('/:id/recordings', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { roomName } = req.query;

    const conn = db.connection.prepare(`
      SELECT * FROM video_connections WHERE id = ? AND user_id = ?
    `).get(id, req.user!.userId) as VideoConnectionRow | undefined;

    if (!conn) throw new AppError('Connection not found', 404);
    if (conn.provider !== 'daily') {
      throw new AppError('Recordings only supported for daily provider', 400);
    }
    if (typeof roomName !== 'string' || roomName.length === 0) {
      throw new AppError('roomName query param is required', 400);
    }
    if (!isDailyConfigured(req.user!.userId)) {
      throw new AppError('Daily.co not configured for this user', 400);
    }

    const recordings = await getRecordings(roomName, req.user!.userId);
    res.json({ recordings });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch recordings', 500);
  }
});

export default router;
