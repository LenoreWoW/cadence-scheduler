# Design — Phase 1: UI redesign (GBA / Minimal premium SaaS) + structural changes

- **Date:** 2026-06-28
- **Status:** DRAFT for review (design); pending implementation plan(s)
- **Branch:** `feat/phase1-redesign` (stacked on `chore/remove-sounds-gamification` → PR #3 → … → main)
- **Builds on:** Phase 0 (sounds + gamification removed).

## 1. Goal

Replace the current "editorial-luxe AI template" UI with a **clean, minimal, premium SaaS** design built on the **official Qatar Government (GBA) colour system**, standardize the brand on **Cadence**, and make three structural simplifications the user asked for: **no in-app login** (portal-authenticated), **no departments** (flat user list, Teams kept), and **simpler booking-link + onboarding** flows. The user's north star: **simplicity**.

## 2. Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Colour system | **Official Qatar GBA palette**, applied per the GBA usage hierarchy (already the app's tokens — names + hex match exactly). |
| 2 | Brand name | **Cadence** (replace REGENT wordmark + reconcile Al-Adaam naming). |
| 3 | Visual direction | **Minimal premium SaaS** (Linear/Vercel-like) for layout/type/space/motion; GBA for colour. |
| 4 | Login | **Remove the login page.** Users arrive authenticated from an external portal (real mechanism wired later). Add a **dev-only quick-login** to test each role now. |
| 5 | Org structure | **Remove departments** → flat user list. **Keep Teams** (power team booking links + round-robin). |
| 6 | Booking-link + onboarding | **Simplify** (fewer steps, cleaner). |
| 7 | Build models | **Opus** for all implementer + reviewer subagents (ultracode). |

## 3. Design foundation (the design system)

### 3.1 Colour — GBA, systematized
Keep the GBA tokens; apply them by **role**, not decoratively:
- **Primary / neutral spine:** Al Adaam `#8A1538` (primary brand action, key emphasis), Dune `#A29475` (warm neutral — borders, secondary text, subtle fills), Black `#000000` / near-black greys (text, surfaces), White `#FFFFFF` / off-white (backgrounds).
- **Secondary accents (sparing, semantic):** Skyline `#0D4261`, Palm `#129B82` (success/confirmed), Sea `#4194B3`, Sunrise `#FDF39D`, Salmon `#DD7877` (pending/attention), Dark Purple `#511C3C`, Green `#5A895A`, Purple `#8067A4`, Yellow `#E9C56B`.
- **Semantic mapping:** approved/confirmed → Palm; pending/tentative → Salmon; internal meeting accent → Al Adaam (red); external → Black (keep the locality system, recoloured to GBA). Each meeting **category** maps to ONE secondary, not a free-for-all.
- **Rule:** a screen leads with Al Adaam + neutrals; at most 1–2 secondary accents per view. This fixes the current "rainbow with no system."

### 3.2 Single source of truth for tokens
Today tokens drift across `index.css :root`, an inline `<style>` in `index.html`, and `tailwind.config.js`. Consolidate to **`index.css :root` + `tailwind.config.js` only**; delete the duplicated inline token block in `index.html` (keep only the critical-CSS that must inline). Every brand colour, the type scale, spacing, radii, and motion easings live in one place; replace hardcoded `#8A1538` literals with the token.

### 3.3 Typography
- Wire a real **display font** (the app loads Playfair but never maps it; `font-serif` silently falls back to Georgia in ~20 files). Choose ONE of: keep Outfit as display (drop serif entirely — cleanest for "minimal SaaS") **[recommended]**, OR map a real serif. Body: Inter. Mono: JetBrains Mono (micro-labels only). Arabic: IBM Plex Sans Arabic.
- **Calm the type tics:** stop UPPERCASE + wide letter-spacing on every button/label; reserve it for small section eyebrows only. Establish a clear type scale (display / h1–h3 / body / caption) and use it consistently.

### 3.4 Spacing, radii, motion
- Consistent radius scale (e.g. 8 / 12 / 16) — today it's 4px inputs, 8px cards, ad-hoc `rounded-xl/2xl`. Pick a system.
- Generous, consistent spacing (the "premium SaaS" breathing room).
- Motion: reuse `framer-motion` (already in Button/PageTransition/BottomSheet) for tasteful transitions; reserve real WebGL (`three`/R3F — already installed) for at most one hero accent. No motion overload.

### 3.5 One shared Modal primitive
There are ~30 hand-rolled `fixed inset-0` overlays with inconsistent backdrops/radius/motion. Promote `BottomSheet` (the best existing base) into a single canonical **`Modal`** (mobile bottom-sheet / desktop centered, consistent backdrop, focus trap, RTL-aware) and migrate the high-traffic modals to it (BookingModal, MeetingDetailsModal, ProfileSettingsModal, ConfirmationModal, QuickBook). Lower-traffic modals migrate opportunistically.

### 3.6 Real dark mode
Dark mode is shallow/broken on the core booking flow (scheduler context header, time-slot panel, notifications hardcode `bg-white`/`text-charcoal` with no `dark:`). Fix via tokens so light/dark both hold across every redesigned surface. Keep `themeService` (class toggle) and the `[dir=rtl]` overrides.

### 3.7 Brand: Cadence
Replace the **REGENT** wordmark (login/header/legal/accept-invite) and reconcile stray "Al-Adaam" naming with **Cadence** (the title/package/translations already say Cadence). The Qatar GBA *colours* stay (they're the government identity); the *product name* is Cadence. Replace placeholder imagery (ui-avatars.com, source.unsplash.com/random) with token-styled initials/real assets.

## 4. Auth — remove login, portal handoff + dev entry

- **Remove the in-app login page** (`LoginPage` + `LoginScene3D`) from the authenticated-app gate. The app assumes an **authenticated session arrives from the portal**.
- **Server:** keep JWT/session issuance, but add a **portal-handoff entry point** that's a clean seam for the real mechanism later — a single `acceptPortalSession()` boundary (today's choice: stub it; later it becomes OIDC callback OR signed-token validation OR gateway-header trust). Do NOT delete the existing auth/JWT/session/refresh machinery — it stays; only the *UI login form* and self-registration entry go.
- **Dev-only entry:** repurpose the per-role **quick-login** (built in PR #2) as a **dev-only** affordance (rendered only when `import.meta.env.DEV` / a `VITE_DEV_LOGIN` flag), so we + you can enter as Admin/Manager/Subordinate/Guest locally. Hidden in production builds.
- **Unauthenticated state in prod:** instead of a login form, show a minimal "Sign in through the portal" redirect/placeholder screen (Cadence-branded) with a button to the portal URL (configurable; placeholder for now).
- Public token routes (manage-booking, accept/confirm-invite, public booking, reset/verify) are **unaffected** — they're token-based, not login.

## 5. Remove departments → flat users (keep Teams)

- **Frontend:** delete `components/DepartmentsPanel.tsx`; remove department UI/filters from `TeamManagement.tsx`, `HostSelector.tsx`, `QuickBookModal.tsx`; the people view becomes a **flat, searchable list of users** (Teams remain as an optional grouping/filter, not departments).
- **Server:** delete `server/routes/departments.ts` + unregister in `server/index.ts`; remove `department_id` usage; drop the `departments` table (and `department_id` columns on users/teams) via a `runOnce` migration (SQLite: recreate-without-column or just stop using it + drop the table; keep it simple).
- **Types/i18n:** remove `Department` types + department translation keys.
- Confirm no core flow depends on departments (round-robin uses Teams, not departments — verify during planning).

## 6. Simplify the booking-link flow

- **Public booking page** (`PublicBookingPage`, 35KB) and the **BookingModal** (34KB) are the heaviest flows. Simplify to the essential path: pick time → enter name/email → confirm. Collapse multi-step wizards where a single clean form suffices; reduce optional fields up front (progressive disclosure). Keep per-tenant brand overrides (brandColor/logo) honoured. Keep it on the new Modal + tokens.
- **BookingLinksManager**: streamline link creation to the common case (title, duration, availability) with advanced options behind a "More options" disclosure.

## 7. Simplify onboarding

- With portal SSO, the heavy first-run `OnboardingFlow` shrinks: drop steps that the portal/admin already provides; keep only what the user must set (e.g. availability/working hours) — ideally a 1–2 step, skippable, lightweight setup, or fold essentials into a dismissible dashboard prompt. Sound-toggle step is already gone (Phase 0).

## 8. Surface sequencing (each its own reviewable chunk/PR)

1. **Foundation** — GBA token system (one source), type/display-font, radii/spacing, motion, `Modal` primitive, dark-mode fix, Cadence wordmark. (No surface looks "done" yet, but everything inherits it.)
2. **Auth shell** — remove login page; portal-redirect placeholder + dev quick-login; unauth gate.
3. **Departments removal** — flat user list (frontend + server + DB).
4. **Dashboard** — authed landing.
5. **Scheduler flow** — HostSelector → CalendarGrid + TimeSlotList + selection bar + BookingModal (simplified).
6. **Header / nav / MobileNav.**
7. **Booking-link + public booking** (simplified, brand-overridable).
8. **Onboarding** (simplified).
9. **Remaining surfaces** — AppointmentsView/MeetingList/MeetingDetails, admin views (TeamManagement, Logs, Analytics, etc.), public/legal/auth pages.

## 9. Testing & verification

- Per the repo's harness (Vitest + @testing-library): keep the existing kept suites green; add focused tests for new pure logic (e.g. token/semantic-colour resolver, `acceptPortalSession` boundary, dev-login gating). Visual changes verified via local run (backend `yarn server` :3001; frontend `yarn dev --port 5173`; the Playwright MCP browser can't reach local — verify via HTTP + manual). `yarn typecheck` clean of new errors at each step.
- Each surface chunk: implement → spec/quality review → fix → next (subagent-driven, Opus).

## 10. Non-goals (YAGNI)

- No real portal/OIDC integration yet (stub the seam; wire when the portal exists).
- No new backend features beyond the structural removals + the auth seam.
- No router library swap (keep the `index.tsx` `resolveRoute`/`currentView` model; restyle in place).
- No removal of Teams, webhooks, calendar sync, or the locality/tentative features (those stay; only restyled).

### 10.1 Amendment (2026-06-28, post-Phase-1): booking-link creation/sharing removed
The original non-goal kept booking links. **Superseded by user decision:** the *unused* workflow — **creating a personal booking link and sharing it** — is removed from the UI. Removed entry points: the **Booking Links** management view + header nav (`BookingLinksManager`), the Profile Settings **Booking Links** tab, the Dashboard **Copy/Share Link** quick actions, and the matching guided-tour/Help steps. **Retained** (still "kept"): the underlying public-booking infrastructure — `PublicBookingPage`/`TeamBookingPage`/`ManageBookingPage`, routing forms, embed, analytics pixels, restriction schedules, booking caps, custom domains, the server routes, and the DB tables (FK graph untouched). This is a frontend entry-point removal only; no server/DB changes. Teams are unaffected (membership = `users.team_id` + role scoping; departments were never required).