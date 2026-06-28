# Design — Guided tour + "How it works" help + per-role quick login

- **Date:** 2026-06-28
- **Status:** Approved (design); pending implementation plan
- **Branch:** `feat/guided-tour-help-quick-login` (stacked on `feat/meeting-locality-tentative-scheduling`; PR base = that branch)
- **Scope:** Make the app demo-/test-ready: (1) a complete, working guided tour that also covers the new locality/tentative features; (2) a "How it works" help explainer; (3) one-click per-role quick login.

---

## 1. Context (what already exists)

- **Tour engine exists and is solid.** `services/tourService.ts` defines 4 tours — `welcome` (16 steps), `shortcuts`, `bookingLinks`, `admin` — with versioning, progress, and a subscribe API (`startTour`, `nextStep`, `prevStep`, `dismissTour`, `resetTour`, `getCurrentStep`, etc.). `components/TourOverlay.tsx` renders a spotlight + tooltip via a portal, driven by `tourService` subscription. The welcome tour auto-starts on login when `tourService.shouldShowTour('welcome')` (`index.tsx:194`).
- **Broken/missing anchors.** Several welcome-tour steps target `data-tour` selectors that don't exist in the DOM: `host-grid`, `calendar`, `time-slots`, `duration` (the scheduler-view internals). `SpotlightOverlay` returns null when the target isn't found and `TourTooltip` pins to the top-left for non-center steps — so those steps render broken today. Nav-based anchors (`scheduler`, `booking-links`, `team-management`, `logs`, `achievements`, `appointments`, `dashboard`) resolve dynamically via the nav loop (`index.tsx:645` `data-tour={nav.id === 'my-meetings' ? 'appointments' : nav.id}`). Existing literal anchors: `quick-book`, `share-link`, `achievements` (Dashboard), `notifications`, `profile`, `theme-toggle` (index.tsx).
- **No "How it works" explainer** — no Help/About/HowItWorks component exists.
- **Partial quick login** — `LoginPage.tsx` has a *collapsed* `<details>` "Demo Credentials" that *fills* (no submit) `admin`/`manager`/`sub`/`user1` with password `password`; not role-labeled.
- **Naming inconsistency** — tour copy mixes "Cadence"/"Regent"; `translations.ts` `appName = "Cadence"`.
- **Seeded accounts** (server + localStorage share IDs): `admin` (admin), `manager`=Abdul Rahman (manager), `sub`=Fatima (subordinate), `user1`=Ahmed (guest); all password `password`.

---

## 2. Decisions (locked in brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | "How it works" form | **Help modal** opened from a header `?` button; includes the guide + buttons to (re)start tours. No separate page. |
| 2 | Tour scope | **Extend the welcome tour** to cover the new features + **fix the missing anchors** + normalize naming + restartable. Single comprehensive tour (no role-branching). |
| 3 | Quick login | **Prominent, role-labeled, one-click (auto-submit)** buttons on the login page. |
| 4 | Branch/integration | **New branch stacked** on the feature branch; its own PR (base = feature branch). |

---

## 3. Help modal + `?` entry point

