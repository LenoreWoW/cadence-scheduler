import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';
import { themeService } from '../../services/themeService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  subordinate: 'Team member',
  guest: 'Guest',
};

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();

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
      setSignOutErr(e?.message || 'Sign out failed — please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  // Empty / signed-out state
  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="font-display text-3xl font-semibold mb-6">Profile</h1>
        <Card className="gba-aurora text-white text-center py-16">
          <p className="font-display text-xl font-semibold">You're not signed in</p>
          <p className="text-white/70 mt-2">Sign in to view and manage your profile.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold">Profile</h1>
        <p className="text-muted text-sm mt-1">Manage your account and preferences.</p>
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
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </div>
          </div>

          {user.email && (
            <div className="mt-5 border-t border-[color:var(--border)] pt-4">
              <p className="text-muted text-xs uppercase tracking-wide">Email</p>
              <p className="text-sm mt-1 truncate">{user.email}</p>
            </div>
          )}
        </Card>

        {/* Preferences */}
        <Card>
          <h2 className="font-display text-lg font-semibold mb-4">Preferences</h2>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium">Dark mode</p>
              <p className="text-muted text-sm">Switch between light and dark appearance.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              aria-label="Toggle dark mode"
              onClick={toggleDark}
              className={`ring-focus relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                dark ? 'bg-al-adaam' : 'bg-[color:var(--surface-2)]'
              }`}
            >
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm ${dark ? 'left-6' : 'left-1'}`}
              />
            </button>
          </div>
        </Card>

        {/* Account actions */}
        <Card>
          <h2 className="font-display text-lg font-semibold mb-1">Account</h2>
          <p className="text-muted text-sm mb-4">Sign out of your current session.</p>
          <Button variant="secondary" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
          {signOutErr && <p className="text-salmon text-sm mt-3">{signOutErr}</p>}
        </Card>
      </div>
    </div>
  );
};
