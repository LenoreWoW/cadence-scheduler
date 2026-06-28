# Guided Tour + How-It-Works Help + Per-Role Quick Login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app demo-/test-ready: a complete working guided tour (covering the new locality/tentative features), a "How it works" help modal opened from a header `?` button, and one-click per-role quick login.

**Architecture:** Reuse the existing `tourService` engine + `TourOverlay`. Add a new `HelpModal` component opened from a header button; extend the `welcome` tour with new steps + fix missing `data-tour` anchors; upgrade the login page's demo block into visible one-click role buttons. No backend changes.

**Tech Stack:** React 19 + Vite + TypeScript, Tailwind (`darkMode:'class'`, purge on), bilingual en/ar via `services/translations.ts` + `t(key)`, Vitest + @testing-library/react + jsdom.

## Global Constraints

- **Package manager: `yarn`** — never npm/pnpm/npx. Tests: `yarn vitest run <path>`; typecheck: `yarn typecheck`.
- **Bilingual:** every new user-facing string ships in BOTH `en` and `ar` in `services/translations.ts`; components are `dir`/RTL-aware via `lang`.
- **Tour copy** lives in `services/tourService.ts` step objects (`title`/`titleAr`/`content`/`contentAr`), NOT in translations. Normalize the app name to **"Cadence"** (matches `translations.appName`) — remove stray "Regent" from tour copy.
- **Seeded demo accounts** (server + localStorage share IDs), all password `password`: `admin` (admin), `manager`=Abdul Rahman (manager), `sub`=Fatima (subordinate), `user1`=Ahmed (guest).
- **Pre-existing `yarn typecheck` errors** are unrelated and must be ignored: EmptyState3D, QuickBookModal, ThemeToggle, schedulerService, tests/* (incl. stale `schedulerService.test.ts`/`authService.test.ts`), vitest.config version. Judge by NEW errors only.
- Dynamic colors via inline `style` (Tailwind purges dynamic classes). Tests live under `tests/`, named `*.test.ts(x)`.

---

## File Structure

**New**
- `components/HelpModal.tsx` — the "How it works" modal + tour-launch buttons. One responsibility: explain the app + start tours.
- `tests/tourService.welcome.test.ts`, `tests/components/HelpModal.test.tsx`, `tests/components/LoginPage.quicklogin.test.tsx`.

**Modified**
- `services/translations.ts` — Help-modal + quick-login copy (en + ar).
- `components/HelpModal.tsx` consumers + `index.tsx` — header `?` button, `isHelpOpen` state, `<HelpModal>` mount, `data-tour` anchors (`calendar`, `time-slots`, `duration`, `host-grid`, `help`).
- `components/MeetingList.tsx` — `data-tour="meeting-card"` on the first card.
- `services/tourService.ts` — new welcome steps, `version` bump, naming.
- `components/LoginPage.tsx` — per-role one-click quick login.

---

### Task 1: Translations for Help modal + quick login (en + ar)

**Files:**
- Modify: `services/translations.ts` (the `en` object and the `ar` object)

**Interfaces:**
- Produces 24 NEW translation keys consumed by Tasks 2, 3, 6: `helpButtonLabel`, `helpTitle`, `helpIntro`, `helpRolesTitle`, `helpRolesBody`, `helpSchedulingTitle`, `helpSchedulingBody`, `helpApprovalsTitle`, `helpApprovalsBody`, `helpColorsTitle`, `helpColorsBody`, `helpTentativeTitle`, `helpTentativeBody`, `helpBookingLinksTitle`, `helpBookingLinksBody`, `helpShortcutsTitle`, `helpShortcutsBody`, `helpStartTour`, `helpStartShortcuts`, `helpStartBookingLinks`, `helpStartAdmin`, `helpClose`, `quickLoginTitle`, `quickLoginNote`.
- REUSES existing role-label keys (do NOT re-add): `roleAdmin` ("Admin"), `roleManager` ("Manager"), `roleSubordinate` ("Subordinate"), `roleGuest` ("Guest") — already in both en+ar. Task 6's quick-login buttons reference these.

- [ ] **Step 1: Add the keys to the `en` block.** Insert these into the `en: { ... }` object (anywhere among the existing keys; ensure a trailing comma on the line before if needed):

```typescript
    helpButtonLabel: "Help & guide",
    helpTitle: "How it works",
    helpIntro: "Cadence is a scheduling app. Here's the quick version:",
    helpRolesTitle: "Roles",
    helpRolesBody: "Admins manage everything; Managers host meetings and approve requests; Assistants can schedule on a manager's behalf; Clients (guests) request meetings.",
    helpSchedulingTitle: "Scheduling a meeting",
    helpSchedulingBody: "Open Scheduler, pick a host, choose a date and an available time, set the duration, then book.",
    helpApprovalsTitle: "Approvals",
    helpApprovalsBody: "Guest requests arrive as Pending. The host approves or rejects them from Notifications or My Appointments. Approved = confirmed.",
    helpColorsTitle: "Meeting colors",
    helpColorsBody: "Each meeting is colored by location: RED = internal / in-the-building, BLACK = external / different building.",
    helpTentativeTitle: "Tentative & on-behalf",
    helpTentativeBody: "A registered delegate (e.g. an assistant) can schedule a tentative meeting for a boss. When the scheduler, the boss, or the invitee accepts, it becomes confirmed and lands on the boss's calendar.",
    helpBookingLinksTitle: "Booking links",
    helpBookingLinksBody: "Share a personal link (like Calendly) so anyone can book time with you without an account.",
    helpShortcutsTitle: "Keyboard shortcuts",
    helpShortcutsBody: "Press ? for all shortcuts, or / to open the command palette.",
    helpStartTour: "Start the guided tour",
    helpStartShortcuts: "Keyboard shortcuts tour",
    helpStartBookingLinks: "Booking links tour",
    helpStartAdmin: "Admin features tour",
    helpClose: "Close",
    quickLoginTitle: "Quick login (demo)",
    quickLoginNote: "Demo accounts for testing — password: password",
```
(Do NOT add `roleAdmin`/`roleManager`/`roleSubordinate`/`roleGuest` — they already exist; Task 6 reuses them.)

- [ ] **Step 2: Add the same keys to the `ar` block** (Arabic values):

```typescript
    helpButtonLabel: "المساعدة والدليل",
    helpTitle: "كيف يعمل التطبيق",
    helpIntro: "ريجنت تطبيق للجدولة. إليك الملخص السريع:",
    helpRolesTitle: "الأدوار",
    helpRolesBody: "المدراء يديرون كل شيء؛ المدير يستضيف الاجتماعات ويوافق على الطلبات؛ المساعد يمكنه الجدولة نيابة عن المدير؛ العملاء (الضيوف) يطلبون الاجتماعات.",
    helpSchedulingTitle: "جدولة اجتماع",
    helpSchedulingBody: "افتح الجدول، اختر مضيفاً، حدد التاريخ ووقتاً متاحاً، اضبط المدة، ثم احجز.",
    helpApprovalsTitle: "الموافقات",
    helpApprovalsBody: "تصل طلبات الضيوف كـ \"معلقة\". يوافق المضيف عليها أو يرفضها من الإشعارات أو مواعيدي. الموافقة تعني التأكيد.",
    helpColorsTitle: "ألوان الاجتماعات",
    helpColorsBody: "يُلوَّن كل اجتماع حسب الموقع: الأحمر = داخلي / في المبنى، الأسود = خارجي / مبنى مختلف.",
    helpTentativeTitle: "المبدئي والنيابة",
    helpTentativeBody: "يمكن لمفوّض مسجّل (مثل مساعد) جدولة اجتماع مبدئي نيابة عن مدير. عندما يقبله المنظّم أو المدير أو المدعو، يصبح مؤكداً ويظهر على تقويم المدير.",
    helpBookingLinksTitle: "روابط الحجز",
    helpBookingLinksBody: "شارك رابطاً شخصياً (مثل Calendly) ليتمكن أي شخص من حجز موعد معك دون حساب.",
    helpShortcutsTitle: "اختصارات لوحة المفاتيح",
    helpShortcutsBody: "اضغط ؟ لجميع الاختصارات، أو / لفتح لوحة الأوامر.",
    helpStartTour: "ابدأ الجولة الإرشادية",
    helpStartShortcuts: "جولة اختصارات لوحة المفاتيح",
    helpStartBookingLinks: "جولة روابط الحجز",
    helpStartAdmin: "جولة ميزات المدير",
    helpClose: "إغلاق",
    quickLoginTitle: "دخول سريع (تجريبي)",
    quickLoginNote: "حسابات تجريبية للاختبار — كلمة المرور: password",
```
(Do NOT add the `role*` keys — they already exist in the `ar` block too.)

- [ ] **Step 3: Verify the same key set exists in both blocks + typecheck.** Run: `yarn typecheck` — Expected: no NEW errors. Manually confirm both blocks contain all 24 NEW keys and that you did NOT duplicate any pre-existing key (`roleAdmin`/`roleManager`/`roleSubordinate`/`roleGuest` must remain single-defined).

- [ ] **Step 4: Commit.**
```bash
git add services/translations.ts
git commit -m "feat(help): en+ar copy for how-it-works help modal and quick login"
```

---

### Task 2: `HelpModal` component + test

**Files:**
- Create: `components/HelpModal.tsx`
- Test: `tests/components/HelpModal.test.tsx`

**Interfaces:**
- Consumes: `t` (key→string from Task 1), `tourService` (`resetTour`, `startTour`).
- Produces: `export const HelpModal: React.FC<{ isOpen: boolean; onClose: () => void; t: (k: string) => string; lang: 'en' | 'ar'; role: string }>`.

- [ ] **Step 1: Write the failing test** `tests/components/HelpModal.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HelpModal } from '../../components/HelpModal';
import { tourService } from '../../services/tourService';

const t = (k: string) => k; // identity: assert on keys

describe('HelpModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<HelpModal isOpen={false} onClose={vi.fn()} t={t} lang="en" role="manager" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the guide sections when open', () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} t={t} lang="en" role="manager" />);
    expect(screen.getByText('helpTitle')).toBeInTheDocument();
    expect(screen.getByText('helpColorsBody')).toBeInTheDocument();
    expect(screen.getByText('helpTentativeBody')).toBeInTheDocument();
  });

  it('starting the guided tour resets+starts welcome and closes', () => {
    const reset = vi.spyOn(tourService, 'resetTour');
    const start = vi.spyOn(tourService, 'startTour');
    const onClose = vi.fn();
    render(<HelpModal isOpen={true} onClose={onClose} t={t} lang="en" role="manager" />);
    fireEvent.click(screen.getByText('helpStartTour'));
    expect(reset).toHaveBeenCalledWith('welcome');
    expect(start).toHaveBeenCalledWith('welcome');
    expect(onClose).toHaveBeenCalled();
    reset.mockRestore(); start.mockRestore();
  });

  it('hides the admin tour button for non-admins', () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} t={t} lang="en" role="manager" />);
    expect(screen.queryByText('helpStartAdmin')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it; verify it fails.** Run: `yarn vitest run tests/components/HelpModal.test.tsx` — Expected: FAIL (cannot resolve `../../components/HelpModal`).

- [ ] **Step 3: Implement `components/HelpModal.tsx`:**

```typescript
import React from 'react';
import { tourService } from '../services/tourService';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: (key: string) => string;
  lang: 'en' | 'ar';
  role: string;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, t, lang, role }) => {
  if (!isOpen) return null;
  const isRTL = lang === 'ar';

  const sections: Array<{ title: string; body: string }> = [
    { title: 'helpRolesTitle', body: 'helpRolesBody' },
    { title: 'helpSchedulingTitle', body: 'helpSchedulingBody' },
    { title: 'helpApprovalsTitle', body: 'helpApprovalsBody' },
    { title: 'helpColorsTitle', body: 'helpColorsBody' },
    { title: 'helpTentativeTitle', body: 'helpTentativeBody' },
    { title: 'helpBookingLinksTitle', body: 'helpBookingLinksBody' },
    { title: 'helpShortcutsTitle', body: 'helpShortcutsBody' },
  ];

  const launch = (tourId: string) => {
    tourService.resetTour(tourId);
    tourService.startTour(tourId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" role="dialog" aria-modal="true" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" aria-hidden="true" onClick={onClose}></div>
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-serif font-bold text-charcoal dark:text-white">{t('helpTitle')}</h2>
            <button onClick={onClose} aria-label={t('helpClose')} className="text-gray-400 hover:text-charcoal dark:hover:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="overflow-y-auto px-6 py-5 space-y-5">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('helpIntro')}</p>
            {sections.map((s) => (
              <div key={s.title}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-dune mb-1">{t(s.title)}</h3>
                <p className="text-sm text-charcoal dark:text-gray-200 leading-relaxed">{t(s.body)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4 flex flex-wrap gap-2">
            <button onClick={() => launch('welcome')} className="px-4 py-2 bg-al-adaam text-white text-sm font-bold rounded-lg hover:bg-al-adaam-dark transition-colors">
              {t('helpStartTour')}
            </button>
            <button onClick={() => launch('shortcuts')} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-charcoal dark:text-white text-sm font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              {t('helpStartShortcuts')}
            </button>
            <button onClick={() => launch('bookingLinks')} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-charcoal dark:text-white text-sm font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              {t('helpStartBookingLinks')}
            </button>
            {role === 'admin' && (
              <button onClick={() => launch('admin')} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-charcoal dark:text-white text-sm font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                {t('helpStartAdmin')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run it; verify it passes.** Run: `yarn vitest run tests/components/HelpModal.test.tsx` — Expected: PASS (4 tests).

- [ ] **Step 5: Commit.**
```bash
git add components/HelpModal.tsx tests/components/HelpModal.test.tsx
git commit -m "feat(help): HelpModal with how-it-works guide and tour launchers"
```

---

### Task 3: Wire the `?` Help button + modal into the header (`index.tsx`)

**Files:**
- Modify: `index.tsx` (import + `isHelpOpen` state with the other modal flags; header action cluster at ~662-664; mount `<HelpModal>` near `<TourOverlay />` ~1011)

**Interfaces:**
- Consumes: `HelpModal` (Task 2). Produces the `data-tour="help"` anchor (consumed by Task 5).

- [ ] **Step 1: Import HelpModal.** Add with the other component imports near the top of `index.tsx`:
```typescript
import { HelpModal } from './components/HelpModal';
```

- [ ] **Step 2: Add state.** Near the other modal flags (e.g. alongside `isProfileModalOpen`), add:
```typescript
  const [isHelpOpen, setIsHelpOpen] = useState(false);
```

- [ ] **Step 3: Add the `?` button** in the header action cluster. Insert immediately after the `ThemeToggle` line (`index.tsx:664` `<ThemeToggle data-tour="theme-toggle" />`):
```typescript
                 {/* Help / How it works */}
                 <button
                   data-tour="help"
                   onClick={() => setIsHelpOpen(true)}
                   aria-label={t('helpButtonLabel')}
                   title={t('helpButtonLabel')}
                   className="p-2 rounded-full text-gray-400 hover:text-charcoal dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                 >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 </button>
