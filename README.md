# Cadence

A meeting scheduler with public booking links, two-way calendar sync (Google + Outlook), round-robin team distribution, leaderboards, and analytics.

Built with React 19 + Vite on the frontend and Express + SQLite + JWT on the backend.

## Features

- **Public booking links** — Calendly-style shareable URLs (`/book/:slug`) that let anyone book time on a host's calendar
- **Two-way calendar sync** — Google Calendar and Microsoft Outlook via OAuth. Confirmed bookings push to the host's external calendar; the host's external busy times block Cadence slots
- **Round-robin distribution** — bookings against a team URL rotate through available members
- **Email reminders** — 24h and 1h ahead, via Resend (free tier sufficient for low volume) or console-logging in dev
- **Leaderboards + achievements** — per-team and global rankings on bookings, login streaks, attended meetings
- **Analytics dashboard** — overview, trends, and per-team breakdowns (admin only)
- **Bilingual** — English / Arabic with RTL layout

## Stack

| Layer | Tech |
| --- | --- |
| UI | React 19, Vite 6, Tailwind, Framer Motion, React Three Fiber |
| State | localStorage cache + REST API |
| API | Express 4, JWT (15min access + 7d refresh), Helmet, express-rate-limit |
| DB | SQLite via better-sqlite3 (WAL mode) |
| Email | Resend SDK with Console fallback |
| Calendar | Raw `fetch` against Google Calendar v3 + Microsoft Graph |

## Quick start (local dev)

Requires **Node 22+** (some 3D deps need it; bun also works).

```bash
yarn install --ignore-engines
cp env.example.txt .env
# Edit .env — at minimum set JWT_SECRET
yarn server:dev   # backend on :3001
yarn dev          # frontend on :5173
```

Demo credentials (dev only): `admin / password`, `manager / password`, `sarah / password`, `khalid / password`. Seeded users are **not** created in production builds — see `DEPLOYMENT.md`.

## Project layout

```
.
├── components/           React components
├── hooks/                React hooks
├── services/             Frontend API client, business services
├── server/
│   ├── index.ts          Express bootstrap
│   ├── database.ts       SQLite schema + migrations
│   ├── routes/           HTTP handlers
│   ├── services/         Backend business logic (calendarSync, emailProvider)
│   ├── jobs/             Background jobs (reminderScheduler, calendarSyncJob)
│   └── middleware/       Auth, error, logging
├── data/                 SQLite DB files (gitignored)
└── public/               Static assets
```

## Architecture notes

- **JWT lives in localStorage.** `accessToken` and `refreshToken` keys. The fetch wrapper in `services/api.ts` injects the access token, auto-refreshes on 401, and fires a `auth:logout` event if refresh fails.
- **Calendar sync auto-creates 3 SQLite tables** (`calendar_connections`, `external_events`, `synced_meetings`) on first server boot via `runMigrations()`.
- **Round-robin auto-creates its own state table** (`round_robin_state`).
- **OAuth `state` is HMAC-signed** with `JWT_SECRET` and has a 10-minute expiry — without that the OAuth callback would be CSRF-able.

## Production

Read `DEPLOYMENT.md` before deploying. Short version: the Express server cannot run on Netlify static hosting; you need a separate Node host (Render, Fly, Railway, etc.) and the SQLite file needs persistent disk.

## License

Private / unpublished. All rights reserved.
