# Phase 0 — Remove Sounds + Gamification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Cleanly remove the sound-effects subsystem AND all gamification (achievements, XP/levels, streaks, team-competition leaderboard, weekly challenges) from the app — frontend, server, and DB — without breaking core flows (booking, auth, webhooks, notifications).

**Architecture:** Pure deletion/edit. Remove in dependency order so the project keeps compiling: frontend usages → frontend component/service deletes → server call sites → unregister+delete server routes → delete server service → DB cleanup. Preserve interleaved core logic (`dispatchWebhook`, `addToast`/`announce`, navigation state, `smartDefaults.trackAction`, `useReducedMotion`).

**Tech Stack:** React 19 + Vite + TypeScript (`index.tsx`, `components/`, `services/`); Express + better-sqlite3 (`server/`); Vitest.

## Global Constraints

- **Package manager: `yarn`** — never npm/pnpm/npx. Verify with `yarn typecheck` and `yarn vitest run`.
- **No NEW tests** (this is removal). The EXISTING suites must still pass: `tests/localityService.test.ts`, `tests/delegationAuth.test.ts`, `tests/schedulerService.locality.test.ts`, `tests/components/MeetingList.locality.test.tsx`, `tests/components/HelpModal.test.tsx`, `tests/tourService.welcome.test.ts`, `tests/components/LoginPage.quicklogin.test.tsx`. (None reference gamification/audio — verified in the scope map.) Pre-existing failing/stale suites unrelated to this work: `tests/schedulerService.test.ts`, `tests/authService.test.ts`, `tests/components/Button.test.tsx` — ignore.
- **Pre-existing `yarn typecheck` errors are unrelated** (EmptyState3D, QuickBookModal, ThemeToggle, the stale tests, vitest.config). Judge by NEW errors only. After full removal there must be NO new "cannot find module"/unused-symbol errors from dangling gamification/audio references.
- **PRESERVE (do NOT delete) when stripping call sites:** `dispatchWebhook(...)` (core webhooks), `addToast(...)` + `announce(...)` (toasts + ARIA), navigation/state in the same arrow body (`setCurrentView`/`setSelectedHost`/`setIsQuickBookOpen`/`setShowNotifications`), `services/smartDefaults.ts` `trackAction` (host-preference ML, NOT gamification), and `useReducedMotion` (accessibility, sits next to the sound toggle).
- **DB:** schema uses idempotent `runOnce(name, sql)`. SQLite can't easily DROP COLUMN — drop the whole `user_stats` table. Add a NEW `runOnce` DROP migration for existing DBs AND remove the CREATE statements so fresh DBs don't recreate them.

---

## File Structure (touch list, from the scope map)

**Delete (frontend):** `components/AchievementGallery.tsx`, `components/AchievementPopup.tsx`, `components/XpLevelBadge.tsx`, `components/ChallengesCard.tsx`, `components/TeamCompetitionLeaderboard.tsx`, `services/achievementService.ts`, `services/gamificationService.ts`, `services/audioService.ts`.
**Delete (server):** `server/routes/gamification.ts`, `server/routes/leaderboard.ts`, `server/routes/challenges.ts`, `server/services/userStatsSync.ts`.
**Edit (frontend):** `index.tsx`, `components/Dashboard.tsx`, `components/ProfileSettingsModal.tsx`, `components/OnboardingFlow.tsx`, `services/tourService.ts`, `services/storageService.ts`, `types.ts`, `tests/setup.ts`, `services/translations.ts`.
**Edit (server):** `server/index.ts`, `server/routes/auth.ts`, `server/routes/meetings.ts`, `server/routes/bookingLinks.ts`, `server/routes/teamBookingLinks.ts`, `server/routes/dataExport.ts`, `server/routes/admin.ts`, `server/database.ts`.

---

### Task 1: Remove gamification — FRONTEND

