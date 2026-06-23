# Meeting Locality Colors + Tentative On-Behalf Scheduling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Color every meeting RED when internal / BLACK when external, as the primary card accent; (2) let a registered delegate schedule a *tentative* meeting on behalf of a boss that becomes *confirmed* — and lands on the boss's calendar — when the scheduler, the boss, or the invitee accepts.

**Architecture:** Add a `locality` field and an `onBehalf` flag to the meeting model in **both** persistence paths (localStorage `schedulerService`/`storageService` AND server SQLite). Feature 1 (colors) is pure presentation + a smart-defaulted field, applied at every render site via a shared resolver. Feature 2 reuses the existing `pending→approved` machinery (approval queue, `PATCH /:id/status`, calendar-sync-on-approval, tentative/confirmed ICS) but routes the on-behalf create + confirm through the **server** so the boss sees it cross-session; the existing-but-unused `user_delegates` table is wired for authorization.

**Tech Stack:** React 19 + Vite + TypeScript (SPA, `index.tsx`), Tailwind 3.4 (`darkMode:'class'`, purge on, **no safelist**), hand-written `index.css` design tokens, Express + better-sqlite3 (raw prepared statements, `runOnce` migrations, no ORM/zod), Vitest 1.3 + @testing-library/react + jsdom. Bilingual en/ar.

## Global Constraints

- **Package manager: `yarn`** (repo has `yarn.lock`). NEVER `npm`/`pnpm`/`npx`. Test commands: `yarn vitest run <path>` (single file), `yarn test:coverage` (full single pass), `yarn typecheck` (`tsc --noEmit`).
- **Dynamic colors MUST use inline `style={{}}`** with CSS variables or literal hex — Tailwind purges dynamic `bg-${x}` classes (no safelist).
- **BLACK = literal `#000000`** via the `--meeting-external` CSS var (NOT the brand `charcoal` token, which flips to `#FFFFFF` in dark mode). **RED = `#DC2626`** (true red, deliberately distinct from the brand maroon `al-adaam` `#8A1538` used by the `strategy` category).
- **Every new meeting field is added in BOTH data paths** (localStorage model + server SQLite) and threaded through **all 3 server serializers** in `server/routes/meetings.ts` (≈lines 88-103, 161-187, 260-286) or it silently drops.
- **Server schema changes use a NEW `runOnce('<name>', '<sql>')`** call — NEVER edit an existing `CREATE TABLE`. `runOnce` defers `ALTER TABLE meetings` until after the `meetings` CREATE runs (handled by the existing `drainDeferred` mechanism).
- **All new UI strings ship in BOTH `en` and `ar`** in `services/translations.ts` (add to both objects; missing keys silently fall back to the raw key).
- **Reuse `pending` (=tentative) / `approved` (=confirmed)** — do NOT add new `MeetingStatus` values.
- **The existing `tests/schedulerService.test.ts` is STALE** (wrong signatures, phantom `TimeSlot.time`/`isAvailable`, `{date,allDay}` timeOff). Do NOT trust it. New tests target the *actual* signatures documented in each task.
- New TS files use ESM `import`/`export` (package is `type:'module'`). Tests live under `tests/`, named `*.test.ts(x)`.

---

## File Structure

**New files**
- `services/localityService.ts` — `MeetingLocality`-aware pure helpers: `deriveLocality(...)`, `getMeetingAccent(...)`. One responsibility: decide a meeting's locality + its accent color var.
- `services/delegationApi.ts` — typed client wrappers (via `apiJson`) for delegates + on-behalf create/confirm/decline + fetching server tentatives. One responsibility: the Feature-2 server API surface.
- `server/utils/delegationRules.ts` — DB-free pure rule `isDelegationAllowed(...)` (so its unit test never loads better-sqlite3).
- `server/routes/delegates.ts` — Express router for `user_delegates` CRUD + the exported `canActOnBehalf(...)` authorization helper.
- `components/DelegatesManager.tsx` — small panel to manage "who may book on my behalf / whose calendar I manage".
- `components/ConfirmInvitePage.tsx` — public token page where an invitee confirms a tentative meeting.
- Tests: `tests/localityService.test.ts`, `tests/delegationAuth.test.ts`, `tests/schedulerService.locality.test.ts`, `tests/components/MeetingList.locality.test.tsx`.

**Modified files**
- `types.ts` — `MeetingLocality`; `Meeting.locality?`, `Meeting.onBehalf?`, `Meeting.locationAddress?`; `Delegate` interface.
- `constants.ts` — `LOCALITY_CONFIG`; add `locality` to `INITIAL_MEETINGS`.
- `index.css` — `--meeting-internal` / `--meeting-external` vars in `:root` and `:root.dark`.
- `components/MeetingList.tsx` — locality accent (border + title) + category demoted + tentative styling + Accept/Decline.
- `components/MeetingDetailsModal.tsx` — locality badge + on-behalf info + Accept/Decline.
- `components/BookingModal.tsx` — Internal/External toggle; thread `locality`; on-behalf principal selection.
- `components/CalendarGrid.tsx` — month dot colored by locality.
- `components/BookingCalendarView.tsx` — chips colored by locality; add `locality` to local interface.
- `components/Dashboard.tsx` — next-meeting hero + activity dots colored by locality (Task 7b).
- `index.tsx` — thread `locality`+`locationAddress` through `handleBookingSubmit` (fix drop bug); merge server tentatives; Accept/Decline in both notification dropdowns; mount DelegatesManager + ConfirmInvitePage route.
- `services/schedulerService.ts` — set `locality` in `createMeeting`/`createRecurringMeetings`; fix `rescheduleMeeting` to preserve tentative.
- `services/translations.ts` — new en+ar keys.
- `server/database.ts` — `locality` + `on_behalf` migrations + locality backfill.
- `server/routes/meetings.ts` — create (locality/onBehalf/auth/force-pending), `PATCH /:id/status` (extended confirm auth), reschedule (preserve tentative), new `POST /:id/confirm-by-token`, serializers.
- `server/index.ts` — mount `delegatesRoutes`.

---

# PHASE 1 — Feature 1: Locality colors

### Task 1: Locality model, config, CSS vars, and pure helpers

**Files:**
- Modify: `types.ts` (after line 79, the `MeetingStatus`/`Meeting` block)
- Modify: `constants.ts` (after `CATEGORY_CONFIG`, ≈line 25; and `INITIAL_MEETINGS`, lines 111-176)
- Modify: `index.css` (`:root` block lines 12-65; `:root.dark` block lines 67-77)
- Create: `services/localityService.ts`
- Test: `tests/localityService.test.ts`

**Interfaces:**
- Produces: `type MeetingLocality = 'internal' | 'external'`; `LOCALITY_CONFIG: Record<MeetingLocality, { labelKey: string; cssVar: string; hex: string }>`; `deriveLocality(input: { bookedBy?: Role; category?: MeetingCategory; attendeeEmail?: string; hostEmail?: string }): MeetingLocality`; `getMeetingAccent(m: { locality?: MeetingLocality; bookedBy?: Role; category?: MeetingCategory; attendeeEmail?: string; hostEmail?: string }): { locality: MeetingLocality; colorVar: string }` where `colorVar` is e.g. `'var(--meeting-internal)'`.

- [ ] **Step 1: Add types to `types.ts`.** Insert immediately after the `Meeting` interface (after line 99):

```typescript
export type MeetingLocality = 'internal' | 'external';
```

Then add three optional fields inside the `Meeting` interface (after line 98 `meetingPlatform?`):

```typescript
  locality?: MeetingLocality; // internal (in-building, RED) vs external (different-building, BLACK)
  onBehalf?: boolean;         // tentative meeting scheduled on behalf of the host (boss)
  locationAddress?: string;   // physical address for in-person meetings (was read via `as any`)
```

Add a `Delegate` interface at the end of the file:

```typescript
export interface Delegate {
  principalUserId: string;
  delegateUserId: string;
  name?: string;     // counterpart user's display name (server-joined)
  scope?: string;    // defaults to 'calendar'
}
```

- [ ] **Step 2: Add `LOCALITY_CONFIG` to `constants.ts`.** After the `CATEGORY_CONFIG` block (line 25), and update the import on line 1 to include `MeetingLocality`:

Change line 1 from:
```typescript
import { Meeting, User, Team, MeetingCategory, VideoPlatform } from './types';
```
to:
```typescript
import { Meeting, User, Team, MeetingCategory, VideoPlatform, MeetingLocality } from './types';
```

Add after line 25:
```typescript
// Locality drives the primary meeting accent: internal = RED, external = BLACK.
// Colors are applied via CSS variables (see index.css) so dark mode adapts.
export const LOCALITY_CONFIG: Record<MeetingLocality, { labelKey: string; cssVar: string; hex: string }> = {
  internal: { labelKey: 'localityInternal', cssVar: '--meeting-internal', hex: '#DC2626' },
  external: { labelKey: 'localityExternal', cssVar: '--meeting-external', hex: '#000000' },
};
```

