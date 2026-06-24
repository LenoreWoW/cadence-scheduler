# Design — Meeting locality colors + tentative on-behalf scheduling

- **Date:** 2026-06-22
- **Status:** Approved (design); pending implementation plan
- **Branch:** `feat/meeting-locality-tentative-scheduling`
- **Scope:** Two features for the cadence-scheduler (al-adaam-scheduler):
  1. Color-code meetings by locality — internal/in-building = **RED**, external/different-building = **BLACK**.
  2. Tentative meetings scheduled **on behalf of** another person (e.g. a boss), confirmed by the scheduler, the invitee, or the boss, after which they land on that person's calendar.

---

## 1. Context (grounding from the codebase audit)

**Architecture.** React SPA (`index.tsx`, ~1164 LOC, nearly all state in `useState`) deployed to Netlify; an Express + SQLite backend (`server/`, ~37 routers under `/api/*`, `better-sqlite3`, raw prepared statements, ~60 tracked idempotent `runOnce` migrations in `server/database.ts`, no ORM, no zod). Bilingual en/ar with RTL. JWT auth (`services/api.ts`, `hooks/useAuth.tsx`).

**The load-bearing fact (dual data model).** The in-app authenticated meeting flow does **not** call the backend. `index.tsx` → `services/schedulerService.ts` (pure logic) → `services/storageService.ts` writes meetings to **localStorage** (`adaam_meetings_v3`), seeded from `constants.ts` `INITIAL_*`. Only *public/admin* surfaces (public booking, approval queue, resources, OOO, calendar panels, `BookingCalendarView`) hit the server SQLite via `services/api.ts`. Consequence: an in-app meeting is **per-browser** — a boss in another session never sees it. **"Lands on the boss's calendar" only works on the server path.**

**Current meeting model.** `types.ts:81` `Meeting` = `{ id, title, date, time, durationMinutes, attendeeName, attendeeEmail, additionalAttendees?, userId? (creator), hostId (the person the meeting is WITH / calendar owner), status, bookedBy, notes?, category, meetingFormat, meetingLink?, meetingPlatform? }`. The frontend type is a **stale subset** of the DB/API (the API also returns `locationAddress`, `externalId`, `recordingUrl`, `reassignedFromUserId`, `hostName`, `hostAvatar`, `createdAt`, `updatedAt`; `MeetingDetailsModal.tsx:41` reads `(meeting as any).locationAddress`).

**Current status flow.** `MeetingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'` (`types.ts:79`). There is already a `pending → approved` approval flow: `ApprovalQueue.tsx`, `PATCH /api/meetings/:id/status` (host-or-admin only, `meetings.ts:508`), and on `approved` it (a) calls `syncMeetingToCalendar(id)` pushing to the **host's** external calendar, (b) fires `booking.approved` webhook + workflow + `scheduleForMeeting`, (c) sends `sendBookingApproved`. ICS already maps `pending→TENTATIVE`, `approved→CONFIRMED` (`server/services/icsGenerator.ts`). De-facto: `pending` = tentative, `approved` = confirmed.

