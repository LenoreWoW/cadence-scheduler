/**
 * Routing Forms Routes
 *
 * Cal.com-style routing forms. An owner builds a form (a sequence of
 * questions + a list of rules). A public submission walks the rules in
 * order, picks the first match, and returns the resulting routing target
 * (a user or a booking link slug). The booking flow can then redirect to
 * the right page and pass the submissionId back so we can stitch it to
 * the resulting meeting.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// ---------- helpers ----------

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const VALID_FIELD_TYPES = new Set(['text', 'textarea', 'select', 'checkbox', 'radio', 'email']);
const VALID_OPS = new Set(['equals', 'not_equals', 'contains', 'gt', 'lt']);
const VALID_ACTION_TYPES = new Set(['route_to_user', 'route_to_link']);

interface Question {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

interface Rule {
  id: string;
  conditions: Array<{ fieldId: string; op: string; value: any }>;
  action: { type: string; target: string };
}

function validateFields(input: any): Question[] {
  if (!Array.isArray(input)) throw new AppError('fields must be an array', 400);
  if (input.length > 20) throw new AppError('Up to 20 fields allowed', 400);
  const out: Question[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') throw new AppError('Invalid field entry', 400);
    const label = typeof raw.label === 'string' ? raw.label.trim() : '';
    if (label.length < 1 || label.length > 200) {
      throw new AppError('Field label must be 1-200 characters', 400);
    }
    const type = typeof raw.type === 'string' ? raw.type : 'text';
    if (!VALID_FIELD_TYPES.has(type)) {
      throw new AppError(`Invalid field type: ${type}`, 400);
    }
    let options: string[] | undefined;
    if (type === 'select' || type === 'radio') {
      if (!Array.isArray(raw.options) || raw.options.length === 0) {
        throw new AppError(`Field type ${type} requires options`, 400);
      }
      if (raw.options.length > 20) {
        throw new AppError('Up to 20 options per field', 400);
      }
      options = raw.options.map((o: any) => String(o).slice(0, 200));
    }
    out.push({
      id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id.slice(0, 64) : uuidv4(),
      label,
      type,
      required: !!raw.required,
      options,
      placeholder: typeof raw.placeholder === 'string' ? raw.placeholder.slice(0, 200) : undefined,
    });
  }
  return out;
}

function validateRules(input: any, fieldIds: Set<string>): Rule[] {
  if (!Array.isArray(input)) throw new AppError('routingRules must be an array', 400);
  if (input.length > 20) throw new AppError('Up to 20 rules allowed', 400);
  const out: Rule[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') throw new AppError('Invalid rule entry', 400);
    const action = raw.action;
    if (!action || typeof action !== 'object' || !VALID_ACTION_TYPES.has(action.type)) {
      throw new AppError('Each rule needs a valid action.type', 400);
    }
    if (typeof action.target !== 'string' || action.target.length < 1 || action.target.length > 200) {
      throw new AppError('Each rule action needs a target', 400);
    }
    const conditions = Array.isArray(raw.conditions) ? raw.conditions : [];
    if (conditions.length > 10) throw new AppError('Up to 10 conditions per rule', 400);
    for (const c of conditions) {
      if (!c || typeof c !== 'object') throw new AppError('Invalid condition', 400);
      if (typeof c.fieldId !== 'string' || !fieldIds.has(c.fieldId)) {
        throw new AppError(`Condition references unknown fieldId: ${c.fieldId}`, 400);
      }
      if (!VALID_OPS.has(c.op)) {
        throw new AppError(`Invalid condition op: ${c.op}`, 400);
      }
    }
    out.push({
      id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id.slice(0, 64) : uuidv4(),
      conditions: conditions.map((c: any) => ({ fieldId: c.fieldId, op: c.op, value: c.value })),
      action: { type: action.type, target: action.target.slice(0, 200) },
    });
  }
  return out;
}

function evaluateCondition(actual: any, op: string, expected: any): boolean {
  switch (op) {
    case 'equals': return actual == expected;
    case 'not_equals': return actual != expected;
    case 'contains':
      if (typeof actual === 'string' && typeof expected === 'string') return actual.toLowerCase().includes(expected.toLowerCase());
      if (Array.isArray(actual)) return actual.includes(expected);
      return false;
    case 'gt': return Number(actual) > Number(expected);
    case 'lt': return Number(actual) < Number(expected);
    default: return false;
  }
}

function mapFormRow(row: any): any {
  return {
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id,
    bookingLinkId: row.booking_link_id,
    name: row.name,
    description: row.description,
    fields: safeParse(row.fields, []),
    routingRules: safeParse(row.routing_rules, []),
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function safeParse<T>(s: any, fallback: T): T {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}

// ---------- authed CRUD ----------

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, fields, routingRules, bookingLinkId, teamId } = req.body ?? {};

  if (typeof name !== 'string' || name.length < 1 || name.length > 200) {
    throw new AppError('Form name must be 1-200 characters', 400);
  }
  if (description !== undefined && description !== null && (typeof description !== 'string' || description.length > 2000)) {
    throw new AppError('description too long', 400);
  }

  const validatedFields = validateFields(fields ?? []);
  const fieldIds = new Set(validatedFields.map(f => f.id));
  const validatedRules = validateRules(routingRules ?? [], fieldIds);

  // Validate optional refs.
  if (bookingLinkId) {
    const ok = db.connection.prepare(`SELECT id FROM booking_links WHERE id = ? AND user_id = ?`).get(bookingLinkId, req.user!.userId);
    if (!ok) throw new AppError('bookingLinkId not found or not owned by user', 400);
  }

  const id = uuidv4();
  db.connection.prepare(`
    INSERT INTO routing_forms (id, user_id, team_id, booking_link_id, name, description, fields, routing_rules, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    req.user!.userId,
    teamId || null,
    bookingLinkId || null,
    name.trim(),
    description ?? null,
    JSON.stringify(validatedFields),
    JSON.stringify(validatedRules)
  );

  const row = db.connection.prepare(`SELECT * FROM routing_forms WHERE id = ?`).get(id);
  res.status(201).json(mapFormRow(row));
});

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const rows = db.connection.prepare(
    `SELECT * FROM routing_forms WHERE user_id = ? ORDER BY created_at DESC`
  ).all(req.user!.userId) as any[];
  res.json(rows.map(mapFormRow));
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const row = db.connection.prepare(
    `SELECT * FROM routing_forms WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user!.userId) as any;
  if (!row) throw new AppError('Routing form not found', 404);
  res.json(mapFormRow(row));
});

router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const existing = db.connection.prepare(
    `SELECT * FROM routing_forms WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user!.userId) as any;
  if (!existing) throw new AppError('Routing form not found', 404);

  const { name, description, fields, routingRules, isActive, bookingLinkId, teamId } = req.body ?? {};

  let nextName = existing.name;
  if (name !== undefined) {
    if (typeof name !== 'string' || name.length < 1 || name.length > 200) {
      throw new AppError('Form name must be 1-200 characters', 400);
    }
    nextName = name.trim();
  }
  let nextDescription = existing.description;
  if (description !== undefined) {
    if (description !== null && (typeof description !== 'string' || description.length > 2000)) {
      throw new AppError('description too long', 400);
    }
    nextDescription = description;
  }

  let nextFields = existing.fields;
  let nextRules = existing.routing_rules;
  if (fields !== undefined) {
    const validated = validateFields(fields);
    nextFields = JSON.stringify(validated);
    // If only fields changed but rules weren't sent, re-validate existing rules against new field ids.
    if (routingRules === undefined) {
      const ids = new Set(validated.map(f => f.id));
      try {
        const prevRules = safeParse<Rule[]>(existing.routing_rules, []);
        const stillValid = prevRules.every(r =>
          r.conditions.every(c => ids.has(c.fieldId))
        );
        if (!stillValid) {
          throw new AppError('Existing rules reference removed field ids — submit routingRules together with fields', 400);
        }
      } catch (e) {
        if (e instanceof AppError) throw e;
      }
    }
  }
  if (routingRules !== undefined) {
    const fieldsObj = safeParse<Question[]>(nextFields, []);
    const ids = new Set(fieldsObj.map(f => f.id));
    nextRules = JSON.stringify(validateRules(routingRules, ids));
  }

  if (bookingLinkId !== undefined && bookingLinkId !== null) {
    const ok = db.connection.prepare(`SELECT id FROM booking_links WHERE id = ? AND user_id = ?`).get(bookingLinkId, req.user!.userId);
    if (!ok) throw new AppError('bookingLinkId not found or not owned by user', 400);
  }

  db.connection.prepare(`
    UPDATE routing_forms SET
      name = ?,
      description = ?,
      fields = ?,
      routing_rules = ?,
      is_active = COALESCE(?, is_active),
      booking_link_id = ?,
      team_id = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    nextName,
    nextDescription,
    nextFields,
    nextRules,
    isActive === undefined ? null : (isActive ? 1 : 0),
    bookingLinkId === undefined ? existing.booking_link_id : (bookingLinkId || null),
    teamId === undefined ? existing.team_id : (teamId || null),
    req.params.id
  );

  const row = db.connection.prepare(`SELECT * FROM routing_forms WHERE id = ?`).get(req.params.id);
  res.json(mapFormRow(row));
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const result = db.connection.prepare(
    `DELETE FROM routing_forms WHERE id = ? AND user_id = ?`
  ).run(req.params.id, req.user!.userId);
  if (result.changes === 0) throw new AppError('Routing form not found', 404);
  res.json({ message: 'Routing form deleted' });
});

// ---------- public submission ----------

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.ip}:${req.params.id}`,
  message: { error: 'Too many submissions. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/public/:id', asyncHandler(async (req: Request, res: Response) => {
  const row = db.connection.prepare(
    `SELECT id, name, description, fields, is_active FROM routing_forms WHERE id = ?`
  ).get(req.params.id) as any;
  if (!row || !row.is_active) throw new AppError('Form not found', 404);
  res.json({
    id: row.id,
    name: row.name,
    description: row.description,
    fields: safeParse(row.fields, []),
  });
}));

router.post('/public/:id/submit', submitLimiter, asyncHandler(async (req: Request, res: Response) => {
  const formId = req.params.id;
  const row = db.connection.prepare(`SELECT * FROM routing_forms WHERE id = ?`).get(formId) as any;
  if (!row || !row.is_active) throw new AppError('Form not found', 404);

  const fields = safeParse<Question[]>(row.fields, []);
  const rules = safeParse<Rule[]>(row.routing_rules, []);

  const answers = req.body?.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new AppError('answers must be an object', 400);
  }

  // Validate required + types + size.
  for (const f of fields) {
    const a = (answers as any)[f.id];
    if (f.required && (a === undefined || a === null || a === '')) {
      throw new AppError(`Missing required answer for ${f.label}`, 400);
    }
    if (a !== undefined && a !== null) {
      if (typeof a === 'string' && a.length > 2000) {
        throw new AppError(`Answer too long for ${f.label}`, 400);
      }
      if (f.type === 'email' && typeof a === 'string' && a) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) {
          throw new AppError(`Invalid email for ${f.label}`, 400);
        }
      }
    }
  }

  // Walk rules in order. A rule with no conditions acts as a fallback.
  let chosen: Rule | null = null;
  for (const rule of rules) {
    if (!rule.conditions || rule.conditions.length === 0) continue; // skip fallbacks on first pass
    const allMatch = rule.conditions.every(c =>
      evaluateCondition((answers as any)[c.fieldId], c.op, c.value)
    );
    if (allMatch) {
      chosen = rule;
      break;
    }
  }
  if (!chosen) {
    // Fallback: last rule with no conditions, if any.
    for (let i = rules.length - 1; i >= 0; i--) {
      if (!rules[i].conditions || rules[i].conditions.length === 0) {
        chosen = rules[i];
        break;
      }
    }
  }

  // Best-effort attendee email pulled from answers.
  let attendeeEmail: string | null = null;
  for (const f of fields) {
    if (f.type === 'email') {
      const v = (answers as any)[f.id];
      if (typeof v === 'string') attendeeEmail = v.slice(0, 254);
      break;
    }
  }

  // Resolve target → display name + URL.
  let displayName: string | null = null;
  let bookingUrl: string | null = null;
  let routedUserId: string | null = null;
  let routedLinkSlug: string | null = null;
  let target: { target: 'user' | 'link'; userId?: string; slug?: string; name?: string } | null = null;

  if (chosen) {
    if (chosen.action.type === 'route_to_user') {
      const user = db.connection.prepare(`SELECT id, name FROM users WHERE id = ?`).get(chosen.action.target) as any;
      if (user) {
        routedUserId = user.id;
        displayName = user.name;
        // Look up the user's first active personal booking link for a URL.
        const firstLink = db.connection.prepare(
          `SELECT slug FROM booking_links WHERE user_id = ? AND is_active = 1 ORDER BY created_at ASC LIMIT 1`
        ).get(user.id) as any;
        if (firstLink) bookingUrl = `/book/${firstLink.slug}`;
        target = { target: 'user', userId: user.id, name: user.name };
      }
    } else if (chosen.action.type === 'route_to_link') {
      const slug = chosen.action.target;
      const link = db.connection.prepare(
        `SELECT bl.slug, bl.title, u.name as host_name FROM booking_links bl JOIN users u ON bl.user_id = u.id WHERE bl.slug = ? AND bl.is_active = 1`
      ).get(slug) as any;
      if (link) {
        routedLinkSlug = link.slug;
        displayName = link.title || link.host_name;
        bookingUrl = `/book/${link.slug}`;
        target = { target: 'link', slug: link.slug, name: displayName ?? undefined };
      } else {
        // Try team link too.
        const team = db.connection.prepare(
          `SELECT slug, title FROM team_booking_links WHERE slug = ? AND is_active = 1`
        ).get(slug) as any;
        if (team) {
          routedLinkSlug = team.slug;
          displayName = team.title;
          bookingUrl = `/book/team/${team.slug}`;
          target = { target: 'link', slug: team.slug, name: team.title };
        }
      }
    }
  }

  const submissionId = uuidv4();
  db.connection.prepare(`
    INSERT INTO routing_form_submissions (id, form_id, answers, routed_to_user_id, routed_to_link_slug, attendee_email)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    submissionId,
    formId,
    JSON.stringify(answers),
    routedUserId,
    routedLinkSlug,
    attendeeEmail
  );

  res.json({
    submissionId,
    target,
    displayName,
    bookingUrl,
  });
}));

export default router;