- [ ] **Step 3: Seed `locality` on `INITIAL_MEETINGS`.** Add a `locality` field to each of the 4 objects in `INITIAL_MEETINGS` (lines 111-176). Meeting `'3'` (Investment Review, category `client`) and any with a non-internal feel → `'external'`; the rest → `'internal'`. Concretely add `locality: 'internal',` to meetings `'1'`, `'2'`, `'4'` and `locality: 'external',` to meeting `'3'` (place the line right after each `category:` line).

- [ ] **Step 4: Add CSS variables to `index.css`.** In the `:root {...}` block (after line 32 `--color-dark-purple`), add:

```css
  /* Meeting locality accents (Feature 1) */
  --meeting-internal: #DC2626; /* RED — internal / in-building */
  --meeting-external: #000000; /* BLACK — external / different-building */
```

In the `:root.dark {...}` block (after line 76 `--color-off-white: #121212;`), add:

```css
  --meeting-external: #E5E7EB; /* high-contrast equivalent of black on the dark theme */
```

(`--meeting-internal` red is legible on both themes, so it is not overridden.)

- [ ] **Step 5: Write the failing test** `tests/localityService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { deriveLocality, getMeetingAccent } from '../services/localityService';

describe('deriveLocality', () => {
  it('defaults to internal with no signals', () => {
    expect(deriveLocality({})).toBe('internal');
  });
  it('is external when booked by a guest', () => {
    expect(deriveLocality({ bookedBy: 'guest' })).toBe('external');
  });
  it('is external for the client category', () => {
    expect(deriveLocality({ category: 'client' })).toBe('external');
  });
  it('is external when attendee email domain differs from host domain', () => {
    expect(deriveLocality({ attendeeEmail: 'x@outside.com', hostEmail: 'boss@acme.com' })).toBe('external');
  });
  it('stays internal when domains match', () => {
    expect(deriveLocality({ attendeeEmail: 'a@acme.com', hostEmail: 'boss@acme.com' })).toBe('internal');
  });
  it('skips the domain signal when either email is missing', () => {
    expect(deriveLocality({ attendeeEmail: 'a@acme.com' })).toBe('internal');
  });
});

describe('getMeetingAccent', () => {
  it('uses the explicit locality when present', () => {
    expect(getMeetingAccent({ locality: 'external' })).toEqual({ locality: 'external', colorVar: 'var(--meeting-external)' });
  });
  it('falls back to derivation when locality is absent', () => {
    expect(getMeetingAccent({ bookedBy: 'guest' })).toEqual({ locality: 'external', colorVar: 'var(--meeting-external)' });
    expect(getMeetingAccent({})).toEqual({ locality: 'internal', colorVar: 'var(--meeting-internal)' });
  });
});
```

- [ ] **Step 6: Run it; verify it fails.** Run: `yarn vitest run tests/localityService.test.ts` — Expected: FAIL ("Failed to resolve import '../services/localityService'").

- [ ] **Step 7: Implement `services/localityService.ts`:**

```typescript
import { Role, MeetingCategory, MeetingLocality } from '../types';
import { LOCALITY_CONFIG } from '../constants';

interface LocalitySignals {
  bookedBy?: Role;
  category?: MeetingCategory;
  attendeeEmail?: string;
  hostEmail?: string;
}

const domainOf = (email?: string): string | null => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return null;
  return email.split('@')[1].toLowerCase().trim() || null;
};

/** Smart default for a meeting's locality when the booker has not chosen one. */
export const deriveLocality = (s: LocalitySignals): MeetingLocality => {
  if (s.bookedBy === 'guest') return 'external';
  if (s.category === 'client') return 'external';
  const a = domainOf(s.attendeeEmail);
  const h = domainOf(s.hostEmail);
  if (a && h && a !== h) return 'external';
  return 'internal';
};

/** Resolve the accent (CSS var) for a meeting, falling back to derivation. */
export const getMeetingAccent = (
  m: { locality?: MeetingLocality } & LocalitySignals
): { locality: MeetingLocality; colorVar: string } => {
  const locality = m.locality ?? deriveLocality(m);
  return { locality, colorVar: `var(${LOCALITY_CONFIG[locality].cssVar})` };
};
```

- [ ] **Step 8: Run it; verify it passes.** Run: `yarn vitest run tests/localityService.test.ts` — Expected: PASS (10 assertions).

- [ ] **Step 9: Commit.**
```bash
git add types.ts constants.ts index.css services/localityService.ts tests/localityService.test.ts
git commit -m "feat(locality): add MeetingLocality model, config, CSS vars, and resolver helpers"
```

---

### Task 2: Server — persist & serialize `locality`

**Files:**
- Modify: `server/database.ts` (after line 484, the `20240145_meetings_approver_id` runOnce)
- Modify: `server/routes/meetings.ts` (create handler INSERT ≈414-425 + response ≈476-489; list mapper ≈161-187; single mapper ≈260-286)

**Interfaces:**
- Produces: DB column `meetings.locality TEXT` (nullable — public bookings that never set it derive on read in the serializer); API meeting objects now include a resolved `locality`.
- Consumes: nothing new.

- [ ] **Step 1: Add the migration + backfill** in `server/database.ts` immediately after line 484 (`runOnce('20240145_meetings_approver_id', ...)` closes at 484):

```typescript
    runOnce(
      '20240500_meetings_add_locality',
      `ALTER TABLE meetings ADD COLUMN locality TEXT`
    );
    // Column is NULLABLE on purpose: rows inserted by public/round-robin paths
    // (bookingLinks.ts, teamBookingLinks.ts, roundRobin.ts, crmHubspot.ts) never
    // set it, so NULL + the serializer's derive-on-read fallback (Step 5) colors
    // them correctly without editing those four INSERT sites. Backfill existing rows:
    runOnce(
      '20240501_meetings_backfill_locality',
      `UPDATE meetings SET locality = CASE WHEN booked_by = 'guest' OR category = 'client' THEN 'external' ELSE 'internal' END WHERE locality IS NULL`
    );
```

- [ ] **Step 2: Persist `locality` in the create handler.** In `server/routes/meetings.ts`, in the `POST /` handler, destructure `locality` from the body — change the destructure block (lines 297-301) to add `locality,`:

```typescript
    const {
      title, date, time, durationMinutes, attendeeName, attendeeEmail,
      additionalAttendees, hostId, notes, category, meetingFormat, meetingLink, meetingPlatform,
      locationAddress, externalId, locality,
    } = req.body;
```

After the `format` validation block (after line 310), add locality validation:

```typescript
    const localityClean: 'internal' | 'external' = locality === 'external' ? 'external' : 'internal';
```

- [ ] **Step 3: Add `locality` to the INSERT.** Replace the INSERT column list + values (lines 414-425). The current statement inserts 21 columns; add `locality` as the 22nd:

```typescript
    db.connection.prepare(`
      INSERT INTO meetings (id, title, date, time, duration_minutes, attendee_name, attendee_email, additional_attendees, user_id, host_id, status, booked_by, notes, category, meeting_format, meeting_link, meeting_platform, zoom_meeting_id, teams_meeting_id, location_address, external_id, locality)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      meetingId, title, date, time, durationMinutes || 30,
      attendeeName, attendeeEmail, additionalAttendees || null,
      userId, hostId, status, bookedBy, notes || null, category || 'general',
      format, finalMeetingLink || null, finalMeetingPlatform || null,
      zoomMeetingIdPersist, teamsMeetingIdPersist,
      format === 'in-person' ? locationAddressClean : null,
      typeof externalId === 'string' && externalId.length > 0 ? externalId : null,
      localityClean,
    );
```

- [ ] **Step 4: Return `locality` from create.** In the `res.status(201).json({...})` block (lines 476-489), add `locality: localityClean,` after `meetingPlatform: finalMeetingPlatform`.

- [ ] **Step 5: Add `locality` to both full serializers, deriving on read when NULL.** In the GET `/` list mapper (lines 161-187), add after `meetingFormat: m.meeting_format || 'in-person',`:
```typescript
      locality: m.locality || ((m.booked_by === 'guest' || m.category === 'client') ? 'external' : 'internal'),
```
Apply the identical addition in the GET `/:id` single mapper (lines 260-286), using:
```typescript
      locality: meeting.locality || ((meeting.booked_by === 'guest' || meeting.category === 'client') ? 'external' : 'internal'),