**Files:** Edit `index.tsx`, `components/Dashboard.tsx`, `services/tourService.ts`, `services/storageService.ts`, `types.ts`; Delete `components/AchievementGallery.tsx`, `components/AchievementPopup.tsx`, `components/XpLevelBadge.tsx`, `components/ChallengesCard.tsx`, `components/TeamCompetitionLeaderboard.tsx`, `services/achievementService.ts`, `services/gamificationService.ts`.

**Interfaces:** Produces a frontend with zero gamification references. (`AchievementPopup.tsx` is deleted here even though it also has an audio call — Task 3 then has one less audio site.)

- [ ] **Step 1: Edit `index.tsx` — remove all gamification usages.** Delete these (exact sites from the map; if line numbers drifted, locate by content):
  - imports: `AchievementPopup` (~:23), `XpLevelBadge` (~:42), `ChallengesCard` (~:43), `TeamCompetitionLeaderboard` (~:46), `achievementService` (~:57); and remove `Achievement` from the `./types` named import (~:34).
  - `'team-competition'` from the `currentView` union type (~:72).
  - state `const [newAchievements, setNewAchievements] = useState<Achievement[]>([])` (~:110).
  - the `checkAchievements()` helper fn (~:237-243).
  - login block `setTimeout(() => achievementService.trackAction(user.id,'login') ...)` in `handleLogin` (~:296-301).
  - `checkAchievements('booking')` (~:496) and `checkAchievements('visit_team')` (~:561) calls (delete the call lines only; keep surrounding handler logic).
  - command-palette entry `{ id:'team-competition', ... category:'Gamification' }` (~:584).
  - render `<AchievementPopup achievements={newAchievements} ... />` (~:608-609).
  - `<XpLevelBadge lang={lang} />` in the header (~:722).
  - the `ChallengesCard` dashboard wrapper block (~:826-830).
  - the `currentView === 'team-competition'` render branch (~:872-875).

- [ ] **Step 2: Edit `components/Dashboard.tsx` — remove gamification.** Delete: import of `AchievementGallery` + `{ gamificationService, Achievement }` (~:6-7); `showAchievements`/`achievements`/`userAchievements` state (~:28-30); the `useEffect` using `gamificationService.getAchievements/getUserAchievements/subscribe` (~:45-52); the "Achievements" trigger button (`data-tour="achievements"`, "{userAchievements.length} Unlocked") (~:266-278); and `{showAchievements && <AchievementGallery .../>}` (~:444-452). Keep everything else (greeting, next-meeting, stat cards, pull-to-refresh, EmptyState3D).

- [ ] **Step 3: Edit `services/tourService.ts` — remove the achievements step.** Delete the `welcome` tour step object with `id: 'achievements'` / `target: '[data-tour="achievements"]'` ("Achievements & Gamification", ~:208-219). (Leave all other steps; the welcome-tour test only checks for the steps added in the prior plan, not this one — but run it to confirm.)

- [ ] **Step 4: Edit `services/storageService.ts` — remove the stats store.** Delete `KEYS.STATS: 'adaam_stats_v1'` (~:11), `DEFAULT_STATS` (~:16-31), the STATS init line(s) (~:70-71), and `getUserStats`/`saveUserStats` (~:131-140). Remove `UserStats` from the `../types` import if now unused. Keep everything else (meetings/users/teams/logs).

- [ ] **Step 5: Edit `types.ts` — remove gamification types.** Delete `AchievementCategory` (~:114), `Achievement` (~:116-126), `MeetingPartnerStats` (~:128-132), and `UserStats` (~:134-149). (The scope map confirmed no non-gamification consumers.)

- [ ] **Step 6: Delete the 7 frontend files.**
```bash
git rm components/AchievementGallery.tsx components/AchievementPopup.tsx components/XpLevelBadge.tsx components/ChallengesCard.tsx components/TeamCompetitionLeaderboard.tsx services/achievementService.ts services/gamificationService.ts
```

