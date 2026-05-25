/**
 * CalDavConnect
 *
 * Third provider tile in CalendarSyncSettings — connects an Apple / CalDAV
 * calendar with an app-specific password. Renders a "Connect" button that
 * opens a credentials modal, and a "Disconnect" affordance when connected.
 *
 * Endpoints:
 *   GET    /api/calendar/caldav/status
 *   POST   /api/calendar/caldav/connect      { serverUrl, username, password, autoDiscoverEmail }
 *   DELETE /api/calendar/caldav/disconnect
 */

import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiFetch, apiJson } from '../services/api';
import { Language } from '../types';

interface CalDavStatus {
  connected: boolean;
  email?: string | null;
  serverUrl?: string | null;
  calendarName?: string | null;
  connectedAt?: string | null;
}

interface Props {
  lang: Language;
}

const ICLOUD_URL = 'https://caldav.icloud.com';
const FASTMAIL_URL = 'https://caldav.fastmail.com/dav/';
const YAHOO_URL = 'https://caldav.calendar.yahoo.com';

function inferServerUrl(email: string): string {
  const lower = email.trim().toLowerCase();
  if (lower.endsWith('@icloud.com') || lower.endsWith('@me.com') || lower.endsWith('@mac.com')) {
    return ICLOUD_URL;
  }
  if (lower.endsWith('@fastmail.com') || lower.endsWith('@fastmail.fm')) {
    return FASTMAIL_URL;
  }
  if (lower.endsWith('@yahoo.com')) {
    return YAHOO_URL;
  }
  return '';
}

export const CalDavConnect: React.FC<Props> = ({ lang }) => {
  const isRTL = lang === 'ar';

  const [status, setStatus] = useState<CalDavStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [autoDiscoverEmail, setAutoDiscoverEmail] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await apiFetch('/api/calendar/caldav/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        // Endpoint not ready — show graceful default.
        setStatus({ connected: false });
      }
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const openConnectModal = () => {
    setAutoDiscoverEmail('');
    setServerUrl('');
    setUsername('');
    setPassword('');
    setError(null);
    setModalOpen(true);
  };

  const handleEmailChange = (value: string) => {
    setAutoDiscoverEmail(value);
    if (!serverUrl) {
      const inferred = inferServerUrl(value);
      if (inferred) setServerUrl(inferred);
    }
    if (!username) {
      setUsername(value);
    }
  };

  const handleConnect = async () => {
    if (!serverUrl.trim() || !username.trim() || !password) {
      setError(isRTL ? 'كل الحقول مطلوبة' : 'All fields are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiJson('/api/calendar/caldav/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: serverUrl.trim(),
          username: username.trim(),
          password,
          autoDiscoverEmail: autoDiscoverEmail.trim() || null,
        }),
      });
      setModalOpen(false);
      await fetchStatus();
    } catch (err: any) {
      setError(
        err?.body?.error ||
          err?.message ||
          (isRTL ? 'فشل الاتصال بـ CalDAV' : 'Failed to connect CalDAV'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(isRTL ? 'قطع اتصال Apple / CalDAV؟' : 'Disconnect Apple / CalDAV?')) return;
    try {
      await apiFetch('/api/calendar/caldav/disconnect', { method: 'DELETE' });
      await fetchStatus();
    } catch {
      setError(isRTL ? 'فشل قطع الاتصال' : 'Failed to disconnect');
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="animate-pulse h-12 bg-slate-100 dark:bg-slate-700 rounded" />
      </div>
    );
  }

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Apple / CalDAV icon */}
          <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center text-slate-700">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M16.365 1.43c0 1.14-.464 2.235-1.225 3.027-.82.85-2.158 1.5-3.27 1.41-.14-1.094.41-2.236 1.16-3.045.836-.9 2.262-1.566 3.335-1.392zM20.5 17.36c-.59 1.32-.876 1.91-1.636 3.08-1.062 1.63-2.56 3.66-4.418 3.67-1.65.02-2.077-1.062-4.32-1.05-2.245.013-2.713 1.07-4.365 1.06-1.86-.02-3.28-1.853-4.34-3.48C-1.46 16.21-1.78 10.18 1.16 7.13c1.94-2.02 4.99-2.16 6.66-2.16 1.71 0 3.21 1.08 4.32 1.08 1.06 0 3.04-1.34 5.13-1.14.87.04 3.31.35 4.88 2.65-4.34 2.38-3.7 8.83-1.65 9.8z" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-white">
              {isRTL ? 'تقويم Apple / CalDAV' : 'Apple Calendar / CalDAV'}
            </h4>
            {status?.connected ? (
              <p className="text-sm text-palm">
                {isRTL ? 'متصل' : 'Connected'}
                {status.email ? ` • ${status.email}` : ''}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                {isRTL ? 'غير متصل' : 'Not connected'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {status?.connected ? (
            <Button
              onClick={handleDisconnect}
              variant="ghost"
              className="text-red-500 hover:text-red-700"
            >
              {isRTL ? 'قطع الاتصال' : 'Disconnect'}
            </Button>
          ) : (
            <Button onClick={openConnectModal} variant="primary">
              {isRTL ? 'ربط' : 'Connect'}
            </Button>
          )}
        </div>
      </div>

      {status?.connected && status.serverUrl && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono truncate max-w-[80%]">{status.serverUrl}</span>
          {status.connectedAt && (
            <span>
              {isRTL ? 'متصل منذ:' : 'Connected:'}{' '}
              {new Date(status.connectedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {error && !modalOpen && (
        <div className="mt-3 text-xs text-salmon">{error}</div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div
            className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm"
            onClick={() => !submitting && setModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-charcoal">
                {isRTL ? 'ربط Apple / CalDAV' : 'Connect Apple Calendar / CalDAV'}
              </h3>
              <button
                onClick={() => !submitting && setModalOpen(false)}
                className="text-gray-400 hover:text-charcoal p-1 rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="text-xs text-blue-800 bg-blue-50 border border-blue-100 rounded-lg p-3 leading-relaxed">
                {isRTL
                  ? 'لاستخدام تقويم Apple، أنشئ كلمة مرور خاصة بالتطبيق من appleid.apple.com → تسجيل الدخول والأمان → كلمات المرور الخاصة بالتطبيقات.'
                  : 'For Apple Calendar use an app-specific password from appleid.apple.com → Sign-In and Security → App-Specific Passwords.'}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  {isRTL ? 'البريد أو اسم المستخدم' : 'Email or username'}
                </label>
                <input
                  type="text"
                  value={autoDiscoverEmail}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="you@icloud.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  {isRTL
                    ? 'سنحاول اكتشاف عنوان الخادم من المجال.'
                    : "We'll auto-discover the server from the domain when possible."}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  {isRTL ? 'عنوان الخادم' : 'Server URL'}
                </label>
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://caldav.example.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  {isRTL ? 'اسم المستخدم' : 'Username'}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  {isRTL ? 'كلمة المرور الخاصة بالتطبيق' : 'App-specific password'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                />
              </div>

              {error && (
                <div className="text-salmon text-xs font-bold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r">
                  {error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button onClick={handleConnect} loading={submitting}>
                {isRTL ? 'ربط' : 'Connect'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalDavConnect;
