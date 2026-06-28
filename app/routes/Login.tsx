import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../ui/Button';

const DEV = import.meta.env.DEV || import.meta.env.VITE_DEV_LOGIN === 'true';
const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL as string | undefined) || '#';
const ROLES = [
  { u: 'admin', l: 'Admin' },
  { u: 'manager', l: 'Manager' },
  { u: 'sub', l: 'Subordinate' },
  { u: 'user1', l: 'Guest' },
];

export const Login: React.FC = () => {
  const { login } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (u: string) => {
    setErr(''); setBusy(true);
    try { await login(u, 'password'); nav('/'); }
    catch (e: any) { setErr(e?.body?.error || e?.message || 'Sign-in failed'); }
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
          <h1 className="font-display text-5xl font-semibold leading-tight">Scheduling,<br />handled.</h1>
          <p className="text-white/70 mt-4 max-w-sm">Request, approve, and manage meetings for your office — one shared schedule.</p>
        </div>
        <p className="text-white/50 text-sm">Qatar GBA · Cadence</p>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-semibold mb-2">Sign in</h2>
          <p className="text-muted text-sm mb-8">
            You normally arrive authenticated from the portal.{DEV ? ' For now, choose a role to continue:' : ''}
          </p>
          {DEV ? (
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map((r) => (
                <Button key={r.u} variant="secondary" disabled={busy} onClick={() => go(r.u)}>{r.l}</Button>
              ))}
            </div>
          ) : (
            <Button onClick={() => { if (PORTAL_URL !== '#') window.location.href = PORTAL_URL; }}>
              Continue to the portal
            </Button>
          )}
          {err && <p role="alert" className="text-bad text-sm mt-4">{err}</p>}
        </div>
      </div>
    </div>
  );
};
