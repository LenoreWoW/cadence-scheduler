import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiJson, setTokens } from '../services/api';

interface InvitationPayload {
  email: string;
  role?: string;
  teamId?: string | null;
  teamName?: string | null;
  inviterName?: string | null;
  expiresAt?: string;
}

interface AcceptResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * AcceptInvitePage
 *
 * Lands at /accept-invite?token=... Reads the invitation token, fetches its
 * public details, and lets the new user pick a name/username/password to
 * create their account. On success it logs them in and redirects to /.
 */
export const AcceptInvitePage: React.FC = () => {
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const isRTL = lang === 'ar';

  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationPayload | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    setToken(t);

    if (!t) {
      setFetchError(lang === 'ar' ? 'رابط الدعوة غير صالح.' : 'Invalid invitation link.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await apiJson<InvitationPayload>(`/api/team-invitations/public/${t}`);
        setInvitation(data);
      } catch (err: any) {
        const msg =
          err?.body?.error ||
          err?.message ||
          (lang === 'ar' ? 'تعذّر التحقق من الدعوة.' : 'Could not verify invitation.');
        setFetchError(msg);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await apiJson<AcceptResponse>(`/api/team-invitations/public/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), username: username.trim(), password }),
      });
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      window.location.href = '/';
    } catch (err: any) {
      const msg =
        err?.body?.error ||
        err?.message ||
        (lang === 'ar' ? 'فشل قبول الدعوة.' : 'Failed to accept invitation.');
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'انضم إلى فريقك' : 'Join your team',
    subtitle: lang === 'ar' ? 'أكمل التسجيل لقبول دعوتك.' : 'Complete sign-up to accept your invitation.',
    name: lang === 'ar' ? 'الاسم الكامل' : 'Full name',
    username: lang === 'ar' ? 'اسم المستخدم' : 'Username',
    password: lang === 'ar' ? 'كلمة المرور' : 'Password',
    cta: lang === 'ar' ? 'إنشاء الحساب' : 'Create account',
    loading: lang === 'ar' ? 'جارٍ التحقق من الدعوة...' : 'Verifying invitation...',
    invitedTo: lang === 'ar' ? 'تمت دعوتك إلى' : 'You were invited to',
    invitedBy: lang === 'ar' ? 'بواسطة' : 'by',
    invalid: lang === 'ar' ? 'الرابط غير صالح أو منتهٍ' : 'This invitation link is invalid or has expired.',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#8A1538] rounded-full flex items-center justify-center text-white font-serif font-bold italic shadow-lg shadow-[#8A1538]/20">
              R
            </div>
            <span className="font-display font-bold tracking-tight text-lg">REGENT</span>
          </div>
          <button
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="text-xs font-bold border border-gray-200 px-4 py-2 rounded-full text-gray-600 hover:bg-[#8A1538] hover:text-white hover:border-[#8A1538] transition-colors uppercase tracking-wider"
          >
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 mx-auto border-2 border-[#8A1538] border-t-transparent rounded-full animate-spin" />
              <p className="mt-4 text-sm text-gray-500">{labels.loading}</p>
            </div>
          ) : fetchError ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-salmon/10 text-salmon flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-charcoal mb-2">{labels.invalid}</h2>
              <p className="text-sm text-gray-500">{fetchError}</p>
              <a href="/" className="inline-block mt-6 text-xs font-bold text-[#8A1538] hover:text-[#5f0e26] uppercase tracking-wider">
                {lang === 'ar' ? 'العودة' : 'Back to app'}
              </a>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-display font-semibold text-charcoal mb-2">{labels.title}</h1>
                {invitation && (
                  <p className="text-sm text-gray-500">
                    {labels.invitedTo}{' '}
                    <span className="font-bold text-charcoal">{invitation.teamName || (lang === 'ar' ? 'الفريق' : 'the team')}</span>
                    {invitation.inviterName && (
                      <>
                        {' '}
                        {labels.invitedBy} <span className="font-bold text-charcoal">{invitation.inviterName}</span>
                      </>
                    )}
                    .
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">{labels.subtitle}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {invitation?.email && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500 font-mono">
                    {invitation.email}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.name}</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.username}</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.password}</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
                  />
                </div>

                {submitError && (
                  <div className="text-salmon text-xs font-bold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r">
                    {submitError}
                  </div>
                )}

                <Button type="submit" fullWidth loading={submitting}>
                  {labels.cta}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AcceptInvitePage;
