import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';
import { useI18n, roleLabelKey } from '../lib/i18n';
import { themeService } from '../../services/themeService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { DelegatesCard } from '../ui/DelegatesCard';
import { LanguageToggle } from '../ui/LanguageToggle';

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const { t } = useI18n();

  // Dark mode is owned by themeService (persists to localStorage + applied on load).
  const [dark, setDark] = useState<boolean>(() => themeService.isDarkMode());
  useEffect(() => {
    const unsub = themeService.subscribe(() => setDark(themeService.isDarkMode()));
    return () => { unsub(); };
  }, []);
  const toggleDark = () => themeService.toggle();

  const [signingOut, setSigningOut] = useState(false);
  const [signOutErr, setSignOutErr] = useState('');

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutErr('');
    try {
      await logout();
    } catch (e: any) {
      setSignOutErr(e?.message || t('profile.signOutErr'));
    } finally {
      setSigningOut(false);
    }
  };

  // Empty / signed-out state
  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="font-display text-3xl font-semibold mb-6">{t('profile.title')}</h1>
        <Card className="gba-aurora text-white text-center py-16">
          <p className="font-display text-xl font-semibold">{t('profile.notSignedIn')}</p>
          <p className="text-white/70 mt-2">{t('profile.notSignedInBody')}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold">{t('profile.title')}</h1>
        <p className="text-muted text-sm mt-1">{t('profile.subtitle')}</p>
      </header>

      <div className="space-y-4">
        {/* Identity card */}
        <Card>
          <div className="flex items-center gap-5">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-al-adaam text-white font-display text-xl font-semibold select-none"
              aria-hidden="true"
            >
              {initials(user.name)}
            </motion.div>
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold truncate">{user.name}</p>
              {user.title && <p className="text-muted text-sm truncate">{user.title}</p>}
              <span className="mt-2 inline-flex items-center rounded-full bg-al-adaam/10 px-2.5 py-0.5 text-xs font-semibold text-al-adaam">
                {roleLabelKey(user.role) ? t(roleLabelKey(user.role)!) : user.role}
              </span>
            </div>
          </div>

          {user.email && (
            <div className="mt-5 border-t border-[color:var(--border)] pt-4">
              <p className="text-muted text-xs uppercase tracking-wide">{t('profile.email')}</p>
              <p className="text-sm mt-1 truncate">{user.email}</p>
            </div>
          )}
        </Card>

        {/* Preferences */}
        <Card>
          <h2 className="font-display text-lg font-semibold mb-4">{t('profile.preferences')}</h2>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium">{t('profile.darkMode')}</p>
              <p className="text-muted text-sm">{t('profile.darkModeDesc')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              aria-label={t('a11y.toggleDark')}
              onClick={toggleDark}
              className={`ring-focus relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                dark ? 'bg-al-adaam' : 'bg-[color:var(--surface-2)]'
              }`}
            >
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm ${dark ? 'start-6' : 'start-1'}`}
              />
            </button>
          </div>

          <div className="mt-5 border-t border-[color:var(--border)] pt-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium">{t('profile.language')}</p>
              <p className="text-muted text-sm">{t('profile.languageDesc')}</p>
            </div>
            <LanguageToggle className="surface-2 text-[color:var(--text)] hover:bg-al-adaam/10" />
          </div>
        </Card>

        {/* Delegates (assistant model) */}
        <DelegatesCard />

        {/* Account actions */}
        <Card>
          <h2 className="font-display text-lg font-semibold mb-1">{t('profile.account')}</h2>
          <p className="text-muted text-sm mb-4">{t('profile.accountDesc')}</p>
          <Button variant="secondary" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? t('profile.signingOut') : t('common.signOut')}
          </Button>
          {signOutErr && <p role="alert" className="text-bad text-sm mt-3">{signOutErr}</p>}
        </Card>
      </div>
    </div>
  );
};
