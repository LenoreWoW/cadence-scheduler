import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n, type StringKey } from '../lib/i18n';
import { Button } from '../ui/Button';
import { LanguageToggle } from '../ui/LanguageToggle';

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
      <div className="gba-aurora hidden lg:flex flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl grid place-items-center font-semibold glass">C</div>
          <span className="font-semibold text-lg">Cadence</span>
        </div>
        <div>
          <h1 className="font-display text-5xl font-semibold leading-tight">{t('login.heroTitle1')}<br />{t('login.heroTitle2')}</h1>
          <p className="text-white/70 mt-4 max-w-sm">{t('login.heroSubtitle')}</p>
        </div>
        <p className="text-white/50 text-sm">{t('login.brand')}</p>
      </div>

      <div className="flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm flex justify-end">
          <LanguageToggle className="text-muted hover:text-[color:var(--text)]" />
        </div>
        <div className="w-full max-w-sm">
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
            <Button onClick={() => { if (PORTAL_URL !== '#') window.location.href = PORTAL_URL; }}>
              {t('login.continuePortal')}
            </Button>
          )}
          {err && <p role="alert" className="text-bad text-sm mt-4">{err}</p>}
        </div>
      </div>
    </div>
  );
};