```
This is what makes public/guest bookings (which never set `locality`) render BLACK without touching their INSERT sites. `BookingCalendarView`'s local interface lacks `bookedBy`/`category`, so the server MUST resolve `locality` here rather than relying on frontend derivation.

- [ ] **Step 6: Verify the server still boots and typechecks.** Run: `yarn typecheck` — Expected: no new errors in `server/`. (No server test harness exists; correctness of the SQL is verified at runtime + by the frontend tasks that consume it.)

- [ ] **Step 7: Commit.**
```bash
git add server/database.ts server/routes/meetings.ts
git commit -m "feat(locality): persist and serialize meeting.locality on the server"
```

---

### Task 3: `MeetingList` — locality as the primary accent

**Files:**
- Modify: `components/MeetingList.tsx` (import line 6; card render lines 75, 92, 99-101)
- Test: `tests/components/MeetingList.locality.test.tsx`

**Interfaces:**
- Consumes: `getMeetingAccent`, `LOCALITY_CONFIG` (Task 1).

- [ ] **Step 1: Update imports.** Change line 6 from:
```typescript
import { CATEGORY_CONFIG } from '../constants';
```
to:
```typescript
import { CATEGORY_CONFIG, LOCALITY_CONFIG } from '../constants';
import { getMeetingAccent } from '../services/localityService';
```

- [ ] **Step 2: Resolve the accent per card.** Inside the `sortedMeetings.map(meeting => {` body, after line 75 (`const category = CATEGORY_CONFIG[meeting.category] || CATEGORY_CONFIG.general;`), add:
```typescript
            const accent = getMeetingAccent(meeting);
            const localityLabel = t(LOCALITY_CONFIG[accent.locality].labelKey);
```

- [ ] **Step 3: Make the left border the locality color.** Change line 92 from:
```typescript
                style={{ borderLeft: `4px solid ${category.color}` }}
```
to:
```typescript
                style={{ borderLeft: `4px solid ${accent.colorVar}` }}
```

- [ ] **Step 4: Color the title + demote category to a small label.** Replace the category badge (lines 99-101) and give the title the locality color. Replace this block:
```typescript
                         <span className="inline-block px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white" style={{ backgroundColor: category.color }}>
                            {category.label}
                         </span>
```
with:
```typescript
                         <span className="inline-block px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white" style={{ backgroundColor: accent.colorVar }}>
                            {localityLabel}
                         </span>
                         <span className="inline-block text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                            {category.label}
                         </span>
```
Then color the title (line ≈115 `<h4 ... >{meeting.title}</h4>`) by adding an inline style — change it to:
```typescript
                      <h4 className="font-serif font-bold text-base md:text-lg leading-tight line-clamp-2" style={{ color: accent.colorVar }}>{meeting.title}</h4>
```
(Removing the previous `text-charcoal dark:text-white` classes so the inline locality color takes effect.)

- [ ] **Step 5: Write the failing render test** `tests/components/MeetingList.locality.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MeetingList } from '../../components/MeetingList';
import { Meeting, User } from '../../types';

const user: User = { id: '1', username: 'm', role: 'manager', name: 'Boss', email: 'boss@acme.com' };
const base: Meeting = {
  id: 'a', title: 'Internal Sync', date: '2026-07-01', time: '10:00', durationMinutes: 30,
  attendeeName: 'Colleague', attendeeEmail: 'c@acme.com', hostId: '1', status: 'approved',
  bookedBy: 'manager', category: 'strategy', meetingFormat: 'in-person', locality: 'internal',
};
const ext: Meeting = { ...base, id: 'b', title: 'Client Pitch', locality: 'external', category: 'client' };
const t = (k: string) => k;

it('colors internal title with the internal CSS var and external with external', () => {
  render(
    <MeetingList meetings={[base, ext]} currentUser={user} onCancel={vi.fn()} onReschedule={vi.fn()}
      onApprove={vi.fn()} onReject={vi.fn()} t={t} lang="en" />
  );
  const internalTitle = screen.getByText('Internal Sync');
  const externalTitle = screen.getByText('Client Pitch');
  expect(internalTitle.getAttribute('style')).toContain('var(--meeting-internal)');
  expect(externalTitle.getAttribute('style')).toContain('var(--meeting-external)');
});
```

- [ ] **Step 6: Run it.** Run: `yarn vitest run tests/components/MeetingList.locality.test.tsx` — Expected: PASS. (If a child import like `MeetingDetailsModal` causes a jsdom error, the test still mounts the list cards; the queried titles render before any modal opens.)

- [ ] **Step 7: Commit.**
```bash
git add components/MeetingList.tsx tests/components/MeetingList.locality.test.tsx
git commit -m "feat(locality): MeetingList uses red/black locality accent; category demoted"
```

---

### Task 4: `MeetingDetailsModal` — locality badge + typed `locationAddress`

**Files:**
- Modify: `components/MeetingDetailsModal.tsx` (import line 4; line 41; badge lines 61-63)

**Interfaces:**
- Consumes: `getMeetingAccent`, `LOCALITY_CONFIG`, `Meeting.locationAddress` (now typed, Task 1).

- [ ] **Step 1: Update imports.** Change line 4 from:
```typescript
import { CATEGORY_CONFIG, VIDEO_PLATFORM_CONFIG } from '../constants';
```
to:
```typescript
import { CATEGORY_CONFIG, VIDEO_PLATFORM_CONFIG, LOCALITY_CONFIG } from '../constants';
import { getMeetingAccent } from '../services/localityService';
```

- [ ] **Step 2: Resolve accent + use the typed field.** After line 31 (`const category = CATEGORY_CONFIG[...]`), add:
```typescript
  const accent = getMeetingAccent(meeting);
  const localityLabel = t(LOCALITY_CONFIG[accent.locality].labelKey);
```
Change line 41 from:
```typescript
  const locationAddress = (meeting as any).locationAddress as string | undefined;
```
to:
```typescript
  const locationAddress = meeting.locationAddress;
```

- [ ] **Step 3: Add a locality badge.** In the header badges (after the category badge block, lines 61-63), insert a locality pill before the status badge:
```typescript
                 <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-white" style={{ backgroundColor: accent.colorVar }}>
                    {localityLabel}
                 </span>
```

- [ ] **Step 4: Typecheck.** Run: `yarn typecheck` — Expected: no errors (the `as any` removal now resolves against the typed field).

- [ ] **Step 5: Commit.**
```bash
git add components/MeetingDetailsModal.tsx
git commit -m "feat(locality): MeetingDetailsModal shows locality badge; type locationAddress"
```

---

### Task 5: `BookingModal` — Internal/External toggle + thread `locality`

**Files:**
- Modify: `components/BookingModal.tsx` (formData useState lines 33-46; reset effect lines 54-67; format section lines 241-287)

**Interfaces:**
- Produces: `formData.locality` in the payload passed to the parent `onSubmit`.
- Consumes: `deriveLocality` (Task 1).

- [ ] **Step 1: Import the helper + constant.** Change line 5 from:
```typescript
import { CATEGORY_CONFIG } from '../constants';
```
to:
```typescript
import { CATEGORY_CONFIG, LOCALITY_CONFIG } from '../constants';
import { deriveLocality } from '../services/localityService';
```
And add `MeetingLocality` to the type import on line 2 (`...User, MeetingCategory, MeetingLocality } from '../types';`).

- [ ] **Step 2: Add `locality` to both formData initializers.** In the `useState` initializer (lines 33-46) add after `locationAddress: ''`:
```typescript
    locality: 'internal' as MeetingLocality,
```
In the reset `useEffect` initializer (lines 54-67) add the same line after `locationAddress: ''`, but smart-default it:
```typescript
        locality: deriveLocality({ bookedBy: role, category: role === 'guest' ? 'client' : 'general', attendeeEmail: currentUser.email, hostEmail: host?.email }),
```

- [ ] **Step 3: Add the Internal/External segmented toggle** to step 1, immediately after the Meeting Format section closes (after line 287, the `</div>` ending the Location block). Insert:
```typescript
                {/* Locality (internal=RED / external=BLACK) */}
                <div>
                   <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">{t('localityLabel')}</label>
                   <div className="flex bg-gray-100 p-1 rounded-lg">
                      {(['internal', 'external'] as MeetingLocality[]).map(loc => (
                         <button
                           key={loc}
                           type="button"
                           onClick={() => setFormData({ ...formData, locality: loc })}
                           className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${formData.locality === loc ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-charcoal'}`}
                           style={formData.locality === loc ? { color: `var(${LOCALITY_CONFIG[loc].cssVar})` } : undefined}
                         >
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: `var(${LOCALITY_CONFIG[loc].cssVar})` }}></span>
                            {t(LOCALITY_CONFIG[loc].labelKey)}
                         </button>
                      ))}
                   </div>
                </div>
```

- [ ] **Step 4: Manual verification.** Run the app (`yarn dev`), open a booking, confirm the toggle appears in step 1, defaults sensibly (External when the attendee is a guest/client), and that the submitted payload includes `locality` (the parent threads it in Task 6). Run `yarn typecheck` — Expected: no errors.

- [ ] **Step 5: Commit.**
```bash
git add components/BookingModal.tsx
git commit -m "feat(locality): Internal/External toggle in BookingModal with smart default"
```

---

### Task 6: `index.tsx` — thread `locality` + fix the `locationAddress` drop bug

**Files:**
- Modify: `index.tsx` (`handleBookingSubmit` lines 369-438)

**Interfaces:**
- Consumes: `formData.locality`, `formData.locationAddress` (Task 5); writes them into the meeting saved to localStorage.

- [ ] **Step 1: Add the two fields to `newMeetingData`.** In `handleBookingSubmit`, the `newMeetingData` object (lines 372-388) currently omits both `locationAddress` and `locality`. Add them after `meetingLink: formData.meetingLink` (line 387):
```typescript
      locationAddress: formData.meetingFormat === 'in-person' ? formData.locationAddress : undefined,
      locality: formData.locality || 'internal',
