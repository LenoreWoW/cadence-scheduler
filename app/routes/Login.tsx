import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';
import { useI18n, type StringKey } from '../lib/i18n';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { LanguageToggle } from '../ui/LanguageToggle';
import { UserIcon, CalendarIcon, ArrowRightIcon } from '../ui/icons';

const DEV = import.meta.env.DEV || import.meta.env.VITE_DEV_LOGIN === 'true';
const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL as string | undefined) || '#';
const ROLES: { u: string; labelKey: StringKey }[] = [
  { u: 'admin', labelKey: 'login.roleAdmin' },
  { u: 'manager', labelKey: 'login.roleManager' },
  { u: 'sub', labelKey: 'login.roleSub' },
  { u: 'user1', labelKey: 'login.roleGuest' },
];

export const Login: React.FC = () => {
  const { login } = useAuth();
  const nav = useNavigate();
  const { t } = useI18n();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (u: string) => {
    setErr(''); setBusy(true);
    try { await login(u, 'password'); nav('/'); }
    catch (e: any) { setErr(e?.body?.error || e?.message || t('login.failed')); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Immersive brand panel */}
      <div className="gba-aurora noise relative overflow-hidden hidden lg:flex flex-col justify-between p-12 text-white">
        <div className="absolute inset-0 gba-grid opacity-[0.12]" aria-hidden="true" />

        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl grid place-items-center font-semibold glass">C</div>
          <span className="font-semibold text-lg">Cadence</span>
        </div>

        {/* Decorative floating glass detail */}
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
          className="glass pointer-events-none absolute end-10 top-24 hidden w-56 rounded-2xl p-4 xl:block"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15">
              <CalendarIcon size={18} />
            </span>
            <div className="space-y-1.5">
              <div className="h-2 w-20 rounded-full bg-white/35" />
              <div className="h-2 w-12 rounded-full bg-white/15" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-2 w-full rounded-full bg-white/15" />
            <div className="h-2 w-2/3 rounded-full bg-white/15" />
          </div>
        </motion.div>

        <div className="relative">
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
            className="font-display text-5xl font-semibold leading-tight"
          >
            {t('login.heroTitle1')}<br />{t('login.heroTitle2')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.45 }}
            className="text-white/70 mt-4 max-w-sm"
          >
            {t('login.heroSubtitle')}
          </motion.p>
        </div>

        <p className="relative text-white/50 text-sm">{t('login.brand')}</p>
      </div>

      {/* Sign-in panel */}
      <div className="relative gba-mesh flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 lg:invisible">
              <div className="w-9 h-9 rounded-xl grid place-items-center font-semibold bg-al-adaam text-white">C</div>
              <span className="font-semibold text-lg">Cadence</span>
            </div>
            <LanguageToggle className="text-muted hover:text-[color:var(--text)]" />
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Card>
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-al-adaam/10 text-al-adaam mb-4">
                <UserIcon size={22} />
              </span>
              <h2 className="font-display text-2xl font-semibold mb-2">{t('login.title')}</h2>
              <p className="text-muted text-sm mb-8">
                {t('login.portalNote')}{DEV ? t('login.devNote') : ''}
              </p>
              {DEV ? (
                <div className="grid grid-cols-2 gap-3">
                  {ROLES.map((r) => (
                    <Button key={r.u} variant="secondary" disabled={busy} onClick={() => go(r.u)}>{t(r.labelKey)}</Button>
                  ))}
                </div>
              ) : (
                <Button className="w-full" onClick={() => { if (PORTAL_URL !== '#') window.location.href = PORTAL_URL; }}>
                  {t('login.continuePortal')}
                  <ArrowRightIcon size={16} className="rtl:rotate-180" />
                </Button>
              )}
              {err && <p role="alert" className="text-bad text-sm mt-4">{err}</p>}
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