- **New `components/HelpModal.tsx`** — a bilingual (en/ar, `dir`-aware), dismissible modal. Two regions:
  1. **"How it works" guide** — short scannable sections, each a heading + 1–2 lines: *Roles* (Admin / Manager / Assistant / Client), *Scheduling* (pick a host → date → time → book), *Approvals* (pending → confirmed), *Meeting colors* (🔴 internal/in-building vs ⚫ external), *Tentative & on-behalf* (a delegate schedules for a boss; on Accept it lands on the boss's calendar), *Booking links* (shareable, guests book without an account), *Keyboard shortcuts* (`?` for shortcuts, `/` for the command palette).
  2. **Actions** — primary "Start the guided tour" button; secondary buttons for the `shortcuts` and `bookingLinks` tours, and the `admin` tour shown only to admins. Each calls `tourService.resetTour(id)` then `tourService.startTour(id)` and closes the modal.
- **Header entry point** — a `?` icon button in the header action cluster (beside notifications/theme/profile), `aria-label`'d and tagged `data-tour="help"`, toggling `HelpModal` open. State (`isHelpOpen`) lives in `index.tsx` (where the other header modal flags live).
- **Copy** lives in `services/translations.ts` (new keys, en + ar). The modal reads via the existing `t(key)` function passed from `index.tsx`.

## 4. Guided tour — make it "full" + fix gaps

In `services/tourService.ts` `welcome` tour:
- **Add steps** (with bilingual title/content) for:
  - **Meeting colors** — target a new `data-tour="meeting-card"` anchor on the meeting list / appointments item; explain 🔴 internal vs ⚫ external.
  - **Tentative & on-behalf** — target the `data-tour="notifications"` area (where tentatives surface with Accept/Decline) and reference the "Booking for someone else?" toggle; explain delegate scheduling → confirm → lands on the boss's calendar.
  - **Delegates** — target `data-tour="profile"` (the Delegates tab lives in profile settings); explain managing who may book on your behalf.
  - **Help** — target the new `data-tour="help"` button; "Reopen this guide or restart the tour anytime."
- **Add the missing anchors** so existing steps resolve: `data-tour="host-grid"` (host selection grid), `data-tour="calendar"` (CalendarGrid wrapper, ~index.tsx:923), `data-tour="time-slots"` (TimeSlotList wrapper, ~962), `data-tour="duration"` (duration buttons container, ~953).
- **Normalize naming** — replace literal "Cadence"/"Regent" in tour copy with the app name (use `translations` `appName`, or a neutral phrasing) so it's consistent.
- **Bump `welcome.version`** (3 → 4) so the refreshed tour re-shows; ensure restartable via the Help modal (`resetTour` + `startTour`).
- **Resilience:** confirm `TourOverlay` degrades acceptably for any `body`/center steps (already does); the added anchors remove the broken-target cases.

## 5. Per-role quick login (`LoginPage.tsx`)

Replace the collapsed "Demo Credentials" `<details>` with a visible **"Quick login (demo)"** group of four **role-labeled** buttons — **Admin**, **Manager**, **Assistant**, **Client** — mapping to `admin`/`manager`/`sub`/`user1`. Clicking a button **logs in immediately**: it sets the credentials and calls the same `authService.login(username, 'password')` → `onLogin(user)` path as the form (with the button's own loading/error handling, reusing the existing `error`/`loading` state). A small caption notes these are demo/test accounts. Bilingual labels via `t`. Keep the regular username/password form and Google SSO unchanged.

## 6. Error handling & edge cases

- Quick-login uses the existing login error path (`err.body.error || err.message`); a failed demo login surfaces the same inline error and never crashes.
- Help modal and tour are presentation-only; restarting a tour while one is active calls `resetTour`+`startTour` (idempotent).
- Tour steps whose target is conditionally rendered (scheduler-view anchors) only resolve when that view is active — consistent with the existing `requiredView` pattern; steps already drive navigation via `requiredView`. New scheduler-internal anchors (host-grid/calendar/time-slots/duration) exist once the scheduler view renders.
- All new UI is bilingual (en + ar) and RTL-aware.

## 7. Testing

Using the existing Vitest + @testing-library harness (`tests/`):
- `tests/tourService.welcome.test.ts` — the `welcome` tour includes the new step ids (meeting colors, on-behalf, delegates, help), every step has a non-empty `target`, `title`/`content` (and `titleAr`/`contentAr`) are non-empty, and `version` was bumped.
- `tests/components/HelpModal.test.tsx` — renders the guide sections; clicking "Start the guided tour" invokes `tourService.startTour` (spied) with `'welcome'` and closes.
- `tests/components/LoginPage.quicklogin.test.tsx` — the four role buttons render; clicking each calls `authService.login` (mocked) with the right username + `password` and then `onLogin`.

## 8. Affected files (checklist)

**New**
- `components/HelpModal.tsx`
- Tests: `tests/tourService.welcome.test.ts`, `tests/components/HelpModal.test.tsx`, `tests/components/LoginPage.quicklogin.test.tsx`

**Modified**
- `services/tourService.ts` — new welcome steps, version bump, naming.
- `services/translations.ts` — Help-modal + quick-login + new-step copy (en + ar).
- `index.tsx` — `?` Help button + `isHelpOpen` state + `<HelpModal>` mount; add `data-tour` anchors (`calendar`, `time-slots`, `duration`, `host-grid`, `help`).
- `components/MeetingList.tsx` (or the appointments item) — add `data-tour="meeting-card"` on the first card.
- `components/LoginPage.tsx` — per-role one-click quick login.

## 9. Non-goals (YAGNI)

No role-branching tour content, no standalone help page, no backend changes, no new tour engine (reuse `tourService`/`TourOverlay`).
