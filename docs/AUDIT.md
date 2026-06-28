# Cadence — Vision Audit & Rebuild Map

**Date:** 2026-06-28
**Vision:** a **booking app** that is **management + self-service** for a **professional org**, on **Qatar's GBA brand colours**, with **motion-rich UI** (inspiration: motionsites.ai).
**Run `./goal`** for the technical ship-check (typecheck / lint / tests / build).

> **Context:** the decision is to **scrap the current UI and rebuild it from scratch** to the
> vision. This audit is therefore framed as **KEEP (reusable foundation)** vs **REBUILD (UI layer)**.

---

## Verdict
The **product foundation is strong and largely reusable**; the **presentation layer is what to rebuild**.
The core model (host + delegates + approval) already matches "management + self-service for a
professional org", the server is now the source of truth, and the GBA colour system + motion stack
are in place. The current UI was reached by *restyling* legacy screens — a from-scratch UI is the
right call to fully realize the vision.

---

## Dimension-by-dimension

### 1. Booking core — ✅ (foundation solid)
- Server-backed meeting flow (`server/routes/meetings.ts`, 34 API routes total; `services/meetingsApi.ts`).
- Create / approve / reject / cancel / reschedule, conflicts enforced server-side (409), recurring supported.
- **Keep:** the entire server + `meetingsApi`. **Rebuild:** the booking *screens*.

### 2. Management (gatekeeper) — ✅ logic / ⚠️ surfaced
- Approval queue (`GET /pending-approval`, host+delegate aware), delegates (`routes/delegates.ts`,
  `canActOnBehalf`), on-behalf scheduling, OOO, admin (teams, analytics, logs, system-health), roles.
- **Gap:** no first-class **"manage the boss's calendar"** mode or **Requests inbox** yet (logic exists, UI doesn't).
- **Keep:** all server logic. **Rebuild + add:** the gatekeeper surfaces.

### 3. Self-service — ✅ (just fixed)
- Staff/guests can **book in** → pending → host approves (fixed in the inbound-booking PR; was a 403).
- Public booking infrastructure retained but **link creation/sharing removed** (internal book-in model).
- **Keep:** server. **Rebuild:** the book-in screens.

### 4. Professional-org fit — ⚠️ partial
- ✅ Portal-auth model (no in-app login), roles, **Teams** (flat users, departments removed).
- ❌ **Data model split:** only **meetings** are server-backed. **Users, teams, and logs still live in
  per-browser `localStorage`** (`storageService`) — so the people directory / teams / audit log do **not**
  sync across users. For a real multi-user org this must move to the server (the API largely exists).
- ❌ Portal SSO is a **stub** (no real OIDC) — fine for now, wire later.

### 5. Qatar GBA brand — ✅
- Full GBA token set in `tailwind.config.js` (12 brand colours) + `index.css` `:root`/`:root.dark`;
  **zero** hardcoded `[#8A1538]` classes app-wide; brand standardized on **Cadence**.
- **Keep:** the token system wholesale — it's the brand foundation the new UI should consume.

### 6. UI / motion (motionsites.ai) — ⚠️ this is what to rebuild
- Stack present: `framer-motion`/`motion` (7 components), `three` + `@react-three/fiber`/`drei` (3 components),
  `react-swipeable`. Real light/dark, RTL, bilingual on core surfaces.
- But the current screens are **restyled legacy** — not a from-scratch, motion-led experience.
- **Rebuild:** the entire component/screen layer against the vision (see plan below).

---

## KEEP vs REBUILD (the rebuild map)

**KEEP (do not touch — the new UI builds on these):**
- `server/**` — the whole API, auth, DB, business logic.
- `services/**` — `meetingsApi`, `api`, `authService`, `delegationApi`, `schedulerService` (pure slot math),
  `smartDefaults`, `themeService`, `translations` (i18n keys), `localityService`, `avatar`.
- `types.ts`, `constants.ts`.
- The **GBA token system**: `tailwind.config.js`, `index.css` tokens.

**REBUILD (the scrap target — the presentation layer):**
- `components/**` (the screens/widgets), `index.tsx` (the app shell / routing / view switch).
- Re-implement against the vision with a fresh design system + component library.

**DECIDE (carry over selectively, don't restyle):**
- The data model gap (move users/teams/logs to server as part of the rebuild).
- Which legacy components have logic worth porting (e.g. `BookingModal` flow rules) vs. pure markup to drop.

---

## Technical state (from `./goal`)
- **Build:** ✅ succeeds (`vite build`).  ⚠️ single JS chunk ~490 KB gzip — code-split (esp. three.js) in the rebuild.
- **Typecheck:** ✅ no new errors (known baseline: EmptyState3D, ThemeToggle, schedulerService, vitest.config, 2 stale tests).
- **Tests:** ✅ kept suites green; 2 pre-existing stale suites fail (untouched).

## Top gaps to "finish" (priority order)
1. **Rebuild the UI from scratch** to the vision (this audit's premise) — new design system → shell → gatekeeper + book-in surfaces.
2. **Server-back users/teams/logs** (finish the data-model migration) so the org truly shares state.
3. Build the **Requests inbox** + **manage-the-boss** mode (logic ready).
4. Validate the cross-user flow end-to-end (needs two real sessions).
5. Code-split the bundle; wire real portal SSO when the portal exists.
