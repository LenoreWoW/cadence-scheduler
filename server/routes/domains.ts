/**
 * Domain Verification Routes
 *
 * Lets a user register a domain and prove ownership via a DNS TXT record.
 * Once verified, the domain can be used for branded booking pages,
 * custom-domain email-sending, SSO email allowlists, etc.
 */
import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

// List my domains
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = db.connection.prepare(`
      SELECT id, domain, verification_token, method, status, verified_at, created_at
      FROM domain_verifications WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(req.user!.userId) as any[];
    res.json(rows.map(r => ({
      id: r.id,
      domain: r.domain,
      verificationToken: r.verification_token,
      txtRecord: `cadence-verify=${r.verification_token}`,
      method: r.method,
      status: r.status,
      verifiedAt: r.verified_at,
      createdAt: r.created_at,
    })));
  } catch (error) {
    throw new AppError('Failed to fetch domains', 500);
  }
});

// Register a new domain
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { domain } = req.body || {};
    if (typeof domain !== 'string' || domain.length < 4 || domain.length > 253) {
      throw new AppError('Invalid domain', 400);
    }
    const normalized = domain.toLowerCase().trim();
    if (!DOMAIN_RE.test(normalized)) {
      throw new AppError('Invalid domain format', 400);
    }
    // Dedup by (user_id, domain).
    const existing = db.connection.prepare(`
      SELECT id, verification_token, status FROM domain_verifications WHERE user_id = ? AND domain = ?
    `).get(req.user!.userId, normalized) as any;
    if (existing) {
      return res.json({
        id: existing.id,
        domain: normalized,
        verificationToken: existing.verification_token,
        txtRecord: `cadence-verify=${existing.verification_token}`,
        status: existing.status,
      });
    }

    const id = uuidv4();
    const verificationToken = uuidv4().replace(/-/g, '');
    db.connection.prepare(`
      INSERT INTO domain_verifications (id, user_id, domain, verification_token, method, status)
      VALUES (?, ?, ?, ?, 'dns_txt', 'pending')
    `).run(id, req.user!.userId, normalized, verificationToken);

    res.status(201).json({
      id,
      domain: normalized,
      verificationToken,
      txtRecord: `cadence-verify=${verificationToken}`,
      status: 'pending',
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to register domain', 500);
  }
});

// Trigger DNS TXT lookup + flip status to verified when the token shows up.
router.post('/:id/verify', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const row = db.connection.prepare(`
      SELECT * FROM domain_verifications WHERE id = ? AND user_id = ?
    `).get(id, req.user!.userId) as any;
    if (!row) throw new AppError('Domain not found', 404);
    if (row.status === 'verified') {
      return res.json({ status: 'verified', verifiedAt: row.verified_at });
    }

    let found = false;
    try {
      // dns.resolveTxt returns string[][] — one inner array per TXT record.
      const dns = await import('dns/promises');
      // Manual race against a 5s timeout so we don't block on a slow resolver.
      const lookup = dns.resolveTxt(row.domain);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DNS lookup timed out')), 5000)
      );
      const records = await Promise.race([lookup, timeout]) as string[][];
      for (const rec of records) {
        const joined = rec.join('');
        if (joined.includes(`cadence-verify=${row.verification_token}`)) {
          found = true;
          break;
        }
      }
    } catch (e: any) {
      // ENOTFOUND / ENODATA — domain has no TXT records yet. Surface as 422.
      return res.status(422).json({
        verified: false,
        error: e?.message || 'DNS lookup failed',
        expected: `cadence-verify=${row.verification_token}`,
      });
    }

    if (!found) {
      return res.status(422).json({
        verified: false,
        error: 'TXT record not found',
        expected: `cadence-verify=${row.verification_token}`,
      });
    }

    db.connection.prepare(`
      UPDATE domain_verifications SET status = 'verified', verified_at = datetime('now') WHERE id = ?
    `).run(id);

    res.json({ verified: true, status: 'verified' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to verify domain', 500);
  }
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = db.connection.prepare(
      `DELETE FROM domain_verifications WHERE id = ? AND user_id = ?`
    ).run(req.params.id, req.user!.userId);
    if (result.changes === 0) throw new AppError('Domain not found', 404);
    res.json({ message: 'Domain deleted' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete domain', 500);
  }
});

export default router;