**Current colors.** Per-meeting color is driven **solely by `meeting.category`** via `CATEGORY_CONFIG` (`constants.ts:19-25`): applied as a left-border + badge in `MeetingList.tsx:75,92,99`. `CalendarGrid.tsx:257` renders a single uniform `bg-al-adaam` (#8A1538) dot per day. `BookingCalendarView` chips are gray. Tailwind purges dynamic `bg-${x}` classes (no safelist) → dynamic colors must use inline `style={{}}` (existing precedent: `team.color` gradients). The brand `charcoal` token is `#000000` in light but **flips to `#FFFFFF` in dark mode** (`index.css :root.dark`).

**On-behalf / delegation primitives that exist.** `host_id` (boss / calendar owner) is already distinct from `user_id` (creator). A `user_delegates` table exists (`server/database.ts:454`: `principal_user_id`, `delegate_user_id`, `scope DEFAULT 'calendar'`, `PK(principal, delegate)`) — purpose-built for boss↔assistant — but is **completely unwired** (only its `CREATE TABLE` exists). `POST /api/meetings` currently lets **any** authed user set **any** `hostId` with no authorization check. Role drives auto-approve: admin/manager/subordinate-created meetings auto-`approved`; guest → `pending` (`schedulerService.createMeeting`; server `meetings.ts:360`).

**Known bugs to fix in passing.** (a) `index.tsx` `handleBookingSubmit` (≈373-388) never copies `formData.locationAddress` into the saved meeting and `Meeting` has no field for it → in-app location data is silently dropped. (b) `schedulerService.rescheduleMeeting` force-sets `status='approved'` → rescheduling a tentative before acceptance would wrongly confirm it.

---

## 2. Decisions (locked during brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Internal/external classification | **Explicit `locality` field** on the meeting, smart-defaulted (not structured buildings, not pure inference). |
| 2 | Where the red/black signal lives | **Primary card accent** (left border + title color); category demoted to a small label. |
| 3 | online vs in-person interaction | `locality` is an **independent axis** — every meeting (online or in-person) is colored. |
| 4 | Tentative status modeling | **Reuse `pending → approved`** + an `onBehalf` marker + "Tentative/Confirmed" UI labels (no new enum values). |
| 5 | Data path for on-behalf | **Wire the on-behalf create + accept to the server** (scoped; ordinary in-app meetings stay local but still get colored). |
| 6 | Who can confirm a tentative | **Scheduler (creator/delegate) + invitee (token) + boss (host) + admin.** |
| 7 | Who can schedule on behalf | **Registered delegates only** (wire `user_delegates`); admins always. Closes the open-`hostId` hole. |
| 8 | Tentative presence before confirm | **Visible as tentative + holds the slot.** External-calendar push only on confirm. |

---

## 3. Data model changes

Two new fields on the meeting, in **both** persistence paths.

| Field (TS / DB) | Type | Default | Meaning |
|---|---|---|---|
| `locality` / `locality` | `'internal' \| 'external'` | `'internal'` | Drives red/black accent. |
| `onBehalf` / `on_behalf` | boolean / `INTEGER 0\|1` | `false` / `0` | Marks a tentative-on-behalf meeting; distinguishes it from an ordinary guest "pending approval". |

**Reused unchanged:** `status` (`pending`=tentative, `approved`=confirmed), `host_id` (=boss), `user_id` (=assistant/proposer), `approval_required` + `approver_id`, `attendee_token`.

**Server migration** (new `runOnce` block in `server/database.ts`, never editing the existing `CREATE TABLE`):
- `ALTER TABLE meetings ADD COLUMN locality TEXT DEFAULT 'internal'`
- `ALTER TABLE meetings ADD COLUMN on_behalf INTEGER DEFAULT 0`
- **Backfill** existing rows' `locality`: `external` when `booked_by = 'guest'` OR `category = 'client'`; else `internal`.

**Smart default for new meetings** (`deriveLocality`, a pure helper used by both paths): start `internal`; set `external` if any of — `bookedBy === 'guest'`, `category === 'client'`, or the attendee's email domain differs from the **host's** email domain (the host record carries `email`; if either email/domain is missing, this signal is skipped rather than guessed). The booker can always override via the toggle.

**Thread the new fields through (else they silently drop):**
- Frontend `types.ts`: add `MeetingLocality`, `Meeting.locality`, `Meeting.onBehalf`, and `Meeting.locationAddress?` (stop the `as any` drift).
- `constants.ts`: backfill `INITIAL_MEETINGS` with `locality`; add `LOCALITY_CONFIG` (see §4).
- Server INSERT sites: `meetings.ts`, `bookingLinks.ts`, `teamBookingLinks.ts`, `roundRobin.ts`, `crmHubspot.ts`. Public/guest INSERT paths default `locality = 'external'`.
- Server serializers: all **3 row→JSON mappers** in `meetings.ts` (≈88-103, 161-187, 260-286) + the `bookingLinks.ts` mapper.
- Ad-hoc local interfaces that redefine a meeting/booking: `PublicBookingPage.tsx`, `BookingCalendarView.tsx`, `ManageBookingPage.tsx`.
- localStorage path: `schedulerService.createMeeting` sets `locality` (+ `onBehalf` where relevant).

---

## 4. Feature 1 — locality colors

**Color tokens.**
- Internal = **true red `#DC2626`** — deliberately distinct from the brand maroon `#8A1538` used by the `strategy` category, so they don't read as the same thing.
- External = **literal `#000000`** (NOT the `charcoal` token, which inverts in dark mode).
- Dark mode: define CSS variables in `index.css` (`:root` and `:root.dark`): `--meeting-internal: #DC2626` (both modes); `--meeting-external: #000000` (light) / `#E5E7EB` (dark, the high-contrast equivalent of black-on-light). Apply via inline `style={{ color: 'var(--meeting-external)' }}` etc. (purge-safe).
- `LOCALITY_CONFIG` in `constants.ts`: `{ internal: { label, cssVar: '--meeting-internal' }, external: { label, cssVar: '--meeting-external' } }`, with bilingual labels.

**A single resolver** `getMeetingAccent(meeting)` returns the locality color (and tentative styling flags) so every render site stays consistent.

**Render sites updated:**
- `MeetingList.tsx`: left border + title color from locality (replaces category color there); category becomes a small text label/chip; keep the existing online pill.
- `MeetingDetailsModal.tsx`: locality badge; show category as secondary.
- `BookingModal.tsx`: an **Internal/External toggle** (smart-defaulted via `deriveLocality`) and the step-3 review accent uses locality.
- `CalendarGrid.tsx`: month dots colored by locality (per-meeting) instead of one uniform maroon dot; tentative = hollow/dashed dot.
- `BookingCalendarView.tsx`: chips colored by locality.
- `Dashboard.tsx`: next-meeting hero + activity dots use locality color.

**Bug fix bundled here:** thread `locationAddress` + `locality` through `index.tsx` `handleBookingSubmit` so in-app meetings stop dropping location data.

---

## 5. Feature 2 — tentative on-behalf flow (server-backed)

### 5.1 Flow

```
Assistant (a registered delegate of Boss)
   └─ POST /api/meetings { hostId: boss, onBehalf: true, ... }
        server: verify canActOnBehalf(assistant, boss)  ──(403 if not)
                ▸ force status = 'pending'  (override role auto-approve)
                ▸ approval_required = 1, approver_id = boss
                ▸ generate attendee_token
                ▸ best-effort TENTATIVE-ics email to invitee
                ▸ in-app notification to Boss ("X scheduled a tentative meeting for you")
   ⇒ Tentative meeting on Boss's calendar: styled tentative (dashed/greyed), HOLDS the slot.

Confirm — ANY of:
   • Assistant presses Accept  → PATCH /api/meetings/:id/status { approved }
   • Boss presses Accept       → PATCH /api/meetings/:id/status { approved }
   • Invitee confirms via link → POST /api/meetings/:id/confirm-by-token { token }
        server: status = 'approved'
                ▸ syncMeetingToCalendar(id)  (host = boss → boss's EXTERNAL calendar)
                ▸ booking.approved webhook + workflow + scheduleForMeeting
                ▸ sendBookingApproved email
                ▸ notify assistant + boss of confirmation
   ⇒ Confirmed: solid on Boss's calendar.

Decline — Assistant / Boss / Invitee → status = 'rejected' (existing reject path) + notify.
```

### 5.2 Cross-user visibility & slot-holding

- The App fetches server-side on-behalf/tentative meetings where the current user is **host or creator** and **merges** them into the in-app `meetings` array (marked tentative). This gives both the boss and the assistant visibility, and because the merged tentatives live in the same array, `generateTimeSlots`/`checkMeetingConflict` (which already treat `pending` as blocking) **naturally hold the slot** locally.
- External-calendar push remains gated on `approved` (unchanged machinery).

### 5.3 Confirmation surfaces (UI)

- Extend the existing notification-bell / approval dropdown (the **two parallel** desktop + mobile blocks in `index.tsx`, ≈606-647 and ≈698-731) to also list tentatives awaiting *my* action, each with **Accept / Decline**.
- `MeetingDetailsModal.tsx`: when the current user may act and `status==='pending' && onBehalf`, show "Scheduled by X for Y" + Accept/Decline.
- Invitee path: a token-confirm page reusing the `AcceptInvitePage`/`ManageBookingPage` pattern → `POST /api/meetings/:id/confirm-by-token`.

### 5.4 Bug fix bundled here

`schedulerService.rescheduleMeeting` must **preserve** a tentative (`pending` + `onBehalf`) status instead of forcing `approved`.

---

## 6. Authorization & delegates

- **Wire `user_delegates`:** new `GET/POST/DELETE /api/delegates` + a small "Manage delegates" panel (who may act for me / whom I may act for) + a `canActOnBehalf(delegateUserId, principalUserId)` helper (`true` for admins).
- **Close the open-host hole:** in `POST /api/meetings`, if `hostId !== requesterUserId`, require **admin OR a registered delegate** of that host. Verify no legitimate same-host flow regresses (the in-app create is localStorage and does not hit this endpoint; the audit must be re-confirmed for any UI that does).
- **Confirm authorization** (`PATCH /:id/status` and `confirm-by-token`): allow **host, admin, creator (`user_id`), a delegate of the host**, and the **invitee via valid `attendee_token`**. (Today it is host-or-admin only at `meetings.ts:508`.)
- Server-side `req.user = { userId, username, role }`; no new auth infra needed.

---

## 7. Notifications

- **On create (on-behalf):** in-app notification to the boss (+ best-effort TENTATIVE-ics email to the invitee).
- **On confirm:** reuse `sendBookingApproved` (to invitee) + `syncMeetingToCalendar`; in-app notifications to assistant + boss.
- Reuse the existing `notifications` table + `notification_prefs`. (A dedicated `booking.confirmed` workflow trigger is **not** added — we reuse `booking.approved`.)

---

## 8. Error handling & edge cases

- **Email is best-effort.** SMTP is scaffolding only; the in-app accept and in-app notifications work fully without it. Email failures are logged and never block the flow.
- **Non-delegate on-behalf attempt** → `403` with a clear message; the on-behalf option is hidden in the UI unless the user actually has principals.
- **Tentative + locality coexist:** a tentative card shows the red/black accent **and** a dashed/greyed "Tentative" treatment; it solidifies on confirm.
- **Migration safety:** idempotent `runOnce`; backfill runs once in the same block. No `CHECK` constraints exist on `status`/`locality` TEXT columns — server-side validation arrays are the guard; keep `locality` validated to the two values in routes.
- **Dark mode black** handled via the CSS-variable pair (§4).

---

## 9. Testing strategy

The existing tests are stale (`schedulerService.test.ts` asserts a different signature; `authService.test.ts` tests a legacy localStorage path; `Button.test.tsx` is a mock) and the backend has no test harness; `yarn lint` has no eslint config. Approach: extract pure logic into testable helpers and unit-test them with the existing vitest setup:

- `deriveLocality(...)` default derivation (guest/client/domain cases).
- `getMeetingAccent(...)` locality→color/style resolution (incl. dark-mode var selection).
- `rescheduleMeeting` preserves a tentative status.
- `generateTimeSlots`/`checkMeetingConflict` treat a merged tentative as blocking.
- `canActOnBehalf(...)` and the confirm-authorization predicate (host/creator/delegate/invitee-token/admin).

Full server integration tests are **out of scope** (no harness exists today) unless explicitly requested; if requested, stand up a minimal in-memory SQLite vitest harness for the `meetings`/`delegates` routes.

---

## 10. Affected files (checklist)

**Frontend**
- `types.ts` — `MeetingLocality`, `Meeting.locality`, `Meeting.onBehalf`, `Meeting.locationAddress?`; `Delegate` type.
- `constants.ts` — `LOCALITY_CONFIG`; backfill `INITIAL_MEETINGS.locality`.
- `index.css` (+ inline critical CSS in `index.html`) — `--meeting-internal` / `--meeting-external` (light + dark).
- `index.tsx` — merge server tentatives; on-behalf create → server; Accept/Decline in notification/approval dropdowns (desktop + mobile); fix `handleBookingSubmit` location/locality drop.
- `components/MeetingList.tsx`, `MeetingDetailsModal.tsx`, `BookingModal.tsx`, `CalendarGrid.tsx`, `BookingCalendarView.tsx`, `Dashboard.tsx` — locality accent + tentative styling.
- New: `components/DelegatesManager.*` (manage delegates); invitee confirm page (reuse `AcceptInvitePage`/`ManageBookingPage`).
- `services/schedulerService.ts` — `deriveLocality`, `getMeetingAccent`, set `locality`/`onBehalf`, fix `rescheduleMeeting`; `services/api.ts` calls for on-behalf create/confirm/decline + delegates.
- Ad-hoc interfaces in `PublicBookingPage.tsx`, `BookingCalendarView.tsx`, `ManageBookingPage.tsx`.
- `services/translations.ts` — en + ar strings for locality labels, tentative/on-behalf UI, delegates.

**Backend**
- `server/database.ts` — `locality` + `on_behalf` migration + backfill.
- `server/routes/meetings.ts` — create (locality/on_behalf, on-behalf auth, force pending, serializers ×3), `PATCH /:id/status` (extended confirm auth), `reschedule` (preserve tentative), new `POST /:id/confirm-by-token`, `GET` returns new fields + fetch tentatives by host/creator.
- New `server/routes/delegates.ts` — `GET/POST/DELETE /api/delegates`; `canActOnBehalf` helper (likely in `server/utils` or `server/services`).
- `server/routes/bookingLinks.ts`, `teamBookingLinks.ts`, `roundRobin.ts`, `crmHubspot.ts` — INSERT `locality` (default `external` for public) + serializers.
- `server/index.ts` — mount the delegates router.

---

## 11. Risks (carried forward)

- **Dual data model** is the #1 risk; the design contains it by scoping server work to the on-behalf flow and merging server tentatives into the in-app view.
- Adding a meeting column means editing **every** INSERT + serializer — easy to miss one; the §10 checklist is the guard.
- Closing the open-`hostId` hole could regress a legitimate same-host UI path — must be re-verified during implementation.
- Backend is untested with no CI; mitigated by extracting and unit-testing pure helpers.
- All new UI must ship bilingual (en + ar) and RTL-aware, including the two parallel notification render blocks.
