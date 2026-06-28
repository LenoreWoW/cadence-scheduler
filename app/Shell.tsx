import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { usePendingApproval } from './lib/hooks';
import { canApprove } from './lib/roles';
import { useI18n, type StringKey } from './lib/i18n';
import { Button } from './ui/Button';
import { LanguageToggle } from './ui/LanguageToggle';

const badge = (n: number) =>
  n > 0 ? (
    <span className="ms-1.5 inline-flex items-center rounded-full status-warn px-1.5 py-0.5 text-xs font-semibold">{n}</span>
  ) : null;

export const Shell: React.FC = () => {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const role = user?.role;
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Pending badge — only meaningful for approvers (host/admin/manager).
  const { data: pending = [] } = usePendingApproval();
  const pendingCount = canApprove(role) ? pending.length : 0;

  // On route change: close the mobile menu + move focus to main (a11y).
  useEffect(() => {
    setMenuOpen(false);
    mainRef.current?.focus();
  }, [location.pathname]);

  const allLinks: { to: string; labelKey: StringKey; end?: boolean; show: boolean; count: number }[] = [
    { to: '/', labelKey: 'nav.home', end: true, show: true, count: 0 },
    { to: '/requests', labelKey: 'nav.requests', show: canApprove(role), count: pendingCount },
    { to: '/schedule', labelKey: 'nav.schedule', show: true, count: 0 },
    { to: '/book', labelKey: 'nav.book', show: true, count: 0 },
  ];
  const links = allLinks.filter((l) => l.show);

  const doLogout = async () => { await logout(); nav('/login'); };

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-40 surface-2 border-b border-[color:var(--border)] backdrop-blur">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-5 h-16">
          <NavLink to="/" className="flex items-center gap-3 ring-focus rounded-lg">
            <div className="w-8 h-8 rounded-xl bg-al-adaam text-white grid place-items-center font-semibold">C</div>
            <span className="font-semibold tracking-tight text-lg">Cadence</span>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label={t('a11y.primaryNav')}>
            {links.map((l) => (
              <NavLink
                key={l.to} to={l.to} end={l.end}
                className={({ isActive }) =>
                  `ring-focus inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-al-adaam/10 text-al-adaam' : 'text-muted hover:text-[color:var(--text)]'
                  }`
                }
              >
                {t(l.labelKey)}{badge(l.count)}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user && <NavLink to="/profile" className="hidden sm:block text-sm text-muted hover:text-[color:var(--text)] ring-focus rounded">{user.name}</NavLink>}
            <LanguageToggle className="hidden sm:inline-flex text-muted hover:text-[color:var(--text)]" />
            <Button variant="ghost" className="hidden md:inline-flex" onClick={doLogout}>{t('common.signOut')}</Button>
            {/* Mobile hamburger */}
            <button
              type="button"
              className="md:hidden ring-focus rounded-lg p-2 min-h-11 min-w-11 grid place-items-center"
              aria-label={menuOpen ? t('a11y.closeMenu') : t('a11y.openMenu')}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav id="mobile-menu" aria-label={t('a11y.primaryNav')} className="md:hidden border-t border-[color:var(--border)] px-3 py-3 space-y-1">
            {links.map((l) => (
              <NavLink
                key={l.to} to={l.to} end={l.end}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-3 rounded-lg text-base font-medium ${
                    isActive ? 'bg-al-adaam/10 text-al-adaam' : 'text-[color:var(--text)] hover:bg-[color:var(--surface-2)]'
                  }`
                }
              >
                <span>{t(l.labelKey)}</span>{badge(l.count)}
              </NavLink>
            ))}
            <NavLink to="/profile" className="block px-3 py-3 rounded-lg text-base font-medium text-[color:var(--text)] hover:bg-[color:var(--surface-2)]">
              {t('nav.profile')}{user ? ` · ${user.name}` : ''}
            </NavLink>
            <div className="px-3 py-2"><LanguageToggle className="surface-2 text-[color:var(--text)]" /></div>
            <button onClick={doLogout} className="w-full text-start px-3 py-3 rounded-lg text-base font-medium text-bad hover:bg-[color:var(--surface-2)]">
              {t('common.signOut')}
            </button>
          </nav>
        )}
      </header>

      <main id="main-content" tabIndex={-1} ref={mainRef} className="flex-1 outline-none">
        <Outlet />
      </main>
    </div>
  );
};