- [ ] **Step 7: Verify frontend compiles + tests pass.** Run `yarn typecheck` and confirm NO new errors that reference gamification symbols (Achievement, XpLevelBadge, gamificationService, achievementService, team-competition, etc.) — any such error means a dangling reference to fix. Then `yarn vitest run tests/tourService.welcome.test.ts tests/components/HelpModal.test.tsx tests/components/MeetingList.locality.test.tsx` → expect PASS. Also `grep -rnE "achievementService|gamificationService|XpLevelBadge|ChallengesCard|TeamCompetition|AchievementGallery|AchievementPopup|checkAchievements|newAchievements|team-competition" index.tsx components/ services/ | grep -v node_modules` → expect ZERO matches.

- [ ] **Step 8: Commit.**
```bash
git add -A
git commit -m "chore(gamification): remove frontend gamification (achievements, XP, challenges, leaderboard)"
```

---

### Task 2: Remove gamification — SERVER + DB

**Files:** Edit `server/routes/auth.ts`, `server/routes/meetings.ts`, `server/routes/bookingLinks.ts`, `server/routes/teamBookingLinks.ts`, `server/routes/dataExport.ts`, `server/routes/admin.ts`, `server/index.ts`, `server/database.ts`; Delete `server/routes/gamification.ts`, `server/routes/leaderboard.ts`, `server/routes/challenges.ts`, `server/services/userStatsSync.ts`.

**Interfaces:** Consumes Task 1's frontend (already gamification-free). Produces a server with no gamification routes/services and no `user_stats`/`challenges`/`user_challenge_progress` tables.

- [ ] **Step 1: Remove server CALL SITES first (so `tsc` stays green before deleting files).**
  - `server/routes/auth.ts`: delete the import of `awardXp` + `trackChallengeProgress` (~:11-12) and the calls `awardXp(user.id,2,'login')` + `trackChallengeProgress(user.id,'logins',1)` (~:66-67). **Also delete the `INSERT INTO user_stats(...) ON CONFLICT ... login_streak+1` block (~:53-57)** — it's not in a try/catch and will 500 once the table is dropped; `login_streak`/`last_login` have no remaining consumer.
  - `server/routes/meetings.ts`: delete the imports `{ awardXp, incrementBookingStat }` + `{ trackChallengeProgress }` (~:11,13); delete `awardXp(hostId,10)` + `incrementBookingStat(hostId)` (~:483-484) and `trackChallengeProgress(hostId,'bookings_received',1)` (~:493) — **KEEP the `dispatchWebhook(...)` at ~:486-492**; delete ONLY `awardXp(meeting.host_id,5,'approved_booking')` (~:606) — **KEEP the surrounding `dispatchWebhook` if/else for approved/rejected/cancelled**.
  - `server/routes/bookingLinks.ts`: delete imports `{ awardXp, incrementBookingStat }` + `{ trackChallengeProgress }` (~:11,13); delete the gamification lines (~:1085-1086, 1093) — **KEEP `dispatchWebhook` at ~:1087-1092**.
  - `server/routes/teamBookingLinks.ts`: delete imports (~:15,17); delete gamification lines (~:484-485, 492) — **KEEP `dispatchWebhook` at ~:486-491**.
  - `server/routes/dataExport.ts`: delete the `SELECT * FROM user_stats` read + `JSON.parse(unlocked_achievements)` (~:48-53) and drop the `stats`/`achievements` keys from the `res.json(...)` export payload.
  - `server/routes/admin.ts`: remove `'challenges'` and `'user_challenge_progress'` from the health-count tables array (~:36).

- [ ] **Step 2: Unregister + delete the 3 route files + the service.**
  - `server/index.ts`: delete the imports of `leaderboardRoutes`/`gamificationRoutes`/`challengeRoutes` (~:20-21,32) and the `app.use('/api/leaderboard', ...)` / `app.use('/api/gamification', ...)` / `app.use('/api/challenges', ...)` lines (~:146-147,158).
  - Then delete the files (challenges.ts exports `trackChallengeProgress`, now unimported; userStatsSync.ts now has zero importers):
```bash
git rm server/routes/gamification.ts server/routes/leaderboard.ts server/routes/challenges.ts server/services/userStatsSync.ts
```