```
(The button is OUTSIDE the manager/admin-only profile block, so it shows for every role.)

- [ ] **Step 4: Mount the modal.** Next to `<TourOverlay />` (~`index.tsx:1011`), add:
```typescript
        <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} t={t} lang={lang} role={role} />
```

- [ ] **Step 5: Verify.** Run `yarn typecheck` (no new errors). Run the app (`yarn dev`) and confirm the `?` button opens the modal and the tour-launch buttons start a tour. Manual check only (no automated test for the wiring).

- [ ] **Step 6: Commit.**
```bash
git add index.tsx
git commit -m "feat(help): header ? button opens HelpModal (data-tour=help anchor)"
```

---

### Task 4: Add the missing `data-tour` anchors (scheduler view + meeting card)

**Files:**
- Modify: `index.tsx` (calendar wrapper ~922; duration container ~948; time-slots panel ~938; host-selection grid — locate)
- Modify: `components/MeetingList.tsx` (first card)

**Interfaces:**
- Produces anchors `calendar`, `time-slots`, `duration`, `host-grid`, `meeting-card` (consumed by the welcome tour in Task 5).

- [ ] **Step 1: Anchor the calendar.** In `index.tsx`, the div wrapping `<CalendarGrid>` (currently `<div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden p-2">` at ~922) → add `data-tour="calendar"`:
```typescript
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden p-2" data-tour="calendar">
```

