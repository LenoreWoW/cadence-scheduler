# Phase 1 — Foundation (design system) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task (all subagents on **Opus**). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Establish the redesign's design-system foundation so every later surface inherits it: ONE token source (Qatar GBA palette, systematized), sans-only type (Outfit/Inter/JetBrains Mono — drop the unused Playfair/serif), a radii/spacing/motion scale, a single canonical **Modal** primitive, real dark-mode token coverage, and the **Cadence** wordmark. Visual direction: **minimal premium SaaS**.

**Architecture:** Tokens unified into `index.css :root` (+ `:root.dark`) and `tailwind.config.js` as the single source; the duplicated inline token/component `<style>` block in `index.html` is removed. Shared primitives (Button/Card/Input/Modal/Toast/ThemeToggle) restyled to tokens and de-hardcoded. No surface "looks done" yet — that's later chunks.

**Tech Stack:** React 19 + Vite + TypeScript, Tailwind 3.4 (`darkMode:'class'`, purge on), `motion/react` (framer-motion), Vitest.

## Global Constraints

- **Package manager: `yarn`.** Verify with `yarn typecheck` (judge by NEW errors only — pre-existing unrelated set: EmptyState3D, QuickBookModal, stale tests, vitest.config) and `yarn vitest run` (kept suites stay green).
- **GBA palette is authoritative & unchanged in value** — Al Adaam `#8A1538`, Dune `#A29475`, Black `#000`, White, Skyline `#0D4261`, Palm `#129B82`, Sea `#4194B3`, Sunrise `#FDF39D`, Salmon `#DD7877`, Dark Purple `#511C3C`, Green `#5A895A`, Purple `#8067A4`, Yellow `#E9C56B`. Apply by ROLE (primary/neutral spine + sparing secondary accents). Keep meeting tokens (`--meeting-internal/external`).
- **Dynamic colors via inline `style` + CSS vars or Tailwind tokens** (purge: no dynamic class strings). Replace raw hex with tokens.
- **Brand name = Cadence** (replace REGENT wordmark; the GBA *colours* stay — that's the government identity, the product name is Cadence).
- **DEFER the bulk `#8A1538` literal sweep** (~276 remaining in surface components) to the per-surface chunks — Foundation only de-hardcodes the SHARED PRIMITIVES (3 spots) + the wordmark. (`[#8A1538]` already renders as the maroon, so this is hygiene, not a visual change.)
- **Sans-only type:** alias Tailwind `fontFamily.serif → Outfit` so all ~29 `font-serif` usages render Outfit with ONE change (no per-file edits); remove Playfair from the fonts link.
- All UI stays bilingual (en/ar) + RTL-aware.

---

## File Structure
**New:** `components/Modal.tsx` (canonical modal, from BottomSheet); `tests/components/Modal.test.tsx`.
**Modified:** `index.css` (tokens, dark vars, component classes), `index.html` (remove duplicated token `<style>`, remove Playfair), `tailwind.config.js` (serif alias, missing GBA tokens, radii), `components/Button.tsx`, `components/Card.tsx`, `components/Input.tsx`, `components/FloatingLabelInput.tsx`, `components/ThemeToggle.tsx`, `components/ConfirmationModal.tsx` (migrate to Modal), `components/Toast.tsx` (fix `yellow-accent`), `constants.ts` (APP_NAME), `index.tsx` (wordmark), `components/AcceptInvitePage.tsx`, `components/PrivacyPolicyPage.tsx`, `components/TermsOfServicePage.tsx` (wordmark).

---

### Task 1: Token system — single source + GBA semantic layer + sans-only type

**Files:** `tailwind.config.js`, `index.css`, `index.html`.

**Interfaces:** Produces the unified token system (Tailwind `serif`→Outfit; full GBA color set incl. `green`/`purple`/`yellow-accent`; radii scale; semantic tokens) consumed by all later tasks/chunks.

- [ ] **Step 1: tailwind.config.js — complete the GBA palette + serif alias + radii.** In `theme.extend.colors`, add the missing GBA secondaries so tokens exist for the whole palette:
```js
        'green': '#5A895A',
        'purple': '#8067A4',
        'yellow-accent': '#E9C56B',
```
(The last fixes `Toast.tsx`'s undefined `yellow-accent` warning style.) In `theme.extend.fontFamily`, add a `serif` alias to Outfit so existing `font-serif` usages become the display sans:
```js
        serif: ['Outfit', 'sans-serif'],
```
Add a small radius scale to `theme.extend`:
```js
      borderRadius: { 'xl2': '1rem' },
```
(Use existing Tailwind radii otherwise; we standardize on `rounded-lg`/`rounded-xl`.)

- [ ] **Step 2: index.html — remove the duplicated inline token/component `<style>` block + Playfair.** The inline `<style>` (~lines 14-268) duplicates index.css tokens/`.btn`/`.card`/`.input`/dark vars with hardcoded values and has DRIFTED (missing dark vars, locality tokens, ease curves). Delete that inline `<style>` block entirely so `index.css` is the single source. KEEP any genuinely render-blocking critical CSS that prevents FOUC if present (e.g., base bg/font on `html,body`) — re-add a MINIMAL version if removing it flashes. In the Google Fonts `<link>`, remove the `Playfair Display` family (it's loaded but never used). Keep Outfit, Inter, JetBrains Mono, IBM Plex Sans Arabic. Keep the time-of-day `<script>` (it sets `body[data-time]`, used by index.css theming).

- [ ] **Step 3: index.css — add light-mode base vars + GBA semantic tokens + rename comment.** In `:root` (after the color block), add the surface/text/border vars for LIGHT mode (today they exist ONLY in `:root.dark`, so light mode has no token fallback) and semantic accents:
```css
  /* Surfaces & text (light) */
  --bg-primary: #F9F9F9;
  --bg-secondary: #FFFFFF;
  --bg-card: #FFFFFF;
  --border-color: rgba(162, 148, 117, 0.18);
  --text-primary: #111111;
  --text-secondary: #6b6b6b;
  /* Semantic accents (GBA-mapped) */
  --accent-success: #129b82; /* palm */
  --accent-pending: #dd7877; /* salmon */
  --accent-info: #4194b3;    /* sea */
```
Change the comment `/* Color System - Regent Brand */` → `/* Color System — Qatar GBA palette */`. (`:root.dark` already overrides `--bg-*`/`--text-*`/`--border-color` — leave those.)

- [ ] **Step 4: Verify.** `yarn typecheck` (no new errors). Build sanity: `yarn vitest run tests/components/MeetingList.locality.test.tsx tests/components/HelpModal.test.tsx` → PASS. Manually confirm (or reason) that `font-serif` now resolves to Outfit and no Playfair request is made. Confirm `bg-yellow-accent`/`text-yellow-accent` now resolve.

- [ ] **Step 5: Commit.**
```bash
git add tailwind.config.js index.css index.html
git commit -m "feat(design): unify GBA tokens to one source; sans-only type (serif→Outfit, drop Playfair); add semantic + light surface tokens"
```

---

### Task 2: Canonical `Modal` primitive (from BottomSheet) + migrate ConfirmationModal

**Files:** Create `components/Modal.tsx`, `tests/components/Modal.test.tsx`; Modify `components/ConfirmationModal.tsx`.

**Interfaces:**
- Produces `export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title?: string; children: React.ReactNode; lang?: 'en'|'ar'; size?: 'sm'|'md'|'lg'; }>` — portal, animated, ESC-to-close, backdrop-click-close, `role="dialog"`/`aria-modal`, RTL-aware, mobile bottom-sheet / desktop centered.

- [ ] **Step 1: Write the failing test** `tests/components/Modal.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Modal } from '../../components/Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal isOpen={false} onClose={vi.fn()}>hi</Modal>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('renders children + title with dialog semantics when open', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="My Title">body content</Modal>);
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('body content')).toBeInTheDocument();
  });
  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="T">x</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it; verify it fails.** `yarn vitest run tests/components/Modal.test.tsx` — FAIL (no module).

- [ ] **Step 3: Implement `components/Modal.tsx`** (promotes BottomSheet; fixes its limitations — keeps `isOpen` inside `AnimatePresence` so exit animates, adds ESC + `role=dialog`/`aria-modal` + RTL + token backdrop + size):
```typescript
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  lang?: 'en' | 'ar';
  size?: 'sm' | 'md' | 'lg';
}

const SIZE: Record<string, string> = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, lang = 'en', size = 'md' }) => {
  const [isMobile, setIsMobile] = useState(false);
  const isRTL = lang === 'ar';

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const closeBtn = (
    <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-charcoal dark:hover:text-white p-2 -m-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" dir={isRTL ? 'rtl' : 'ltr'}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm"
          />
          {isMobile ? (
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              drag="y" dragConstraints={{ top: 0 }} dragElastic={0.2}
              onDragEnd={(_, info) => { if (info.offset.y > 100) onClose(); }}
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl p-6 shadow-xl max-h-[88vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-5" />
              {title && <h3 className="text-lg font-semibold text-charcoal dark:text-white mb-4">{title}</h3>}
              {children}
            </motion.div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.18 }}
                className={`pointer-events-auto w-full ${SIZE[size]} bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden`}
              >
                {title && (
                  <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-charcoal dark:text-white">{title}</h3>
                    {closeBtn}
                  </div>
                )}
                <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
              </motion.div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
```

- [ ] **Step 4: Run it; verify it passes.** `yarn vitest run tests/components/Modal.test.tsx` → PASS (3 tests).

- [ ] **Step 5: Migrate `ConfirmationModal.tsx` to use `Modal`** (proof-of-pattern; preserves its props + Button usage + RTL). Replace its hand-rolled overlay with `<Modal isOpen={isOpen} onClose={onClose} title={title} lang={isRTL ? 'ar' : 'en'} size="sm">` wrapping the message + the two `Button`s (keep `variant="danger"` confirm + `variant="secondary"` cancel). Keep the warning icon. Remove the old `fixed inset-0` scaffolding.

- [ ] **Step 6: Verify + commit.** `yarn typecheck`; `yarn vitest run tests/components/Modal.test.tsx`.
```bash
git add components/Modal.tsx tests/components/Modal.test.tsx components/ConfirmationModal.tsx
git commit -m "feat(design): canonical Modal primitive (portal, ESC, a11y, RTL, mobile sheet); migrate ConfirmationModal"
```

---

### Task 3: Restyle shared primitives to the new system + de-hardcode

**Files:** `components/Button.tsx`, `components/Card.tsx` (+ `index.css` `.card`/`.input`/`.btn`), `components/Input.tsx`, `components/FloatingLabelInput.tsx`, `components/ThemeToggle.tsx`, `components/Toast.tsx`.

**Interfaces:** Consumes Task 1 tokens. Produces tokenized, calmer primitives (minimal-SaaS).

- [ ] **Step 1: Button — calm the uppercase, refine to minimal-SaaS.** In `components/Button.tsx`, change `baseStyle`: remove `uppercase tracking-wider`; use `rounded-lg` (not `rounded`), `font-semibold`, keep the motion. Keep variants but soften heavy `shadow-lg shadow-al-adaam/25` → `shadow-sm`. (Tokens already used — no hex.)

- [ ] **Step 2: De-hardcode FloatingLabelInput + ThemeToggle.** Replace the raw `#8A1538` with the token: in `components/FloatingLabelInput.tsx` `focus:ring-[#8A1538]` → `focus:ring-al-adaam` and `text-[#8A1538]` → `text-al-adaam`; in `components/ThemeToggle.tsx` `focus:ring-[#8A1538]` → `focus:ring-al-adaam`. (3 spots total.)

- [ ] **Step 3: index.css primitives — modernize radii + de-emphasize uppercase.** In `.input` change `border-radius: 4px` → `8px`; in `.card` keep `8px` (or bump to `12px` for the softer SaaS look — pick 12px). In `.input:focus ~ .input-label` keep the small-caps treatment (it's a floating label, acceptable). Replace the `.input` hardcoded `color:#000000; background:#FFFFFF; border-color: rgba(162,148,117,0.4)` with tokens: `color: var(--text-primary); background: var(--bg-secondary); border-color: var(--border-color)` so dark mode works.

- [ ] **Step 4: Toast — ensure tokens resolve.** `yellow-accent` is now a real token (Task 1). No code change needed beyond confirming; optionally move the per-instance injected `@keyframes progress` into index.css (low priority — leave if risky).

- [ ] **Step 5: Verify + commit.** `yarn typecheck`; `yarn vitest run` kept suites. Grep `grep -rn "\[#8A1538\]" components/Button.tsx components/Card.tsx components/Input.tsx components/FloatingLabelInput.tsx components/ThemeToggle.tsx components/Toast.tsx` → ZERO.
```bash
git add components/Button.tsx components/Card.tsx components/Input.tsx components/FloatingLabelInput.tsx components/ThemeToggle.tsx components/Toast.tsx index.css
git commit -m "feat(design): restyle primitives to minimal-SaaS tokens; de-hardcode brand hex; token-based input dark mode"
```

---

### Task 4: Brand wordmark → Cadence

**Files:** `index.tsx` (desktop header ~624-627, mobile header ~747-751), `constants.ts` (`APP_NAME`), `components/AcceptInvitePage.tsx`, `components/PrivacyPolicyPage.tsx`, `components/TermsOfServicePage.tsx`. (LoginPage's REGENT wordmark is handled in the later Auth chunk where LoginPage is removed.)

**Interfaces:** none new.

- [ ] **Step 1: Replace the REGENT wordmark with Cadence.** In each site, change the visible `REGENT` / `REGENT.` wordmark text to `Cadence` (keep the existing styling/structure; the single-letter "R" avatar logo becomes "C"). Sites: `index.tsx` desktop header, `index.tsx` mobile header, `components/AcceptInvitePage.tsx`, `components/PrivacyPolicyPage.tsx`, `components/TermsOfServicePage.tsx`. Use `grep -rn "REGENT\|Regent" index.tsx components/AcceptInvitePage.tsx components/PrivacyPolicyPage.tsx components/TermsOfServicePage.tsx` to find exact spots.

- [ ] **Step 2: `constants.ts` — `APP_NAME`.** Change `export const APP_NAME = "Regent";` → `export const APP_NAME = "Cadence";`.

- [ ] **Step 3: Verify + commit.** `yarn typecheck`; grep `grep -rn "REGENT\|Regent" index.tsx components/AcceptInvitePage.tsx components/PrivacyPolicyPage.tsx components/TermsOfServicePage.tsx constants.ts` → ZERO (Privacy/Terms may also have body copy "Regent" — change those to Cadence too).
```bash
git add index.tsx constants.ts components/AcceptInvitePage.tsx components/PrivacyPolicyPage.tsx components/TermsOfServicePage.tsx
git commit -m "feat(brand): standardize wordmark on Cadence (was REGENT)"
```

---

### Task 5: Full verification pass

- [ ] **Step 1: Tests.** `yarn vitest run` — kept suites pass (incl. the new `Modal.test.tsx`); only the pre-existing stale `authService`/`schedulerService` suites fail (unchanged).
- [ ] **Step 2: Typecheck.** `yarn typecheck` — no new errors.
- [ ] **Step 3: Runtime smoke.** `yarn server` + `yarn dev --port 5173`; confirm the app renders with the new fonts (no Playfair request), dark mode toggles cleanly on the primitives, a ConfirmationModal opens/escapes/closes, and the header shows "Cadence". (Playwright MCP can't reach localhost — verify via the browser yourself / HTTP for the asset checks.)
- [ ] **Step 4: Commit any cleanup.**
```bash
git add -A && git commit -m "chore: verification pass for Phase 1 foundation" || echo "nothing to commit"
```

---

## Notes for the implementer
- **Single source of truth:** after Task 1, NO design tokens should remain in `index.html`'s inline `<style>` — `index.css :root` + `tailwind.config.js` are canonical. If removing the inline block causes a flash-of-unstyled-content, re-add only minimal `html,body` base styling.
- **font-serif:** do NOT edit the ~29 `font-serif` call sites — the Tailwind `serif`→Outfit alias fixes them all at once. (A later "minimal type" pass can remove `font-serif` from JSX, but it's cosmetic now.)
- **Deferred (NOT this chunk):** the ~276 remaining `#8A1538` literals in surface components, the `ui-avatars.com`/`source.unsplash.com` placeholders, and migrating the other ~28 hand-rolled modals to `Modal` — these happen in the per-surface chunks (Dashboard, Scheduler, etc.).
- **Do not** remove Teams, webhooks, locality/tentative, tour/help, or the dev quick-login. This chunk is presentation-only.