```

- [ ] **Step 2: Verify no other change is needed.** `createMeeting`/`createRecurringMeetings` spread `...meetingData`, so the new fields flow through to the saved Meeting automatically, and the save `useEffect` (lines 225-229) persists them. Run: `yarn typecheck` — Expected: no errors (Meeting now declares both optional fields).

- [ ] **Step 3: Manual verification.** In the app, book an in-person meeting with an address and an External locality; reopen it via `MeetingDetailsModal` and confirm the address shows and the card is BLACK; book an internal one and confirm it is RED.

- [ ] **Step 4: Commit.**
```bash
git add index.tsx
git commit -m "fix(booking): thread locality + locationAddress through handleBookingSubmit (stops silent drop)"
```

---

### Task 7: Calendar views — color month indicators by locality

**Files:**
- Modify: `components/CalendarGrid.tsx` (imports line 1-3; dot render lines 206 + 257)
- Modify: `components/BookingCalendarView.tsx` (local `Meeting` interface lines 5-13; count badge + chips lines 159-181)

**Interfaces:**
- Consumes: `getMeetingAccent`, `LOCALITY_CONFIG` (Task 1). `BookingCalendarView` reads `locality` now returned by the API (Task 2).

- [ ] **Step 1: CalendarGrid — import helper.** Add after line 3:
```typescript
import { getMeetingAccent } from '../services/localityService';
```

- [ ] **Step 2: CalendarGrid — color the dot.** The single presence dot (line 257) is `<div className="absolute bottom-1 w-1 h-1 bg-al-adaam rounded-full"></div>`. Replace it so it takes the locality color of the day's first meeting (or stacks up to two dots). Replace with:
```typescript
                {!isRangeMode && day.isCurrentMonth && dayMeetings.length > 0 && !day.isSelected && (
                  <div className="absolute bottom-1 flex gap-0.5">
                    {Array.from(new Set(dayMeetings.map(m => getMeetingAccent(m).colorVar))).slice(0, 2).map((c, i) => (
                      <div key={i} className="w-1 h-1 rounded-full" style={{ background: c }}></div>
                    ))}
                  </div>
                )}
```
(Replaces the whole existing `{!isRangeMode && ... <div className="absolute bottom-1 ..."></div>}` block at lines 256-258.)

- [ ] **Step 3: BookingCalendarView — add `locality` to the local interface.** In the local `Meeting` interface (lines 5-13) add:
```typescript
  locality?: 'internal' | 'external';
```

- [ ] **Step 4: BookingCalendarView — color chips by locality.** Import the config + helper at the top (after line 3):
```typescript
import { getMeetingAccent } from '../services/localityService';
```
Then in the chip render (lines 169-176), change each chip's left accent to the locality color. Replace the chip `<div>`:
```typescript
                    <div
                      key={m.id}
                      className="text-[10px] truncate text-charcoal px-1.5 py-0.5 rounded border-l-2"
                      style={{ borderColor: getMeetingAccent(m).colorVar, background: '#f3f4f6' }}
                      title={`${m.time} – ${m.title}`}
                    >
                      <span className="font-mono text-gray-500 mr-1">{m.time}</span>
                      {m.title}
                    </div>
```

- [ ] **Step 5: Manual verification + typecheck.** `yarn typecheck` — Expected: no errors. Visually confirm month dots/chips reflect red/black.

- [ ] **Step 6: Commit.**
```bash
git add components/CalendarGrid.tsx components/BookingCalendarView.tsx
git commit -m "feat(locality): color calendar month dots and booking-view chips by locality"
```

---

### Task 7b: Dashboard — locality accent on hero + activity dots

**Files:**
- Modify: `components/Dashboard.tsx` (next-meeting hero accent; recent-activity dots)

**Interfaces:**
- Consumes: `getMeetingAccent` (Task 1).

> This file was not pre-extracted. **First read `components/Dashboard.tsx` in full**, then apply the established Task-3 pattern (resolve `const accent = getMeetingAccent(meeting);` and apply `accent.colorVar` via inline `style`).

- [ ] **Step 1: Import the helper.** Add `import { getMeetingAccent } from '../services/localityService';` to the Dashboard imports.

- [ ] **Step 2: Color the next-meeting hero.** Find the "next meeting" hero/card render (it renders a single upcoming `meeting`). Apply the locality color to its primary accent (border, side bar, or title) exactly as MeetingList does: `style={{ borderColor: getMeetingAccent(meeting).colorVar }}` (or `color:` on the title). Do NOT introduce a Tailwind dynamic class — inline style only.

- [ ] **Step 3: Color the recent-activity dots.** Find the recent-activity list where each row renders a small status/category dot. Replace the dot's fixed color with `style={{ background: getMeetingAccent(item).colorVar }}` where `item` is the meeting for that row. If a row is not backed by a `Meeting` (e.g. a generic log entry), leave it unchanged.

- [ ] **Step 4: Typecheck + manual verification.** Run `yarn typecheck`. In the app, confirm the dashboard hero and activity dots reflect red/black per the meeting's locality.

- [ ] **Step 5: Commit.**
```bash
git add components/Dashboard.tsx
git commit -m "feat(locality): color Dashboard hero + activity dots by locality"
```

---

# PHASE 2 — Feature 2: Tentative on-behalf scheduling

### Task 8: Server — `on_behalf` column + delegates table wiring + `canActOnBehalf`

**Files:**
- Modify: `server/database.ts` (after the Task 2 migrations, ≈line 484 area)
- Create: `server/routes/delegates.ts`
- Modify: `server/index.ts` (import ≈line 49; mount ≈line 174)
- Test: `tests/delegationAuth.test.ts`

**Interfaces:**
- Produces: `meetings.on_behalf INTEGER DEFAULT 0`; routes `GET/POST/DELETE /api/delegates`; exported `canActOnBehalf(delegateUserId: string, principalUserId: string, role: string): boolean`.

- [ ] **Step 1: Add the `on_behalf` migration** in `server/database.ts` right after the `20240501_meetings_backfill_locality` runOnce (from Task 2):
```typescript
    runOnce(
      '20240502_meetings_add_on_behalf',
      `ALTER TABLE meetings ADD COLUMN on_behalf INTEGER DEFAULT 0`
    );
```

- [ ] **Step 2: Write the failing auth test** `tests/delegationAuth.test.ts`. `canActOnBehalf` reads from the DB; the *rule* is extracted into a DB-free module so the test never imports `better-sqlite3`. Test that pure module:

```typescript
import { describe, it, expect } from 'vitest';
import { isDelegationAllowed } from '../server/utils/delegationRules';

describe('isDelegationAllowed', () => {
  it('admins may always act on behalf', () => {
    expect(isDelegationAllowed('admin', false)).toBe(true);
  });
  it('a registered delegate may act', () => {
    expect(isDelegationAllowed('manager', true)).toBe(true);
  });
  it('a non-delegate non-admin may not', () => {
    expect(isDelegationAllowed('manager', false)).toBe(false);
  });
});
```

- [ ] **Step 3: Run it; verify it fails.** Run: `yarn vitest run tests/delegationAuth.test.ts` — Expected: FAIL (cannot resolve `../server/utils/delegationRules`).

- [ ] **Step 4: Create the pure rule** `server/utils/delegationRules.ts` (NO `db` import — keeps the test free of native better-sqlite3):

```typescript
/** Pure authorization rule for acting on behalf of another user. */
export function isDelegationAllowed(role: string, isRegisteredDelegate: boolean): boolean {
  return role === 'admin' || isRegisteredDelegate;
}
```

- [ ] **Step 5: Run it; verify it passes.** Run: `yarn vitest run tests/delegationAuth.test.ts` — Expected: PASS (3 assertions).

- [ ] **Step 6: Create `server/routes/delegates.ts`** (mirrors the `ooo.ts` pattern — `asyncHandler`, `authenticateToken`, `AppError`, `db.connection`; reuses the pure rule):

```typescript
/**
 * Delegation: who may schedule meetings on behalf of whom (the user_delegates
 * table). principal = the boss whose calendar is acted on; delegate = the
 * assistant. Used to authorize on-behalf (tentative) bookings.
 */
import { Router, Response, NextFunction, Request } from 'express';
import { db } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { isDelegationAllowed } from '../utils/delegationRules';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

/** Whether `delegateUserId` may act on behalf of `principalUserId`. */
export function canActOnBehalf(delegateUserId: string, principalUserId: string, role: string): boolean {
  if (delegateUserId === principalUserId) return true; // acting for yourself is always fine
  const row = db.connection.prepare(
    `SELECT 1 FROM user_delegates WHERE principal_user_id = ? AND delegate_user_id = ?`
  ).get(principalUserId, delegateUserId);
  return isDelegationAllowed(role, !!row);
}

// List delegations involving me (both directions).
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const me = req.user!.userId;
  const iManage = db.connection.prepare(`
    SELECT d.principal_user_id, d.delegate_user_id, d.scope, u.name
    FROM user_delegates d LEFT JOIN users u ON u.id = d.principal_user_id
    WHERE d.delegate_user_id = ?
  `).all(me) as any[];
  const myDelegates = db.connection.prepare(`
    SELECT d.principal_user_id, d.delegate_user_id, d.scope, u.name
    FROM user_delegates d LEFT JOIN users u ON u.id = d.delegate_user_id
    WHERE d.principal_user_id = ?
  `).all(me) as any[];
  const map = (r: any) => ({ principalUserId: r.principal_user_id, delegateUserId: r.delegate_user_id, scope: r.scope, name: r.name });
  res.json({ iManage: iManage.map(map), myDelegates: myDelegates.map(map) });
}));

