# LDAP / Custom Auth Integration Guide

Cadence ships with username + password auth backed by bcrypt + JWT. Everything else (the app shell, all features, all roles) works against `req.user.{userId, username, role}` regardless of how that user object was created.

If you want to plug in LDAP, Active Directory, Clerk, Auth0, Okta, or anything else, **you only touch two files** — the rest of the codebase doesn't care how authentication happens.

---

## What you keep

The whole token machinery — JWT signing, refresh rotation, the `authenticateToken` middleware, the `req.user` shape — stays. You don't need to change any other route. You don't need to update any component. You don't need to migrate the database.

The contract for `req.user` is:

```ts
{ userId: string, username: string, role: 'admin' | 'manager' | 'subordinate' | 'guest' }
```

If your auth layer produces that, every route in Cadence works unmodified.

---

## Integration points

### Option 1 — replace the password check (~30 minutes)

Easiest. You keep Cadence's JWT issuance but swap `bcrypt.compare(...)` with your LDAP bind.

**File:** `server/routes/auth.ts`, `POST /login` handler (~line 15).

```ts
// BEFORE
const validPassword = await bcrypt.compare(password, user.password_hash);
if (!validPassword) {
  throw new AppError('Invalid credentials', 401);
}

// AFTER (LDAP bind)
import ldap from 'ldapjs';   // npm/yarn add ldapjs

const client = ldap.createClient({ url: process.env.LDAP_URL });
await new Promise<void>((resolve, reject) => {
  client.bind(`uid=${username},${process.env.LDAP_BASE_DN}`, password, (err) => {
    client.unbind();
    if (err) reject(new AppError('Invalid credentials', 401));
    else resolve();
  });
});
```

That's it. The rest of the `POST /login` handler — looking up or creating the user row, issuing JWT tokens, login-streak math, XP awards — keeps working.

If your LDAP user doesn't exist in Cadence's `users` table yet, the existing `db.connection.prepare('SELECT … WHERE username = ?').get(username)` returns nothing. You'd want to either:

a) **Auto-provision on first login** — insert a row with role `subordinate` (or whatever default makes sense) when LDAP authenticates a user we don't have yet.
b) **Pre-provision via SCIM/admin tool** — use the existing `POST /api/admin/users/bulk-import` endpoint.

### Option 2 — replace the entire login flow (~2 hours)

If you want LDAP / SSO / Clerk to be the sole auth path, write a new endpoint that issues JWTs from external identity claims.

**Example: Clerk integration.**

Create a new file `server/routes/auth-clerk.ts`:

```ts
import { Router } from 'express';
import { generateTokens } from '../middleware/auth';
import { db } from '../database';
// import { verifyClerkSession } from '@clerk/backend';   // (re-add clerk dep)

const router = Router();

router.post('/clerk-sync', async (req, res) => {
  const clerkSession = req.headers['authorization']?.split(' ')[1];
  const claims = await verifyClerkSession(clerkSession);   // your verification

  // Find or create the Cadence user
  let user = db.connection.prepare(
    'SELECT * FROM users WHERE username = ?'
  ).get(claims.username);

  if (!user) {
    db.connection.prepare(`
      INSERT INTO users (id, username, name, email, role, password_hash)
      VALUES (?, ?, ?, ?, 'subordinate', 'external-auth')
    `).run(claims.sub, claims.username, claims.name, claims.email);
    user = { id: claims.sub, username: claims.username, role: 'subordinate' };
  }

  const tokens = generateTokens({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  res.json({ user, ...tokens });
});

export default router;
```

Wire in `server/index.ts`:

```ts
import clerkAuthRoutes from './routes/auth-clerk';
app.use('/api/auth', clerkAuthRoutes);
```

On the frontend (`services/authService.ts`), call your Clerk sync instead of `/api/auth/login`.

### Option 3 — middleware-only (advanced, ~1 day)

If you want to keep using your IdP's tokens directly (without exchanging them for Cadence JWTs), edit `server/middleware/auth.ts`:

```ts
export async function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  // Try LDAP/Clerk/whatever first
  try {
    const claims = await yourIdp.verify(token);
    req.user = { userId: claims.sub, username: claims.username, role: claims.role };
    return next();
  } catch { /* fall through */ }

  // Fall back to Cadence JWT
  const payload = verifyToken(token);
  if (!payload) return res.status(403).json({ error: 'Invalid token' });
  req.user = payload;
  next();
}
```

This way both auth systems coexist.

---

## Where roles come from

Cadence has four roles: `admin`, `manager`, `subordinate`, `guest`. These gate access in many routes (`requireRole(...)`).

When you provision users from LDAP, you must decide which Cadence role they map to. Common pattern:

| LDAP group | Cadence role |
| --- | --- |
| `cn=domain-admins` | admin |
| `cn=managers` or any group with `cn=*-leader` | manager |
| Anything else | subordinate |

You can store the mapping in code or in a small `ldap_role_mapping` table. The role lives on `users.role` and is read on every login to refresh the JWT claim.

---

## What's already wired

These things work out of the box and your LDAP integration doesn't need to touch them:

- **Refresh token rotation** — your JWT will expire in 15min, the frontend auto-refreshes via `services/api.ts`. You only need to make sure `generateTokens()` is called on login.
- **PAT (Personal Access Token) auth** — works alongside JWT. Users can mint `cad_pat_…` tokens at `/api/api-tokens` for external integrations (Zapier, CLI, etc.). The middleware accepts both.
- **SSO via Google** — already implemented at `/api/sso/google/login`. Reuses the same JWT issuance. If your friend's LDAP also supports OIDC, plugging it in is half a day.
- **Webhook delivery, calendar sync, reminder scheduler, etc.** — all server-side jobs use `req.user.userId` as the actor. No identity-provider-specific logic.

---

## Quick handoff checklist

What your friend needs to do to integrate LDAP:

- [ ] Decide between Option 1 (replace password check) or Option 2 (new endpoint).
- [ ] Add LDAP library to `package.json` (`ldapjs` or `passport-ldapauth`).
- [ ] Add env vars: `LDAP_URL`, `LDAP_BASE_DN`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`.
- [ ] Implement the chosen swap in `server/routes/auth.ts`.
- [ ] Decide role mapping (LDAP group → Cadence role).
- [ ] If using Option 1 and you want SSO: keep the existing `/api/sso/google/login` working — they coexist fine.
- [ ] Disable the demo seeder in production (already done — gated by `NODE_ENV !== 'production'`).
- [ ] Set `JWT_SECRET` in production env (server hard-fails without it).

That's the whole list. The rest of the app — every feature, every role, every UI — works the moment LDAP returns success.

---

## Smoke-test the current build (without LDAP)

To verify everything works before swapping auth:

```bash
yarn install --ignore-engines
JWT_SECRET=dev-test-32-bytes-aaaaaaaaaaaaaaaa yarn server          # backend on :3001
yarn dev                                                            # frontend on :5173
```

Open `http://localhost:5173/login`, sign in with `admin / password`. You should land on the dashboard with the XP badge in the header.

Test endpoints with curl:

```bash
# Login → get token
TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  http://localhost:3001/api/auth/login | jq -r .accessToken)

# Try a protected endpoint
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/gamification/me
# Should return XP, level, totals.

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/admin/health
# Should return DB row counts, scheduler status.
```

If those work, the app is ready to receive an LDAP integration.
