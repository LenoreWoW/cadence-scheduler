# Deployment guide

Cadence has two deployable pieces: a Vite-built **frontend** (static, deploy anywhere) and an Express **backend** (needs a Node host with persistent disk for SQLite).

## TL;DR checklist

- [ ] Backend host provisioned (Render / Fly / Railway / Heroku-style)
- [ ] Persistent disk mounted at `/data` (or set `DATABASE_PATH`)
- [ ] All required env vars set on the backend host (see below)
- [ ] `JWT_SECRET` is a 32+ byte random string (use `openssl rand -hex 32`)
- [ ] `NODE_ENV=production` set on backend
- [ ] Google OAuth app created, redirect URI registered
- [ ] Microsoft OAuth app created, redirect URI registered
- [ ] Resend API key (or accept console-logged emails)
- [ ] Frontend env: `VITE_API_URL` points to your deployed backend
- [ ] CORS `FRONTEND_URL` on backend matches your frontend origin
- [ ] First production user created via `POST /api/auth/register` (seeder no longer runs in production)

## Required environment variables

### Backend (set on your Node host)

| Var | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` |
| `JWT_SECRET` | yes | Server refuses to boot in prod without this. Use 32+ bytes. |
| `PORT` | no | Defaults to 3001. Most hosts set this for you. |
| `FRONTEND_URL` | yes | Origin of your deployed frontend. CORS allowlist. |
| `DATABASE_PATH` | recommended | Absolute path on persistent disk (e.g. `/data/cadence.db`) |
| `EMAIL_FROM` | yes | `noreply@yourdomain.com` — your verified sender |
| `RESEND_API_KEY` | recommended | Without it, emails log to console only |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | optional | Required for Google Calendar sync |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_REDIRECT_URI` | optional | Required for Outlook sync |
| `SEED_DEMO_DATA` | no | Set to `true` to seed the 6 demo users in production. **Do not do this on a real deployment** unless you're piloting. |

### Frontend (set at Vite build time)

| Var | Required | Notes |
| --- | --- | --- |
| `VITE_API_URL` | yes | Full origin of your backend, no trailing `/api`. e.g. `https://api.cadence.example.com` |

## Backend host options

### Render (recommended for simplicity)

1. New → Web Service → connect this repo
2. Build command: `yarn install --ignore-engines && yarn build`
3. Start command: `node --enable-source-maps server/index.ts` (or use `tsx`: `bunx tsx server/index.ts` after installing tsx)
4. Add a **persistent disk** mounted at `/data` (1GB free tier is plenty to start)
5. Set `DATABASE_PATH=/data/cadence.db` and all other env vars

### Fly.io

```bash
fly launch --no-deploy
# Add a volume:
fly volumes create cadence_data --size 1
# Update fly.toml to mount it at /data
fly secrets set JWT_SECRET=$(openssl rand -hex 32) ...etc
fly deploy
```

### Railway

1. Create a new project from this repo
2. Add a Volume mount at `/data`
3. Set env vars
4. Deploy

### What NOT to use

- **Netlify** — only the frontend deploys here. The Express server has no functions-compatible adapter in this codebase.
- **Vercel serverless** — same reason. Plus SQLite on a serverless filesystem = data wiped on every cold start.
- **Anything without persistent disk** — you'll lose every booking and user on each redeploy.

## Frontend host

Any static host: Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3 + CloudFront.

```bash
yarn build       # outputs dist/
```

SPA routing: serve `index.html` for any non-asset path. The `netlify.toml` already does this; Vercel's defaults handle it; on Cloudflare Pages, add a `_redirects` file with `/* /index.html 200`.

## OAuth setup

### Google Calendar

1. https://console.cloud.google.com/apis/credentials → Create OAuth client ID → Web application
2. Authorized redirect URI: `${BACKEND_URL}/api/calendar/google/callback`
3. Enable the Google Calendar API in APIs & Services
4. Copy client ID + secret into backend env
5. Scopes the app requests: `https://www.googleapis.com/auth/calendar.events` + email/profile

