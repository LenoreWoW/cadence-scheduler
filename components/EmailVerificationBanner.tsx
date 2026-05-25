/**
 * EmailVerificationBanner
 *
 * Persistent yellow banner shown in the authenticated app shell when the
 * current user's email hasn't been verified.
 *
 * POST /api/auth/send-verification
 */

import React, { useState } from 'react';
import { apiJson } from '../services/api';
import { User, Language } from '../types';

interface Props {
  currentUser: User | null | undefined;
  lang: Language;
}

type EmailVerified = boolean | undefined;

function isVerified(user: User | null | undefined): boolean {
  if (!user) return true; // No user → hide banner
  const v = (user as any).emailVerified as EmailVerified;
  if (v === undefined) return false;
  return !!v;
}

export const EmailVerificationBanner: React.FC<Props> = ({ currentUser, lang }) => {
  const isRTL = lang === 'ar';

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  if (!currentUser || isVerified(currentUser) || !currentUser.email) return null;
  if (dismissedThisSession) return null;

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      await apiJson('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      setSent(true);
    } catch (err: any) {
      setError(
        err?.body?.error ||
          err?.message ||
          (isRTL ? 'فشل إرسال البريد' : 'Failed to send'),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3"
      role="status"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center gap-3 min-w-0">
        <svg
          className="w-5 h-5 text-amber-600 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-sm text-amber-900 truncate">
          {sent
            ? (isRTL ? 'تم الإرسال — تحقق من بريدك الوارد.' : 'Sent — check your inbox.')
            : (isRTL
                ? 'فعّل بريدك الإلكتروني لتمكين كل الميزات.'
                : 'Verify your email to enable all features.')}
        </p>
        {error && <span className="text-xs text-salmon font-bold">{error}</span>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {!sent && (
          <button
            onClick={handleSend}
            disabled={sending}
            className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {sending
              ? (isRTL ? 'جاري الإرسال…' : 'Sending…')
              : (isRTL ? 'إرسال البريد' : 'Send verification email')}
          </button>
        )}
        <button
          onClick={() => setDismissedThisSession(true)}
          className="text-amber-700 hover:text-amber-900 p-1 rounded-full hover:bg-amber-100 transition-colors"
          aria-label={isRTL ? 'إغلاق' : 'Dismiss'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;
