# Cadence

> Corporate meeting scheduler — Calendly-class public booking with team management, gamification, and an enterprise-ready security baseline. Bilingual (English + Arabic, RTL).

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](#) [![Stack](https://img.shields.io/badge/stack-React%2019%20%2B%20Express%20%2B%20SQLite-blue)](#) [![License](https://img.shields.io/badge/license-Proprietary-lightgrey)](#license)

---

## Features

### Scheduling
- Public booking links at `/book/:slug` and `/book/team/:slug`
- Two-way calendar sync with Google Calendar and Microsoft Outlook (OAuth)
- Buffer time, min-notice, working hours, time-off, daily booking caps, expiration, bookable-window cap
- Per-link availability overrides, custom questions, group events (slot capacity), approval-required mode
- ICS attachments + Add-to-Calendar buttons (Google / Outlook / Apple) on every confirmation
- Tokenized reschedule / cancel link in emails — no account required
- iCal subscription feed per user
- Embed widget — iframe and `<script>` snippets for external sites
- Multi-language emails (EN + AR)

### Team management
- Roles: admin / manager / subordinate / guest
- Team booking links with round-robin distribution honoring availability + external calendars
- Email-based team invitations
- Departments with `parent_id` hierarchy
- Room / equipment resource booking with conflict detection
- Team availability dashboard (week grid)
- Approval workflows (subordinate → manager queue)
- Bulk user CSV import (500 / batch)

### Gamification
- Server-synced XP + 11-level progression with in-app level-up notifications
- Achievements (bilingual descriptions)
- Global / team / individual leaderboards + team-vs-team competition
- Weekly challenges with progress tracking and XP rewards
- Login-streak tracking

### Corporate / enterprise
- SSO via Google OIDC
- Personal Access Tokens (`cad_pat_…`, SHA-256 at rest, Bearer-compatible)
- Outbound webhooks with HMAC-SHA256 signing for `booking.*` events
- Audit log with filter / pagination / CSV export
- System health dashboard (DB size, row counts, scheduler status)
- Privacy + ToS pages, cookie consent banner
- Data export (JSON dump) + account deletion (anonymizes, preserves FK integrity)
- File attachments on meetings (5 MB cap, MIME whitelist)
- Daily retention job (activity logs, webhook deliveries, read notifications)
- Helmet CSP, body limits, per-route rate limits
- Password reset (enumeration-safe, 1h tokens)

---

## Stack

| Layer | Tech |
| --- | --- |
| UI | React 19, Vite 6, Tailwind, Framer Motion, React Three Fiber |
| State | localStorage cache + REST API (`services/api.ts` fetch wrapper with auto-refresh) |
| API | Express 4, JWT (15min access + 7d refresh) + PAT, Helmet CSP, express-rate-limit |
| DB | SQLite (WAL) via better-sqlite3, migration tracking in `schema_migrations` |
| Email | Resend SDK with Console fallback, multi-lang templates |
| Calendar | Raw `fetch` against Google Calendar v3 + Microsoft Graph |

---

## Quick start

Requires **Node 22+** (Node 20 works with `--ignore-engines` on yarn).

```bash
yarn install --ignore-engines
cp env.example.txt .env
# Edit .env — at minimum set JWT_SECRET to a random 32+ byte string
yarn server:dev   # backend on :3001
yarn dev          # frontend on :5173
```

Open [http://localhost:5173](http://localhost:5173). Demo credentials (dev only — seeder skipped in production):

| Username | Role |
| --- | --- |
| `admin` | admin |
| `manager`, `sarah`, `khalid` | manager |
| `sub` | subordinate |
| `user1` | guest |

Password for all demo accounts: `password`.

### Smoke-test the API

```bash
TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  http://localhost:3001/api/auth/login | jq -r .accessToken)

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/gamification/me
```

---

## Project layout

```
.
├── components/           React components
├── hooks/                React hooks
├── services/             Frontend services (api, auth, calendar, email)
├── server/
│   ├── index.ts          Express bootstrap, route registration
│   ├── database.ts       SQLite schema + migration runner
│   ├── routes/           HTTP handlers
│   ├── services/         Backend logic (calendarSync, emailProvider, icsGenerator, bookingEmails, etc.)
│   ├── jobs/             Background jobs (reminderScheduler, calendarSyncJob, retentionJob)
│   ├── middleware/       Auth (JWT + PAT), errors, logging
│   └── utils/            signedState (HMAC), helpers
└── public/               Static assets + service worker
```

---

## Configuration

All environment variables are documented in [`env.example.txt`](./env.example.txt). The essentials:

| Var | Purpose |
| --- | --- |
| `JWT_SECRET` | Required in production. 32+ random bytes (`openssl rand -hex 32`). |
| `FRONTEND_URL` | Origin of your deployed frontend — CORS allowlist. |
| `DATABASE_PATH` | Absolute path for SQLite file on persistent disk. |
| `EMAIL_FROM` | Verified sender for transactional email. |
| `RESEND_API_KEY` | Without it, emails log to console only. |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | Required for Google Calendar sync + SSO. |
| `MICROSOFT_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | Required for Outlook sync. |
| `VITE_API_URL` | Frontend build var — full origin of your backend. |

Sample deploy configs are included for **Render** (`render.yaml`), **Fly.io** (`fly.toml`), and **Docker** (`Dockerfile`).

### Plug-and-play SMTP

Cadence ships with Resend by default, but you can route transactional email through **any standard SMTP provider** — corporate Exchange, AWS SES, Mailgun, SendGrid, Postmark, Office 365, Gmail App Passwords, you name it.

Just set the following environment variables and the email provider auto-detects SMTP — **no code changes required**. SMTP, when configured, takes precedence over Resend.

| Var | Example | Notes |
| --- | --- | --- |
| `SMTP_HOST` | `smtp.your-provider.com` | Host of your SMTP server. |
| `SMTP_PORT` | `587` | Usually 587 (STARTTLS) or 465 (TLS). |
| `SMTP_USER` | `apikey` or your username | Auth identity. |
| `SMTP_PASS` | `••••••••` | App password / API key. |
| `EMAIL_FROM` | `Cadence <no-reply@yourco.com>` | Must be authorized by the SMTP host. |

If `SMTP_HOST` is set, Cadence will use SMTP. If not, it falls back to `RESEND_API_KEY` (if present) and finally to the console-logging provider for local dev.

The Express server needs a real Node host with persistent disk for SQLite — Netlify and Vercel serverless are not viable for the backend. Frontend builds to `dist/` and deploys anywhere static.

---

## Authentication

The whole app authenticates against `req.user.{userId, username, role}`. To swap in LDAP / Active Directory / Clerk / Auth0 / Okta you only touch one or two files — see [`LDAP_INTEGRATION.md`](./LDAP_INTEGRATION.md) for three integration paths.

The current build ships with:
- Username + password (bcrypt 12-round) + JWT
- Refresh-token rotation via `/api/auth/refresh`
- Password reset (`/forgot-password` → `/reset-password`, 1h tokens)
- Personal Access Tokens at `/api/api-tokens`
- Google OIDC SSO at `/api/sso/google/login`

---

## Architecture notes

- **JWT lives in localStorage** under `accessToken` / `refreshToken`. `services/api.ts` injects the bearer header, auto-refreshes on 401, and fires `auth:logout` if refresh fails.
- **PAT auth** is accepted by the same middleware. Tokens prefixed `cad_pat_` are looked up by SHA-256 hash. JWTs short-circuit without a SQL hit.
- **Schema migrations** are tracked in `schema_migrations` and idempotent. Migrations whose target table doesn't yet exist are deferred and replayed after the `CREATE TABLE` statements run.
- **OAuth state** is HMAC-signed with `JWT_SECRET` (10min expiry, nonce). Callbacks reject unsigned state.
- **Background jobs** are non-blocking `setInterval` loops — reminder scheduler (1h), calendar sync (15min), retention pruning (24h).
- **Public booking endpoints** are unauthenticated by design but rate-limited per IP per slug (5/min) with hard size + format validation.

---

## License

Proprietary — all rights reserved.