- [ ] **Step 2: Anchor the duration selector.** The div at ~948 (`<div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200 shadow-sm">`) → add `data-tour="duration"`:
```typescript
                            <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200 shadow-sm" data-tour="duration">
```

- [ ] **Step 3: Anchor the time-slots panel.** The "Available Times" card div at ~938 (`<div className="bg-gray-50 border border-gray-200 rounded-xl p-6 min-h-[500px]">`) → add `data-tour="time-slots"`:
```typescript
                       <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 min-h-[500px]" data-tour="time-slots">
```

- [ ] **Step 4: Anchor the host-selection grid.** Locate the host-picker grid in `index.tsx` — it renders the available hosts when no host is selected (search for `availableHosts.map`). Add `data-tour="host-grid"` to the grid container element that wraps the mapped host cards. (It is the `<div className="grid ...">` immediately around `availableHosts.map(...)`.) If there are multiple host grids, anchor the primary scheduler one.

- [ ] **Step 5: Anchor the first meeting card.** In `components/MeetingList.tsx`, the card `<div>` inside `sortedMeetings.map(meeting => { ... return (<div key={meeting.id} ...>` — give the map an index and add `data-tour` to the first card only. Change the map signature to `sortedMeetings.map((meeting, idx) => {` and add to the card div's attributes:
```typescript
                data-tour={idx === 0 ? 'meeting-card' : undefined}
```