// Add a delegate who may act on MY behalf.
router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const me = req.user!.userId;
  const { delegateUserId, scope } = req.body ?? {};
  if (typeof delegateUserId !== 'string' || !delegateUserId) throw new AppError('delegateUserId required', 400);
  if (delegateUserId === me) throw new AppError('You cannot delegate to yourself', 400);
  const exists = db.connection.prepare(`SELECT id FROM users WHERE id = ?`).get(delegateUserId);
  if (!exists) throw new AppError('Delegate user not found', 404);
  db.connection.prepare(
    `INSERT OR IGNORE INTO user_delegates (principal_user_id, delegate_user_id, scope) VALUES (?, ?, ?)`
  ).run(me, delegateUserId, typeof scope === 'string' ? scope : 'calendar');
  res.status(201).json({ principalUserId: me, delegateUserId, scope: scope || 'calendar' });
}));

// Remove a delegate of mine.
router.delete('/:delegateUserId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = db.connection.prepare(
    `DELETE FROM user_delegates WHERE principal_user_id = ? AND delegate_user_id = ?`
  ).run(req.user!.userId, req.params.delegateUserId);
  if (result.changes === 0) throw new AppError('Delegation not found', 404);
  res.json({ success: true });
}));

export default router;
```

- [ ] **Step 7: Mount the router.** In `server/index.ts`, add the import after line 49 (`import domainsRoutes ...`):
```typescript
import delegatesRoutes from './routes/delegates';
```
And the mount after line 174 (`app.use('/api/domains', domainsRoutes);`):
```typescript
app.use('/api/delegates', delegatesRoutes);
```

- [ ] **Step 8: Typecheck + commit.** Run: `yarn typecheck`.
```bash
git add server/database.ts server/utils/delegationRules.ts server/routes/delegates.ts server/index.ts tests/delegationAuth.test.ts
git commit -m "feat(delegates): wire user_delegates CRUD + canActOnBehalf + meetings.on_behalf column"
```

---

### Task 9: Server — on-behalf create, confirm authorization, confirm-by-token, reschedule guard

**Files:**
- Modify: `server/routes/meetings.ts` (imports line 5-13; create handler 293-490; `PATCH /:id/status` 492-632; reschedule 634-674; serializers)

**Interfaces:**
- Consumes: `canActOnBehalf` (Task 8).
- Produces: on-behalf meetings persist `on_behalf=1`, `status='pending'`, `approval_required=1`, `approver_id=host`, an `attendee_token`; `POST /api/meetings/:id/confirm-by-token`; `on_behalf` in serializers.

- [ ] **Step 1: Import `canActOnBehalf` and `uuid` (already imported).** Add after line 9 (`import { trackChallengeProgress } from './challenges';`):
```typescript
import { canActOnBehalf } from './delegates';
```

- [ ] **Step 2: No new destructure needed.** `locality` was added to the `POST /` destructure in Task 2. On-behalf is derived from `hostId` vs the requester (below), NOT read from the body — so do not add an `onBehalf` body field. (The frontend still sends `onBehalf:true` harmlessly; the server ignores it.)

- [ ] **Step 3: Close the open-host hole + force tentative for any cross-host create.** Replace the status-derivation line (line 360, `const status = ['admin', 'manager', 'subordinate'].includes(bookedBy) ? 'approved' : 'pending';`) with:
```typescript
    const requesterId = req.user?.userId || null;
    // ANY create targeting another user's calendar is treated as "on behalf".
    // This also closes the previously-open hole where any authed user could set
    // an arbitrary hostId: canActOnBehalf returns true ONLY for admins and
    // registered delegates of that host.
    const isOnBehalf = !!hostId && hostId !== requesterId;
    if (isOnBehalf && (!requesterId || !canActOnBehalf(requesterId, hostId, bookedBy))) {
      throw new AppError('You are not authorized to schedule on behalf of this host', 403);
    }
    // On-behalf meetings stay tentative (pending) until confirmed; otherwise the usual role rule.
    const status = isOnBehalf
      ? 'pending'
      : (['admin', 'manager', 'subordinate'].includes(bookedBy) ? 'approved' : 'pending');
    const attendeeToken = isOnBehalf ? uuidv4() : null;
```
> **Verification (spec §6 / risk):** before committing, `grep -rn "api/meetings'" components/ services/` and confirm no legitimate authenticated UI calls `POST /api/meetings` with a `hostId` different from the logged-in user WITHOUT a delegation. The in-app booking flow writes to localStorage (not this endpoint), so the main risk is admin tooling — admins pass the check. If a legitimate non-admin, non-delegate cross-host flow exists, surface it rather than silently breaking it.

- [ ] **Step 4: Persist on-behalf columns.** Extend the INSERT (already edited in Task 2) to also set `on_behalf`, `approval_required`, `approver_id`, and `attendee_token`. Update the column list, placeholders, and values:
```typescript
    db.connection.prepare(`
      INSERT INTO meetings (id, title, date, time, duration_minutes, attendee_name, attendee_email, additional_attendees, user_id, host_id, status, booked_by, notes, category, meeting_format, meeting_link, meeting_platform, zoom_meeting_id, teams_meeting_id, location_address, external_id, locality, on_behalf, approval_required, approver_id, attendee_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      meetingId, title, date, time, durationMinutes || 30,
      attendeeName, attendeeEmail, additionalAttendees || null,
      userId, hostId, status, bookedBy, notes || null, category || 'general',
      format, finalMeetingLink || null, finalMeetingPlatform || null,
      zoomMeetingIdPersist, teamsMeetingIdPersist,
      format === 'in-person' ? locationAddressClean : null,
      typeof externalId === 'string' && externalId.length > 0 ? externalId : null,
      localityClean,
      isOnBehalf ? 1 : 0,
      isOnBehalf ? 1 : 0,
      isOnBehalf ? hostId : null,
      attendeeToken,
    );
```
Add `onBehalf: isOnBehalf,` to the create response JSON (the `res.status(201).json` block).

- [ ] **Step 5: Best-effort tentative email on create.** After the existing `if (status === 'approved') { syncMeetingToCalendar... }` block, add a tentative-notification IIFE (mirrors the existing dynamic-import email pattern):
```typescript
    if (isOnBehalf) {
      (async () => {
        try {
          const { sendBookingRequested } = await import('../services/bookingEmails');
          const host = db.connection.prepare(`SELECT name, email FROM users WHERE id = ?`).get(hostId) as any;
          await sendBookingRequested?.({
            meetingId, meetingTitle: title, date, time, durationMinutes: durationMinutes || 30,
            attendeeName, attendeeEmail, hostName: host?.name ?? 'Host', hostEmail: host?.email,
            attendeeToken, notes: notes || null,
          });
        } catch (e) { console.error('Tentative on-behalf email failed (non-blocking):', e); }
      })();
    }
```
(If `sendBookingRequested` does not exist in `bookingEmails`, the optional-call `?.` no-ops; confirm during implementation and fall back to `sendBookingApproved` semantics only on confirm. Email is best-effort regardless.)

- [ ] **Step 6: Extend confirm authorization in `PATCH /:id/status`.** Replace the host-or-admin gate (line 508):
```typescript
    if (['approved', 'rejected'].includes(status) && meeting.host_id !== req.user!.userId && req.user!.role !== 'admin') {
      throw new AppError('Only the host can approve or reject', 403);
    }
```
with one that also allows the creator and a registered delegate (so the assistant can accept on the boss's behalf):
```typescript
    if (['approved', 'rejected'].includes(status)) {
      const callerId = req.user!.userId;
      const callerRole = req.user!.role;
      const allowed =
        callerRole === 'admin' ||
        meeting.host_id === callerId ||
        meeting.user_id === callerId ||
        canActOnBehalf(callerId, meeting.host_id, callerRole);
      if (!allowed) throw new AppError('Not authorized to confirm or decline this meeting', 403);
    }
```

- [ ] **Step 7: Add `POST /:id/confirm-by-token`** (invitee confirmation; no auth middleware — token IS the auth). Add before `export default router;` (line 820):
```typescript
// Invitee confirms a tentative meeting via their attendee token -> approved.
router.post('/:id/confirm-by-token', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { token } = req.body || {};
    if (typeof token !== 'string' || !token) throw new AppError('token required', 400);
    const meeting = db.connection.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as any;
    if (!meeting) throw new AppError('Meeting not found', 404);
    if (!meeting.attendee_token || meeting.attendee_token !== token) throw new AppError('Invalid token', 403);
    if (meeting.status !== 'pending') {
      return res.json({ message: `Meeting already ${meeting.status}`, status: meeting.status });
    }
    db.connection.prepare(`UPDATE meetings SET status = 'approved', updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), id);
    syncMeetingToCalendar(id).catch(err => console.error('Failed to sync confirmed meeting:', err));
    (async () => {
      try {
        const { dispatchTrigger, scheduleForMeeting } = await import('../services/workflowEngine');
        const host = db.connection.prepare(`SELECT id, name, email FROM users WHERE id = ?`).get(meeting.host_id) as any;
        await dispatchTrigger('booking.approved', {
          meeting, attendee: { name: meeting.attendee_name, email: meeting.attendee_email },
          host: host ? { id: host.id, name: host.name, email: host.email } : { id: meeting.host_id },
        });
        await scheduleForMeeting(id);
      } catch (e) { console.error('confirm-by-token workflow dispatch failed:', e); }
    })();
    db.connection.prepare(`INSERT INTO activity_logs (id, action, details, performed_by, role) VALUES (?, 'APPROVED', ?, ?, ?)`)
      .run(uuidv4(), `Confirmed by invitee (token) ${id}`, meeting.attendee_name || 'invitee', 'guest');
    res.json({ message: 'Meeting confirmed', status: 'approved' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to confirm meeting', 500);
  }
});
```

- [ ] **Step 8: Guard reschedule against clobbering tentative.** In `PATCH /:id/reschedule`, replace the unconditional `status = 'approved'` UPDATE (line 660):
```typescript
    db.connection.prepare(`
      UPDATE meetings SET date = ?, time = ?, status = 'approved', updated_at = ? WHERE id = ?
    `).run(date, time, new Date().toISOString(), id);
