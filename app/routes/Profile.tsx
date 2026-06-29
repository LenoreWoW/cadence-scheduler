import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';
import { useI18n, roleLabelKey } from '../lib/i18n';
import { themeService } from '../../services/themeService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { DelegatesCard } from '../ui/DelegatesCard';
import { LanguageToggle } from '../ui/LanguageToggle';
import { PageHeader } from '../ui/PageHeader';
import { UserIcon, SparklesIcon, MoonIcon, SunIcon, GlobeIcon, LogOutIcon } from '../ui/icons';

// Mount-based reveal (initial/animate only — never whileInView, so content is
// always painted on first frame).
const inView = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4 },
});

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
        <Card className="gba-aurora noise relative overflow-hidden text-white text-center py-16">
          <div className="absolute inset-0 gba-grid opacity-[0.12]" aria-hidden="true" />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass relative mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl"
            aria-hidden="true"
          >
            <UserIcon size={28} />
          </motion.div>
          <p className="relative font-display text-xl font-semibold">{t('profile.notSignedIn')}</p>
          <p className="relative text-white/70 mt-2">{t('profile.notSignedInBody')}</p>
        </Card>
      </div>
    );
  }

  const roleKey = roleLabelKey(user.role);
  const roleLabel = roleKey ? t(roleKey) : user.role;

  return (
    <div>
      <PageHeader
        eyebrow={roleLabel}
        icon={<UserIcon size={13} />}
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
      />

      <div className="relative gba-mesh">
        <div className="mx-auto max-w-6xl px-5 py-8 space-y-5">
          {/* Identity card */}
          <motion.div {...inView()}>
            <Card className="gba-glow relative overflow-hidden">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-al-adaam text-white font-display text-2xl font-semibold select-none [box-shadow:var(--shadow)]"
                  aria-hidden="true"
                >
                  {initials(user.name)}
                </motion.div>
                <div className="min-w-0">
                  <p className="font-display text-2xl font-semibold truncate">{user.name}</p>
                  {user.title && <p className="text-muted text-sm truncate mt-0.5">{user.title}</p>}
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-al-adaam/10 px-2.5 py-0.5 text-xs font-semibold text-al-adaam">
                    <UserIcon size={12} />
                    {roleLabel}
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
          </motion.div>

          {/* Preferences */}
          <motion.div {...inView(0.06)}>
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-al-adaam/10 text-al-adaam">
                  <SparklesIcon size={18} />
                </span>
                <h2 className="font-display text-lg font-semibold">{t('profile.preferences')}</h2>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl surface-2 text-[color:var(--text)]">
                    {dark ? <MoonIcon size={18} /> : <SunIcon size={18} />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{t('profile.darkMode')}</p>
                    <p className="text-muted text-sm">{t('profile.darkModeDesc')}</p>
                  </div>
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
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl surface-2 text-[color:var(--text)]">
                    <GlobeIcon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{t('profile.language')}</p>
                    <p className="text-muted text-sm">{t('profile.languageDesc')}</p>
                  </div>
                </div>
                <LanguageToggle className="surface-2 text-[color:var(--text)] hover:bg-al-adaam/10" />
              </div>
            </Card>
          </motion.div>

          {/* Delegates (assistant model) */}
          <motion.div {...inView(0.12)}>
            <DelegatesCard />
          </motion.div>

          {/* Account actions */}
          <motion.div {...inView(0.18)}>
            <Card>
              <div className="flex items-center gap-3 mb-1">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-al-adaam/10 text-al-adaam">
                  <LogOutIcon size={18} />
                </span>
                <h2 className="font-display text-lg font-semibold">{t('profile.account')}</h2>
              </div>
              <p className="text-muted text-sm mb-4">{t('profile.accountDesc')}</p>
              <Button variant="secondary" onClick={handleSignOut} disabled={signingOut}>
                {signingOut ? t('profile.signingOut') : t('common.signOut')}
              </Button>
              {signOutErr && <p role="alert" className="text-bad text-sm mt-3">{signOutErr}</p>}
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