- [ ] **Step 3: DB cleanup in `server/database.ts`.**
  - Remove the CREATE/migration statements: `challenges` (~:406-418), `user_challenge_progress` (~:422-431), `user_stats` (~:940-952), and the `20240142_user_stats_xp` (~:470-472) + `20240143_user_stats_level` (~:475-476) ALTER migrations.
  - Add a NEW `runOnce` drop migration (so existing dev DBs are cleaned) near the end of the migrations block:
```typescript
    runOnce(
      '20240600_drop_gamification_tables',
      `DROP TABLE IF EXISTS user_challenge_progress; DROP TABLE IF EXISTS challenges; DROP TABLE IF EXISTS user_stats;`
    );
```
  (`runOnce` uses `db.exec`, which runs multiple statements — confirm by reading the helper; if it only runs one statement, split into three `runOnce` calls.)

- [ ] **Step 4: Verify the server compiles + boots + core flows work.**
  - `yarn typecheck` → no new errors; `grep -rnE "awardXp|incrementBookingStat|trackChallengeProgress|userStatsSync|user_stats|leaderboardRoutes|gamificationRoutes|challengeRoutes|/api/(gamification|leaderboard|challenges)" server/ | grep -v node_modules` → expect ZERO matches.
  - Boot smoke: `yarn server` in the background; confirm "Cadence server running on port 3001" with no migration errors; then `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"password"}'` → **200** (login still works after dropping user_stats), and a `POST /api/meetings` (with a valid token) still 201s. Stop the server after.

- [ ] **Step 5: Commit.**
```bash
git add -A
git commit -m "chore(gamification): remove server routes/service + DB tables (XP, challenges, leaderboard, user_stats)"
```

---

### Task 3: Remove sounds (audio)

**Files:** Delete `services/audioService.ts`; Edit `index.tsx`, `components/ProfileSettingsModal.tsx`, `components/OnboardingFlow.tsx`, `tests/setup.ts`, `services/translations.ts`.

**Interfaces:** Consumes Task 1 (AchievementPopup already deleted, so its `audioService.play('success')` is gone).

- [ ] **Step 1: Edit `index.tsx` — strip all `audioService` usage, preserving surrounding logic.**
  - Delete the import (~:56).
  - In the 5 keyboard-shortcut registrations (~:164-168), delete ONLY the trailing `audioService.play(...)` statement in each, keeping the `setCurrentView`/`setSelectedHost`/`setIsQuickBookOpen` logic.
  - In `addToast` (~:227-229), delete the three `if (type === ...) audioService.play(...)` lines — **KEEP the `announce(...)` ARIA-live call and the toast logic**.
  - Delete standalone `audioService.play('click')` lines at ~:325 (handleSelectHost), ~:372 (handleSelectDate), ~:377 (handleSelectSlot), ~:382 (handleContinueBooking), ~:555 (toggleLang), ~:570 (handleMobileNavigate).
  - In `handleCompleteOnboarding` (~:342): delete `if (data.soundEnabled !== audioService.enabled) audioService.toggle();` (and stop reading `data.soundEnabled`).
  - In JSX props at ~:648, ~:682, ~:814, ~:816: remove only the chained `audioService.play(...)` call, leaving a clean single-statement arrow (`setCurrentView(nav.id)` etc.).
  - At ~:822 (Dashboard `onRefresh`): delete `audioService.play('notification')`, keep the `addToast('info', ...)`.
  After editing, `grep -n audioService index.tsx` → ZERO matches.

- [ ] **Step 2: Edit `components/ProfileSettingsModal.tsx` — remove the Sound Effects toggle.** Delete: the `audioService` import (~:5); `const [soundEnabled, setSoundEnabled] = useState(audioService.enabled)` (~:70); the `setSoundEnabled(audioService.enabled)` re-sync (~:91); the `if (soundEnabled !== audioService.enabled) audioService.toggle()` in the save handler (~:118-119); and the entire "Sound Effects" toggle UI block (~:641-650). **KEEP the "Reduced Motion" control next to it.**