- [ ] **Step 6: Verify.** Run `yarn typecheck` (no new errors). Optionally run the app and confirm the elements exist (`document.querySelector('[data-tour="calendar"]')` etc.). No automated test.

- [ ] **Step 7: Commit.**
```bash
git add index.tsx components/MeetingList.tsx
git commit -m "feat(tour): add missing data-tour anchors (calendar, time-slots, duration, host-grid, meeting-card)"
```

---

### Task 5: Extend the `welcome` tour + normalize naming + test

**Files:**
- Modify: `services/tourService.ts` (the `welcome` tour `steps` array + `version`; any "Regent" in copy)
- Test: `tests/tourService.welcome.test.ts`

**Interfaces:**
- Consumes the anchors from Tasks 3-4 (`help`, `meeting-card`, `calendar`, etc.).

- [ ] **Step 1: Write the failing test** `tests/tourService.welcome.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { tours } from '../services/tourService';

describe('welcome tour', () => {
  const welcome = tours.welcome;

  it('was bumped to version 4+', () => {
    expect(welcome.version).toBeGreaterThanOrEqual(4);
  });

  it('includes the new feature steps', () => {
    const ids = welcome.steps.map(s => s.id);
    expect(ids).toContain('meeting-colors');
    expect(ids).toContain('on-behalf');
    expect(ids).toContain('delegates');
    expect(ids).toContain('help-button');
  });

  it('every step has a non-empty target and bilingual copy', () => {
    for (const s of welcome.steps) {
      expect(s.target.length).toBeGreaterThan(0);
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.titleAr.length).toBeGreaterThan(0);
      expect(s.content.length).toBeGreaterThan(0);
      expect(s.contentAr.length).toBeGreaterThan(0);
    }
  });

  it('no tour copy uses the old name (Latin "Regent" or Arabic "ريجنت")', () => {
    const blob = JSON.stringify(welcome);
    expect(blob).not.toContain('Regent');
    expect(blob).not.toContain('ريجنت');
  });
});
```