```
with one that preserves a pending tentative:
```typescript
    const keptStatus = (meeting.status === 'pending' && meeting.on_behalf) ? 'pending' : 'approved';
    db.connection.prepare(`
      UPDATE meetings SET date = ?, time = ?, status = ?, updated_at = ? WHERE id = ?
    `).run(date, time, keptStatus, new Date().toISOString(), id);
```

- [ ] **Step 9: Add `on_behalf` to both full serializers.** In the GET `/` list mapper and the GET `/:id` mapper, add after the `locality` line (from Task 2):
```typescript
      onBehalf: !!m.on_behalf,
```
(use `!!meeting.on_behalf` in the single mapper).

- [ ] **Step 10: Typecheck + commit.** Run: `yarn typecheck`.
```bash
git add server/routes/meetings.ts
git commit -m "feat(tentative): on-behalf create (forced pending + delegate auth), confirm-by-token, reschedule guard"
```

---

### Task 10: localStorage path — preserve tentative on reschedule

**Files:**
- Modify: `services/schedulerService.ts` (`rescheduleMeeting` lines 256-266; `createMeeting`/`createRecurringMeetings` 186-238)
- Test: `tests/schedulerService.locality.test.ts`

**Interfaces:**
- Consumes: `Meeting.onBehalf`, `Meeting.locality` (Task 1).

- [ ] **Step 1: Write the failing test** `tests/schedulerService.locality.test.ts` (targets the REAL signatures — `createMeeting(existing, data, role)` returns an array; `rescheduleMeeting(meetings, id, date, time)`):

```typescript
import { describe, it, expect } from 'vitest';
import { createMeeting, rescheduleMeeting } from '../services/schedulerService';
import { Meeting } from '../types';

const data = {
  title: 'T', date: '2026-07-01', time: '10:00', durationMinutes: 30,
  attendeeName: 'A', attendeeEmail: 'a@x.com', hostId: '1', bookedBy: 'subordinate' as const,
  category: 'general' as const, meetingFormat: 'in-person' as const, locality: 'internal' as const,
};

describe('createMeeting preserves locality', () => {
  it('keeps the locality passed in the data', () => {
    const [m] = createMeeting([], { ...data, locality: 'external' }, 'manager');
    expect(m.locality).toBe('external');
  });
});

describe('rescheduleMeeting preserves a tentative on-behalf meeting', () => {
  const tentative: Meeting = { ...data, id: 'm1', status: 'pending', onBehalf: true };
  const normal: Meeting = { ...data, id: 'm2', status: 'approved' };
  it('keeps pending for an on-behalf tentative', () => {
    const out = rescheduleMeeting([tentative], 'm1', '2026-07-02', '11:00');
    expect(out[0].status).toBe('pending');
    expect(out[0].date).toBe('2026-07-02');
  });
  it('still approves a normal reschedule', () => {
    const out = rescheduleMeeting([normal], 'm2', '2026-07-02', '11:00');
    expect(out[0].status).toBe('approved');
  });
});
```

- [ ] **Step 2: Run it; verify the reschedule test fails.** Run: `yarn vitest run tests/schedulerService.locality.test.ts` — Expected: FAIL on the "keeps pending" case (current code forces `'approved'`).

- [ ] **Step 3: Fix `rescheduleMeeting`** (lines 260-266). Replace:
```typescript
export const rescheduleMeeting = (
  meetings: Meeting[],
  meetingId: string,
  newDate: string,
  newTime: string
): Meeting[] => {
  return meetings.map(m =>
    m.id === meetingId ? { ...m, date: newDate, time: newTime, status: 'approved' } : m
  );
};
```
with:
```typescript
export const rescheduleMeeting = (
  meetings: Meeting[],
  meetingId: string,
  newDate: string,
  newTime: string
): Meeting[] => {
  return meetings.map(m => {
    if (m.id !== meetingId) return m;
    // Preserve a tentative on-behalf meeting; otherwise (re)confirm as before.
    const status = (m.status === 'pending' && m.onBehalf) ? 'pending' : 'approved';
    return { ...m, date: newDate, time: newTime, status };
  });
};
```

- [ ] **Step 4: Run it; verify it passes.** Run: `yarn vitest run tests/schedulerService.locality.test.ts` — Expected: PASS (3 assertions).

- [ ] **Step 5: Commit.**
```bash
git add services/schedulerService.ts tests/schedulerService.locality.test.ts
git commit -m "fix(scheduler): rescheduleMeeting preserves tentative on-behalf status"
```

---

### Task 11: Frontend delegation API client

**Files:**
- Create: `services/delegationApi.ts`

**Interfaces:**
- Consumes: `apiJson` (`services/api.ts`), `Delegate` (Task 1).
- Produces: `listDelegates()`, `addDelegate(delegateUserId)`, `removeDelegate(delegateUserId)`, `createOnBehalfMeeting(payload)`, `confirmMeeting(id)`, `declineMeeting(id)`, `confirmByToken(id, token)`, `fetchMyTentatives()`.

- [ ] **Step 1: Create `services/delegationApi.ts`:**
```typescript
import { apiJson } from './api';
import { Delegate, Meeting } from '../types';

export interface DelegateLists { iManage: Delegate[]; myDelegates: Delegate[]; }

export const listDelegates = () => apiJson<DelegateLists>('/api/delegates');

export const addDelegate = (delegateUserId: string, scope = 'calendar') =>
  apiJson<Delegate>('/api/delegates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delegateUserId, scope }),
  });

export const removeDelegate = (delegateUserId: string) =>
  apiJson<{ success: boolean }>(`/api/delegates/${delegateUserId}`, { method: 'DELETE' });

/** Create a tentative meeting on the boss's (hostId's) server calendar. */
export const createOnBehalfMeeting = (payload: Partial<Meeting> & { hostId: string }) =>
  apiJson<Meeting>('/api/meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, onBehalf: true }),
  });

export const confirmMeeting = (id: string) =>
  apiJson<{ message: string }>(`/api/meetings/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'approved' }),
  });

export const declineMeeting = (id: string) =>
  apiJson<{ message: string }>(`/api/meetings/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'rejected' }),
  });