- [ ] **Step 3: Edit `components/OnboardingFlow.tsx` — remove the sound toggle.** Delete `soundEnabled: true` from the `formData` default (~:83) and the entire "Enable Sound Effects" toggle UI block (~:281-287). Keep the rest of step 3.

- [ ] **Step 4: Edit `tests/setup.ts` — remove the now-unused Audio mock.** Delete the `AudioMock` class + the `Object.defineProperty(window,'Audio',{...})` block (~:36-47). (Nothing else uses `window.Audio` now.)

- [ ] **Step 5: Edit `services/translations.ts` — remove orphaned sound keys.** Delete the dead keys `soundEffects`, `soundEffectsDesc`, `ambientSound`, `enableSoundEffects` from BOTH the `en` (~:201-202,236,251) and `ar` (~:558-559,593,608) blocks. (They are referenced nowhere via `t()`.)

- [ ] **Step 6: Delete the service.**
```bash
git rm services/audioService.ts
```

- [ ] **Step 7: Verify.** `yarn typecheck` → no new errors; `grep -rnE "audioService|soundEnabled|soundEffects|ambientSound" index.tsx components/ services/ tests/ | grep -v node_modules` → expect ZERO matches (besides nothing). Run `yarn vitest run tests/components/LoginPage.quicklogin.test.tsx tests/components/HelpModal.test.tsx tests/components/MeetingList.locality.test.tsx` → PASS.

- [ ] **Step 8: Commit.**
```bash
git add -A
git commit -m "chore(audio): remove sound-effects subsystem and its settings toggles"
```

---

### Task 4: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full kept test suite.** `yarn vitest run` — the 7 kept suites listed in Global Constraints PASS (15 + 10 + others); the 3 pre-existing stale suites (`schedulerService.test.ts`, `authService.test.ts`, `Button.test.tsx`) fail as they did before this work (confirm via `git stash`-free reasoning — they were failing on the base branch and were untouched here).

- [ ] **Step 2: Typecheck.** `yarn typecheck` — no errors introduced by this work (only the documented pre-existing set). CRUCIAL: zero "cannot find name/module" errors referencing any removed symbol.

- [ ] **Step 3: Dead-reference sweep.** `grep -rnE "achievement|gamif|XpLevel|Challenge|leaderboard|team-competition|awardXp|incrementBookingStat|trackChallengeProgress|user_stats|audioService|soundEnabled|soundEffects" index.tsx components/ services/ server/ types.ts tests/ | grep -viE "node_modules|smartDefaults|trackAction\\(|reduced.?motion" ` — review every remaining hit; the only acceptable ones are unrelated (e.g. a meeting "attendee" substring). No live gamification/audio code should remain.

- [ ] **Step 4: Runtime smoke.** Start backend + frontend (`yarn server`; `yarn dev --port 5173`), confirm the backend boots without migration errors, login works (200), the header no longer shows the XP badge, the dashboard has no Achievements button, settings has no Sound Effects toggle, and a booking still completes. Stop the servers.

- [ ] **Step 5: Final commit (if any cleanup).**
```bash
git add -A && git commit -m "chore: verification pass for sounds + gamification removal" || echo "nothing to commit"
```

---

## Notes for the implementer
- Removal ORDER matters for compilation: Task 1 (frontend, compiles standalone) → Task 2 Step 1 (server call sites) BEFORE Task 2 Step 2 (delete route/service files), because `trackChallengeProgress` is re-exported from `challenges.ts` and imported by 4 routes; `userStatsSync.ts` is imported by 6 files. Delete files only after their importers are clean.
- The single non-`try/catch` coupling is `auth.ts` login's `user_stats` INSERT — remove it together with the table drop or login 500s.
- Do not touch `services/smartDefaults.ts` (`trackAction` is host-preference ML, not gamification) or `useReducedMotion` (accessibility).
- This is a deletion-only change; expect the diff to be overwhelmingly red. The win condition is: app compiles, kept tests pass, server boots + login + booking work, and zero dead references remain.