- [ ] **Step 2: Run it; verify it fails.** Run: `yarn vitest run tests/tourService.welcome.test.ts` — Expected: FAIL (version is 3; new ids absent; the Arabic "ريجنت" present in `descriptionAr` and at least one step's `contentAr`).

- [ ] **Step 3: Bump the version.** In `services/tourService.ts`, the `welcome` tour `version: 3` → `version: 4`.

- [ ] **Step 4: Normalize naming.** In the `welcome` tour, replace the Arabic "ريجنت" (transliteration of "Regent") with "Cadence" so copy is consistent with `appName`. Specifically `descriptionAr: 'تعلم أساسيات ريجنت'` → `descriptionAr: 'تعلم أساسيات Cadence'`, and any other "ريجنت"/"Regent" occurrences in the welcome steps' `contentAr`/`content` → "Cadence". (Search the welcome block for `ريجنت` and `Regent`.)

- [ ] **Step 5: Add the new steps.** Insert these four `TourStep` objects into the `welcome.steps` array, placed BEFORE the final `tour-complete` step (after `share-link`/`profile`/`booking-links` steps is fine):

```typescript
      {
        id: 'meeting-colors',
        target: '[data-tour="meeting-card"]',
        title: 'Meeting Colors',
        titleAr: 'ألوان الاجتماعات',
        content: 'Meetings are colored by location: RED for internal (in-the-building) and BLACK for external (a different building).',
        contentAr: 'تُلوَّن الاجتماعات حسب الموقع: الأحمر للداخلي (في المبنى) والأسود للخارجي (مبنى مختلف).',
        position: 'right',
        action: 'none',
        requiredView: 'my-meetings'
      },
      {
        id: 'on-behalf',
        target: '[data-tour="notifications"]',
        title: 'Tentative & On-Behalf',
        titleAr: 'المبدئي والنيابة',
        content: 'An assistant can schedule a tentative meeting for a boss. Pending items appear here — Accept or Decline, and confirmed meetings land on the boss\'s calendar.',
        contentAr: 'يمكن لمساعد جدولة اجتماع مبدئي لمدير. تظهر العناصر المعلقة هنا — اقبل أو ارفض، وتظهر الاجتماعات المؤكدة على تقويم المدير.',
        position: 'bottom',
        action: 'none'
      },
      {
        id: 'delegates',
        target: '[data-tour="profile"]',
        title: 'Delegates',
        titleAr: 'المفوضون',
        content: 'In your profile settings, the Delegates tab controls who may schedule meetings on your behalf.',
        contentAr: 'في إعدادات ملفك الشخصي، يتحكم تبويب المفوضين في من يمكنه جدولة الاجتماعات نيابة عنك.',
        position: 'bottom',
        action: 'none'
      },
      {
        id: 'help-button',
        target: '[data-tour="help"]',
        title: 'Help Anytime',
        titleAr: 'المساعدة في أي وقت',
        content: 'Reopen this guide or restart any tour from the ? button up here.',
        contentAr: 'أعد فتح هذا الدليل أو أعد تشغيل أي جولة من زر ؟ هنا في الأعلى.',
        position: 'bottom',
        action: 'none'
      },
```

(Note: `delegates`/`profile` is only rendered for manager/admin per `index.tsx:712`; the step still shows its tooltip and is harmless for other roles since `action:'none'`. The `meeting-colors` step uses `requiredView:'my-meetings'` so the meeting card exists.)

- [ ] **Step 6: Run it; verify it passes.** Run: `yarn vitest run tests/tourService.welcome.test.ts` — Expected: PASS (4 tests). Then `yarn typecheck` (no new errors).

- [ ] **Step 7: Commit.**
```bash
git add services/tourService.ts tests/tourService.welcome.test.ts
git commit -m "feat(tour): extend welcome tour with locality/on-behalf/delegates/help steps; bump version; normalize naming"
```

---

### Task 6: Per-role one-click quick login (`LoginPage.tsx`)

**Files:**
- Modify: `components/LoginPage.tsx` (replace the "Demo Credentials" `<details>` block, lines ~227-247; add a `quickLogin` handler)
- Test: `tests/components/LoginPage.quicklogin.test.tsx`

**Interfaces:**
- Consumes: `authService.login`, the Task 1 keys (`quickLoginTitle`, `quickLoginNote`), and the EXISTING role-label keys `roleAdmin`/`roleManager`/`roleSubordinate`/`roleGuest`.

- [ ] **Step 1: Write the failing test** `tests/components/LoginPage.quicklogin.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { LoginPage } from '../../components/LoginPage';
import { authService } from '../../services/authService';

vi.mock('../../components/LoginScene3D', () => ({ LoginScene3D: () => null }));

const t = (k: string) => k;

describe('LoginPage quick login', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders a button per role', () => {
    render(<LoginPage onLogin={vi.fn()} lang="en" t={t} toggleLang={vi.fn()} />);
    expect(screen.getByText('roleAdmin')).toBeInTheDocument();
    expect(screen.getByText('roleManager')).toBeInTheDocument();
    expect(screen.getByText('roleSubordinate')).toBeInTheDocument();
    expect(screen.getByText('roleGuest')).toBeInTheDocument();
  });

  it('clicking a role logs in with the seeded account and calls onLogin', async () => {
    const fakeUser = { id: '2', username: 'sub', role: 'subordinate', name: 'Fatima' } as any;
    const login = vi.spyOn(authService, 'login').mockResolvedValue(fakeUser);
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} lang="en" t={t} toggleLang={vi.fn()} />);
    fireEvent.click(screen.getByText('roleSubordinate'));
    await waitFor(() => expect(login).toHaveBeenCalledWith('sub', 'password'));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(fakeUser));
  });
});
```

- [ ] **Step 2: Run it; verify it fails.** Run: `yarn vitest run tests/components/LoginPage.quicklogin.test.tsx` — Expected: FAIL (role buttons not found).

- [ ] **Step 3: Add a `quickLogin` handler.** In `LoginPage.tsx`, after `handleSubmit` (around line 74), add:
```typescript
  const quickLogin = async (uname: string) => {
    setError('');
    setUsername(uname);
    setPassword('password');
    setLoading(true);
    try {
      const user = await authService.login(uname, 'password');
      onLogin(user);
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const QUICK_ROLES: Array<{ labelKey: string; username: string }> = [
    { labelKey: 'roleAdmin', username: 'admin' },
    { labelKey: 'roleManager', username: 'manager' },
    { labelKey: 'roleSubordinate', username: 'sub' },
    { labelKey: 'roleGuest', username: 'user1' },
  ];
```

- [ ] **Step 4: Replace the Demo Credentials block.** Replace the entire `{/* Demo credentials */}` block (the `<div className="mt-12 pt-8 border-t border-gray-100"> ... </div>` containing the `<details>`, lines ~227-247) with a visible quick-login group:
```typescript
            {/* Quick login (demo) */}
            <div className="mt-12 pt-8 border-t border-gray-100">
               <p className="text-[10px] text-dune font-mono uppercase tracking-widest mb-3">{t('quickLoginTitle')}</p>
               <div className="grid grid-cols-2 gap-2">
                  {QUICK_ROLES.map(r => (
                    <button
                      key={r.username}
                      type="button"
                      onClick={() => quickLogin(r.username)}
                      disabled={loading}
                      className="text-left p-3 bg-gray-50 hover:bg-al-adaam hover:text-white rounded-lg border border-gray-100 text-xs font-bold text-charcoal transition-colors disabled:opacity-50"
                    >
                      {t(r.labelKey)}
                      <span className="block text-[10px] font-mono font-normal opacity-60 mt-0.5">@{r.username}</span>
                    </button>
                  ))}
               </div>
               <p className="text-[10px] text-gray-400 mt-3">{t('quickLoginNote')}</p>
            </div>
```

- [ ] **Step 5: Run it; verify it passes.** Run: `yarn vitest run tests/components/LoginPage.quicklogin.test.tsx` — Expected: PASS (2 tests). Then `yarn typecheck` (no new errors).

- [ ] **Step 6: Commit.**
```bash
git add components/LoginPage.tsx tests/components/LoginPage.quicklogin.test.tsx
git commit -m "feat(login): one-click per-role quick login (Admin/Manager/Assistant/Client)"
```

---

### Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the new test suites.** Run: `yarn vitest run tests/tourService.welcome.test.ts tests/components/HelpModal.test.tsx tests/components/LoginPage.quicklogin.test.tsx` — Expected: all PASS.

- [ ] **Step 2: Typecheck.** Run: `yarn typecheck` — Expected: no errors introduced by this branch (only the documented pre-existing set).

- [ ] **Step 3: Manual smoke (yarn dev).** Verify: the `?` opens the Help modal; "Start the guided tour" runs the welcome tour end-to-end with NO broken/top-left tooltips (every step has a visible spotlight, including the scheduler steps and the new feature steps); each login role button signs in as that role.

- [ ] **Step 4: Commit (if any cleanup).**
```bash
git add -A && git commit -m "chore: verification pass for tour/help/quick-login" || echo "nothing to commit"
```

---

## Notes for the implementer
- `tours` is exported from `services/tourService.ts` (`export const tours`), so the Task 5 test can import it directly.
- `HelpModal` uses `z-[60]` to sit above the header; the tour overlay uses `z-[9999]` and is mounted separately, so launching a tour from the modal (which closes first) won't overlap.
- The `delegates` step targets `[data-tour="profile"]`, which only renders for manager/admin; for other roles the tooltip still shows centered-ish via the viewport clamp — acceptable (`action:'none'`). If you prefer, gate that step's relevance later; not required now.
- Do NOT change the existing username/password form or Google SSO in `LoginPage`.