export const confirmByToken = (id: string, token: string) =>
  apiJson<{ message: string; status: string }>(`/api/meetings/${id}/confirm-by-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

/** Server tentatives where I am host or creator, to merge into the in-app calendar. */
export const fetchMyTentatives = () => apiJson<Meeting[]>('/api/meetings?status=pending');
```

- [ ] **Step 2: Typecheck.** Run: `yarn typecheck` — Expected: no errors.

- [ ] **Step 3: Commit.**
```bash
git add services/delegationApi.ts
git commit -m "feat(tentative): frontend delegation API client (delegates + on-behalf + confirm)"
```

---

### Task 12: Translations (en + ar)

**Files:**
- Modify: `services/translations.ts` (en block; ar block)

**Interfaces:** Produces translation keys consumed across Tasks 3-5, 13-15.

- [ ] **Step 1: Add new keys to the `en` block** (alongside existing keys; `managingManager`, `internalSync`, `externalGuest`, `internalInfo`, `colorHex` already exist — reuse them, do not duplicate):
```typescript
    localityLabel: "Location",
    localityInternal: "Internal",
    localityExternal: "External",
    tentative: "Tentative",
    confirmed: "Confirmed",
    awaitingConfirmation: "Awaiting confirmation",
    scheduledOnBehalf: "Scheduled by {by} for {for}",
    accept: "Accept",
    decline: "Decline",
    manageDelegates: "Manage delegates",
    addDelegate: "Add delegate",
    whoCanBookForMe: "Who can book on my behalf",
    whoseCalendarIManage: "Calendars I manage",
    confirmInviteTitle: "Confirm your meeting",
    confirmInviteCta: "Confirm",
    confirmInviteDone: "Your meeting is confirmed.",
```

- [ ] **Step 2: Add the same keys to the `ar` block:**
```typescript
    localityLabel: "الموقع",
    localityInternal: "داخلي",
    localityExternal: "خارجي",
    tentative: "مبدئي",
    confirmed: "مؤكد",
    awaitingConfirmation: "بانتظار التأكيد",
    scheduledOnBehalf: "حجزه {by} نيابة عن {for}",
    accept: "قبول",
    decline: "رفض",
    manageDelegates: "إدارة المفوضين",
    addDelegate: "إضافة مفوض",
    whoCanBookForMe: "من يمكنه الحجز نيابة عني",
    whoseCalendarIManage: "التقويمات التي أديرها",
    confirmInviteTitle: "أكد اجتماعك",
    confirmInviteCta: "تأكيد",
    confirmInviteDone: "تم تأكيد اجتماعك.",
```

- [ ] **Step 3: Verify access.** `index.tsx`'s `t('localityLabel')` returns the value; `{by}/{for}` placeholders are substituted by the caller (Task 14). Run: `yarn typecheck`.

- [ ] **Step 4: Commit.**
```bash
git add services/translations.ts
git commit -m "feat(i18n): en+ar strings for locality, tentative, delegates, confirm-invite"
```

---

### Task 13: `DelegatesManager` component

**Files:**
- Create: `components/DelegatesManager.tsx`
- Modify: `index.tsx` (render it within an existing settings surface — e.g. the account/profile area; see Step 3)

**Interfaces:**
- Consumes: `listDelegates/addDelegate/removeDelegate` (Task 11), `availableHosts` (users to pick from), `t`, `lang`.

- [ ] **Step 1: Create `components/DelegatesManager.tsx`:**
```typescript
import React, { useEffect, useState } from 'react';
import { User, Language } from '../types';
import { Button } from './Button';
import { listDelegates, addDelegate, removeDelegate, DelegateLists } from '../services/delegationApi';

interface Props { users: User[]; t: (k: string) => string; lang: Language; }

export const DelegatesManager: React.FC<Props> = ({ users, t, lang }) => {
  const isRTL = lang === 'ar';
  const [data, setData] = useState<DelegateLists>({ iManage: [], myDelegates: [] });
  const [picked, setPicked] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try { setData(await listDelegates()); }
    catch (e: any) { setError(e?.body?.error || e?.message || 'Failed to load'); }
  };
  useEffect(() => { load(); }, []);

  const onAdd = async () => {
    if (!picked) return;
    try { await addDelegate(picked); setPicked(''); await load(); }
    catch (e: any) { setError(e?.body?.error || e?.message || 'Failed to add'); }
  };
  const onRemove = async (id: string) => {
    try { await removeDelegate(id); await load(); }
    catch (e: any) { setError(e?.body?.error || e?.message || 'Failed to remove'); }
  };
  const nameOf = (id: string) => users.find(u => u.id === id)?.name || id;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-4">
      <h4 className="text-xs font-bold uppercase tracking-widest text-dune">{t('manageDelegates')}</h4>
      {error && <p className="text-xs text-salmon">{error}</p>}
      <div>
        <p className="text-[10px] uppercase text-gray-400 font-bold mb-2">{t('whoCanBookForMe')}</p>
        <div className="space-y-2">
          {data.myDelegates.map(d => (
            <div key={d.delegateUserId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-sm text-charcoal">{nameOf(d.delegateUserId)}</span>
              <button onClick={() => onRemove(d.delegateUserId)} className="text-salmon text-xs font-bold">{t('decline')}</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <select value={picked} onChange={e => setPicked(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">—</option>
            {users.filter(u => u.role !== 'guest').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <Button onClick={onAdd} disabled={!picked}>{t('addDelegate')}</Button>
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase text-gray-400 font-bold mb-2">{t('whoseCalendarIManage')}</p>
        <div className="space-y-2">
          {data.iManage.map(d => (
            <div key={d.principalUserId} className="p-2 bg-gray-50 rounded-lg text-sm text-charcoal">{nameOf(d.principalUserId)}</div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck.** Run: `yarn typecheck`.

- [ ] **Step 3: Mount it.** In `index.tsx`, render `<DelegatesManager users={availableHosts} t={t} lang={lang} />` inside an existing settings/profile view (locate the account-settings or profile render section and add it as a new card). Import at the top: `import { DelegatesManager } from './components/DelegatesManager';`. If no obvious settings panel exists in `index.tsx`, mount it in `components/AccountSettingsPage.tsx` instead (pass `users`/`t`/`lang`). Verify it renders in the running app.

- [ ] **Step 4: Commit.**
```bash
git add components/DelegatesManager.tsx index.tsx
git commit -m "feat(delegates): DelegatesManager panel to manage on-behalf permissions"
```

---

### Task 14: On-behalf booking → server, with principal selection

**Files:**
- Modify: `components/BookingModal.tsx` (the `bookOnBehalf` toggle area, step 2, lines 363-373; add a principal picker)
- Modify: `index.tsx` (`handleBookingSubmit` — branch to server create when on-behalf)

**Interfaces:**
- Consumes: `createOnBehalfMeeting` (Task 11), `bookOnBehalf` state (already exists in BookingModal).

- [ ] **Step 1: Surface the on-behalf intent in the payload.** In `BookingModal.handleSubmit` (line 122), include `bookOnBehalf` and a chosen principal in the submitted data. Change `handleSubmit` to:
```typescript
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit({ ...formData, bookOnBehalf }); setStep(4); };
```
The host being booked (`selectedHost` in the parent) IS the principal/boss, so no extra picker is required for the common "assistant books for the selected boss" flow — `bookOnBehalf` simply marks intent.

- [ ] **Step 2: Branch `handleBookingSubmit` to the server for on-behalf.** In `index.tsx`, at the top of `handleBookingSubmit` (after the guard on line 370), add an on-behalf branch that calls the server and merges the returned tentative into local state, instead of the localStorage `createMeeting` path:
```typescript
    if (formData.bookOnBehalf && selectedHost.id !== currentUser.id) {
      const baseDateStr = selectedDate.toISOString().split('T')[0];
      import('./services/delegationApi').then(({ createOnBehalfMeeting }) =>
        createOnBehalfMeeting({
          title: formData.title,
          category: formData.category || 'general',
          date: baseDateStr,
          time: selectedSlot.label,
          durationMinutes: formData.duration || bookingDuration,
          attendeeName: formData.attendeeName,
          attendeeEmail: formData.attendeeEmail,
          additionalAttendees: formData.additionalAttendees,
          notes: formData.notes,
          hostId: selectedHost.id,
          meetingFormat: formData.meetingFormat || 'in-person',
          meetingLink: formData.meetingLink,
          locationAddress: formData.meetingFormat === 'in-person' ? formData.locationAddress : undefined,
          locality: formData.locality || 'internal',
        })
      ).then((created) => {
        setMeetings(prev => [...prev, { ...(created as any), bookedBy: currentUser.role, userId: currentUser.id }]);
        addToast('success', t('awaitingConfirmation'));
      }).catch((e: any) => addToast('error', e?.body?.error || e?.message || 'Failed'));
      return;
    }
```
(This sits BEFORE the existing recurrence/single-meeting localStorage logic, which remains unchanged for normal bookings.)

- [ ] **Step 3: Typecheck + manual verification.** As a `subordinate`/`manager` who is a registered delegate of the selected host, toggle "Booking for someone else?", submit, and confirm: (a) a toast says "Awaiting confirmation", (b) the meeting appears tentative (Task 15 styling), (c) a non-delegate gets a 403 toast.

- [ ] **Step 4: Commit.**
```bash
git add components/BookingModal.tsx index.tsx
git commit -m "feat(tentative): on-behalf bookings create a server-side tentative on the boss's calendar"
```

---

### Task 15: Tentative visuals + merge server tentatives + Accept/Decline

**Files:**
- Modify: `index.tsx` (mount-effect merge; `requestsToApprove`; both notification dropdowns 606-647 & 698-731; handlers)
- Modify: `components/MeetingList.tsx` (tentative card styling)
- Modify: `components/MeetingDetailsModal.tsx` (Accept/Decline for tentative-on-behalf)

**Interfaces:**
- Consumes: `fetchMyTentatives`, `confirmMeeting`, `declineMeeting` (Task 11); `Meeting.onBehalf`, `status` (Task 1).

- [ ] **Step 1: Merge server tentatives into App state on load.** In `index.tsx`, after the mount-effect's `setMeetings(storageService.getMeetings())` (line 131), kick off a server fetch that merges tentatives the current user is involved in:
```typescript
    import('./services/delegationApi').then(({ fetchMyTentatives }) =>
      fetchMyTentatives().then((server) => {
        if (!Array.isArray(server) || server.length === 0) return;
        setMeetings(prev => {
          const ids = new Set(prev.map(m => m.id));
          const merged = server.filter(m => (m as any).onBehalf && !ids.has(m.id));
          return merged.length ? [...prev, ...merged] : prev;
        });
      }).catch(() => { /* offline / not logged into server — in-app still works */ })
    );
