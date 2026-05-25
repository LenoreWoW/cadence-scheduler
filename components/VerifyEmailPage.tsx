/**
 * VerifyEmailPage
 *
 * Mounted at /verify-email?token=...
 *
 * GET /api/auth/verify-email/:token
 */

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { Button } from './Button';

interface Props {
  token: string;
}

type Status = 'verifying' | 'success' | 'error';

export const VerifyEmailPage: React.FC<Props> = ({ token }) => {
  const [status, setStatus] = useState<Status>('verifying');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Missing token.');
      return;
    }
    (async () => {
      try {
        const res = await apiFetch(`/api/auth/verify-email/${encodeURIComponent(token)}`);
        if (res.ok) {
          setStatus('success');
          return;
        }
        let body: any = null;
        try {
          body = await res.json();
        } catch {
          /* ignore */
        }
        setError(body?.error || `Verification failed (${res.status}).`);
        setStatus('error');
      } catch (err: any) {
        setError(err?.message || 'Verification failed.');
        setStatus('error');
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#8A1538]/10 flex items-center justify-center mx-auto mb-6">
              <div className="w-8 h-8 border-2 border-[#8A1538] border-t-transparent rounded-full animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Verifying…</h1>
            <p className="text-slate-600">Hang tight, we're checking your link.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6 text-white shadow-lg shadow-emerald-500/30">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Verified!</h1>
            <p className="text-slate-600 mb-6">You can close this tab.</p>
            <Button variant="primary" onClick={() => (window.location.href = '/')}>
              Go to Cadence
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Verification failed</h1>
            <p className="text-slate-600 mb-6">
              {error || 'This link is invalid or expired. Please request a new one.'}
            </p>
            <Button variant="primary" onClick={() => (window.location.href = '/')}>
              Back to Cadence
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
