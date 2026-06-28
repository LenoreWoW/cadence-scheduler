import React, { useState } from 'react';
import { Button } from './Button';
import { authService } from '../services/authService';
import { User, Language } from '../types';

interface PortalGateProps {
  onLogin: (user: User) => void;
  lang: Language;
  t: (key: string) => string;
  toggleLang: () => void;
}

// Dev-only entry: rendered only in a dev build, or when VITE_DEV_LOGIN === 'true'.
// In production the user arrives already authenticated from the org portal, so the
// gate is just a redirect placeholder (the real handoff is wired server-side later).
const DEV_LOGIN_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_DEV_LOGIN === 'true';

const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL as string | undefined) || '#';

const QUICK_ROLES: Array<{ labelKey: string; username: string }> = [
  { labelKey: 'roleAdmin', username: 'admin' },
  { labelKey: 'roleManager', username: 'manager' },
  { labelKey: 'roleSubordinate', username: 'sub' },
  { labelKey: 'roleGuest', username: 'user1' },
];

export const PortalGate: React.FC<PortalGateProps> = ({ onLogin, lang, t, toggleLang }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isRTL = lang === 'ar';

  const quickLogin = async (uname: string) => {
    setError('');
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

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 bg-off-white dark:bg-[#0a0a0a] text-charcoal dark:text-gray-100 font-sans"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="absolute top-6 ltr:right-6 rtl:left-6">
        <button
          onClick={toggleLang}
          className="text-xs font-semibold border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-al-adaam hover:text-white hover:border-al-adaam transition-colors"
        >
          {lang === 'en' ? 'Arabic' : 'English'}
        </button>
      </div>

      <div className="w-full max-w-sm text-center">
        {/* Brand */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 bg-al-adaam rounded-xl flex items-center justify-center text-white font-serif font-bold italic text-lg shadow-lg shadow-al-adaam/20">
            C
          </div>
          <span className="text-2xl font-display font-bold tracking-tight">Cadence</span>
        </div>

        {/* Portal redirect */}
        <h1 className="text-2xl font-display font-semibold mb-3">{t('portalSignInTitle')}</h1>
        <p className="text-sm text-dune dark:text-gray-400 mb-8 leading-relaxed">
          {t('portalSignInSubtitle')}
        </p>

        <Button
          fullWidth
          onClick={() => {
            if (PORTAL_URL === '#') return;
            window.location.href = PORTAL_URL;
          }}
        >
          {t('portalSignInButton')}
        </Button>

        {error && (
          <div className="mt-6 text-salmon text-xs font-semibold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r ltr:text-left rtl:text-right">
            {error}
          </div>
        )}

        {/* Dev-only quick entry */}
        {DEV_LOGIN_ENABLED && (
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 ltr:text-left rtl:text-right">
            <p className="text-[10px] text-dune font-mono uppercase tracking-widest mb-3">
              {t('devEntryTitle')} · {t('quickLoginTitle')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ROLES.map((r) => (
                <button
                  key={r.username}
                  type="button"
                  onClick={() => quickLogin(r.username)}
                  disabled={loading}
                  className="ltr:text-left rtl:text-right p-3 bg-white dark:bg-gray-800 hover:bg-al-adaam hover:text-white rounded-lg border border-gray-100 dark:border-gray-700 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {t(r.labelKey)}
                  <span className="block text-[10px] font-mono font-normal opacity-60 mt-0.5">@{r.username}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-3">{t('quickLoginNote')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