```

- [ ] **Step 2: Make Accept/Decline work for both local and server meetings.** Update `handleApprove`/`handleReject` (lines 448-458) so that when the meeting is an on-behalf (server) tentative they also call the server, then update local state:
```typescript
  const handleApprove = (id: string) => {
    const m = meetings.find(x => x.id === id);
    setMeetings(prev => updateMeetingStatus(prev, id, 'approved'));
    if (m?.onBehalf) import('./services/delegationApi').then(({ confirmMeeting }) => confirmMeeting(id)).catch(() => {});
    if (currentUser) storageService.addLog({ action: 'APPROVE', details: `Approved ID ${id}`, performedBy: currentUser.name, role: currentUser.role });
    addToast('success', t('confirmed'));
  };

  const handleReject = (id: string) => {
    const m = meetings.find(x => x.id === id);
    setMeetings(prev => updateMeetingStatus(prev, id, 'rejected'));
    if (m?.onBehalf) import('./services/delegationApi').then(({ declineMeeting }) => declineMeeting(id)).catch(() => {});
    if (currentUser) storageService.addLog({ action: 'REJECT', details: `Rejected ID ${id}`, performedBy: currentUser.name, role: currentUser.role });
    addToast('error', t('decline'));
  };
```

- [ ] **Step 3: Widen `requestsToApprove`** (lines 251-254) so a delegate/creator also sees tentatives they scheduled (not just host):
```typescript
  const requestsToApprove = useMemo(() => {
    if (!currentUser || currentUser.role === 'guest') return [];
    return meetings.filter(m =>
      m.status === 'pending' &&
      (m.hostId === currentUser.id || (m.onBehalf && m.userId === currentUser.id))
    );
  }, [meetings, currentUser]);
```
(The existing Approve/Reject buttons in both dropdowns already call `handleApprove`/`handleReject`, so no dropdown markup change is required beyond this — but apply any label change to BOTH the desktop block (606-647) and the mobile block (698-731).)

- [ ] **Step 4: Tentative card styling in `MeetingList`.** In the card `<div>` (line 86-93 area), add a dashed/reduced-opacity treatment when tentative. Compute near the accent (Task 3 Step 2):
```typescript
            const isTentative = meeting.status === 'pending' && meeting.onBehalf;
```
Append to the card `className` template a conditional and add a "Tentative" badge next to the pending badge (after the existing `meeting.status === 'pending'` badge block):
```typescript
                         {isTentative && (
                             <span className="inline-flex items-center px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest bg-gray-200 text-gray-600 border border-dashed border-gray-400">
                                {t('tentative')}
                             </span>
                         )}
```
And add `${isTentative ? 'opacity-80 border-dashed' : ''}` into the card's `className` string.

- [ ] **Step 5: Accept/Decline in `MeetingDetailsModal`.** Add props `onApprove?`, `onReject?` to `MeetingDetailsModalProps`, and render Accept/Decline buttons in the footer (next to Close) when `meeting.status === 'pending'` and the current user may act:
```typescript
             {meeting.status === 'pending' && currentUser && (meeting.hostId === currentUser.id || (meeting.onBehalf && meeting.userId === currentUser.id) || currentUser.role === 'admin') && (
                <>
                  <Button variant="success" onClick={() => { onApprove?.(meeting.id); onClose(); }}>{t('accept')}</Button>
                  <Button variant="secondary" onClick={() => { onReject?.(meeting.id); onClose(); }}>{t('decline')}</Button>
                </>
             )}
```
Show the on-behalf line in the Internal Info block: `{meeting.onBehalf && <p className="text-xs text-gray-500">{t('scheduledOnBehalf').replace('{by}', meeting.bookedBy).replace('{for}', meeting.hostId)}</p>}`. Thread `onApprove={handleApprove} onReject={handleReject}` from `MeetingList` (which already renders `MeetingDetailsModal`) and from any other render site.

- [ ] **Step 6: Typecheck + manual verification.** Run `yarn typecheck`. As the boss in a second session/browser, confirm the tentative appears (dashed + "Tentative"), Accept flips it to confirmed and (server) triggers calendar sync; Decline rejects it.

- [ ] **Step 7: Commit.**
```bash
git add index.tsx components/MeetingList.tsx components/MeetingDetailsModal.tsx
git commit -m "feat(tentative): merge server tentatives, tentative styling, Accept/Decline for boss+delegate"
```

---

### Task 16: Invitee confirmation page (token)

**Files:**
- Create: `components/ConfirmInvitePage.tsx`
- Modify: `index.tsx` (top-level router lines 1025-1158 — add a `confirm-invite` route)

**Interfaces:**
- Consumes: `confirmByToken` (Task 11).

- [ ] **Step 1: Create `components/ConfirmInvitePage.tsx`:**
```typescript
import React, { useState } from 'react';
import { confirmByToken } from '../services/delegationApi';

export const ConfirmInvitePage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id') || '';
  const token = params.get('token') || '';
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const onConfirm = async () => {
    try { const r = await confirmByToken(id, token); setMsg(r.message); setState('done'); }
    catch (e: any) { setMsg(e?.body?.error || e?.message || 'Failed'); setState('error'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-serif font-bold text-charcoal mb-4">Confirm your meeting</h1>
        {state === 'done' ? (
          <p className="text-palm font-medium">Your meeting is confirmed.</p>
        ) : state === 'error' ? (
          <p className="text-salmon">{msg}</p>
        ) : (
          <button onClick={onConfirm} disabled={!id || !token}
            className="px-6 py-3 bg-al-adaam text-white font-bold rounded-lg disabled:opacity-50">
            Confirm
          </button>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Route to it.** In `index.tsx`'s top-level Router (the pathname/search switch around lines 1025-1158, which already handles `accept-invite`, `manage-booking`, etc.), add a branch: if `window.location.pathname` is `/confirm-invite` (or the search has `confirm=1`), render `<ConfirmInvitePage />`. Follow the existing branch style exactly (match how `accept-invite` is detected) and import the component at the top.

- [ ] **Step 3: Typecheck + manual verification.** Visit `/confirm-invite?id=<id>&token=<token>` for a real tentative; confirm it flips to approved server-side and shows the success state.

- [ ] **Step 4: Commit.**
```bash
git add components/ConfirmInvitePage.tsx index.tsx
git commit -m "feat(tentative): invitee confirmation page via attendee token"
```

---

### Task 17: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite.** Run: `yarn vitest run` — Expected: the new tests (`localityService`, `delegationAuth`, `schedulerService.locality`, `MeetingList.locality`) PASS. Pre-existing stale tests (`tests/schedulerService.test.ts`) may still fail as they did before this work — confirm they were already failing on `main` (do NOT claim to have fixed them; optionally note them).

- [ ] **Step 2: Typecheck.** Run: `yarn typecheck` — Expected: no errors introduced by this work.

- [ ] **Step 3: Manual smoke test (both features).** Using `yarn dev` + `yarn server:dev`:
  - Internal meeting renders RED, external renders BLACK, in list + details + month dots + booking-view chips + dashboard hero/dots; dark mode keeps black legible.
  - As a registered delegate, book on behalf of a boss → tentative (dashed) appears for both delegate and boss; boss Accept → confirmed + calendar sync fires; invitee token link confirms; reschedule before accept stays tentative; non-delegate on-behalf attempt is refused.

- [ ] **Step 4: Final commit (if any docs/cleanup).**
```bash
git add -A
git commit -m "chore: verification pass for locality + tentative on-behalf features"
```

---

## Notes & known discrepancies (for the implementer)

- **`ApprovalQueue.tsx` calls `POST /api/meetings/:id/approve|reject`**, but the meetings router only defines `PATCH /:id/status`. This plan uses the confirmed `PATCH /:id/status` for all confirm/decline. If `/approve`/`/reject` routes exist elsewhere, leave them; do not depend on them.
- **Two translation-consumption patterns** exist (`t('key')` in `index.tsx`; `translations[language]` object access elsewhere; `ApprovalQueue` inlines its own `labels`). Match the pattern of whichever file you edit.
- **`appName` is "Cadence"** in translations though `constants.ts` `APP_NAME` is "Regent" and `index.css` is branded "Regent" — irrelevant to this work; do not "fix".
- **Backend has no test harness** — server logic is covered only via the extracted pure helpers (`isDelegationAllowed`) and runtime/manual verification. Standing up an in-memory SQLite vitest harness is out of scope unless requested.
- **`onBehalf` server fetch on mount is best-effort** — if the user is not authenticated to the server (in-app localStorage-only usage), the merge silently no-ops and the app keeps working.
- **`PublicBookingPage.tsx` / `ManageBookingPage.tsx` need no `locality` change** — they are guest-facing booking/management forms that do not render the host's red/black calendar accent. Public bookings still get a correct `locality` because the server serializer derives it on read (Task 2 Step 5). Only add `locality` to a component's local interface if that component actually renders the accent (done for `BookingCalendarView` in Task 7).
- **Step renumbering:** Task 8 inserts a pure-rule module, so its steps run 1→8 (Step 4 = create `delegationRules.ts`, Step 5 = test passes, Step 6 = create the route). Follow the numbers as written.