### Microsoft Outlook

1. https://portal.azure.com → Azure Active Directory → App registrations → New
2. Redirect URI (Web): `${BACKEND_URL}/api/calendar/microsoft/callback`
3. Certificates & secrets → New client secret → copy the **Value** (not the ID)
4. API permissions → Add → Microsoft Graph → Delegated → `Calendars.ReadWrite`, `User.Read`, `offline_access`
5. Copy Application (client) ID + secret into backend env

## Database notes

### SQLite on persistent disk

Cadence uses WAL mode. **Backups must include all three files**: `cadence.db`, `cadence.db-wal`, `cadence.db-shm`. The simplest reliable backup is `sqlite3 cadence.db ".backup '/path/to/snapshot.db'"` — that produces a single consistent file. Schedule it via cron.

The schema_migrations table tracks applied migrations idempotently. Manual migrations should INSERT into it.

### Migrating to Postgres later

If you outgrow SQLite, every query in `server/` already uses parameterized statements. The migration path:
1. Pick a Postgres provider (Neon, Supabase Postgres, Railway Postgres)
2. Translate the schema (mostly TEXT → VARCHAR/TEXT, INTEGER stays, foreign keys stay)
3. Swap `better-sqlite3` for `pg` (or `kysely` / `drizzle` for type safety)
4. Migrate data: `sqlite3 cadence.db .dump | <translate> | psql`

This is a 4-8 hour project. Don't do it preemptively; do it when SQLite shows pain.

## Known limitations (read before launch)

These are **acceptable risks** documented for transparency. Address as fast-follows.

1. **The main app reads meetings from localStorage; public booking + booking-links write to the server DB.** They don't auto-sync. A booking placed by a public guest lands in SQLite but won't appear on the host's main dashboard until they refresh through the API (and the relevant components — Dashboard, MeetingList — would need updates to fetch from `/api/meetings` instead of `storageService`). This is a known architectural split. The right fix is to rewrite `services/storageService.ts` to call the API for meetings/users/teams and update `index.tsx` to await server data — ~4-8h of careful work and high regression risk for the demo flow. **Deferred to a post-launch follow-up.** For internal pilot use this is acceptable; for external launch, do this work first.
2. **OAuth tokens are stored plaintext in `calendar_connections`.** If your DB file leaks, every connected user's Google + Microsoft refresh tokens are exposed. Encrypt at rest as a fast-follow (libsodium secretbox keyed from `OAUTH_ENC_KEY` env).
3. **No email verification on register.** New accounts go live immediately. Add a verification flow before you accept paying customers.
4. **No password reset flow.** Users who forget passwords need admin intervention.
5. **Activity logs grow unbounded.** Add a retention job before this becomes a problem (~6 months in).
6. **No structured error tracking (Sentry / Datadog).** You'll be debugging from `console.error` only until you add one.
7. **Tests don't compile.** Pre-existing TS errors in `tests/` against renamed types. The suite was broken before this build and is not a regression — just no CI safety net.

## Operational runbook

### "All emails are silent"

Check: `RESEND_API_KEY` set? `EMAIL_FROM` is a verified Resend sender domain? Visit `GET /api/email/status` to see which provider is active.

### "Calendar sync isn't pulling"

Check: backend env has `GOOGLE_CLIENT_*` / `MICROSOFT_CLIENT_*`. Check server logs for sync errors. The background job runs every 15 minutes. Manually trigger via `POST /api/calendar/sync` with the user's JWT.

### "All tokens are invalid after restart"

You're missing `JWT_SECRET` — every restart generated a new one. Set it persistently.

### "Bookings vanished after deploy"

You don't have persistent disk. Set `DATABASE_PATH` to a mounted volume. The `data/` directory inside the deployed bundle is ephemeral.
