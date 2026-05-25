import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Server always responds 200 to prevent email enumeration.
      await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Forgot your password?</h1>
        <p className="text-slate-500 mb-6">Enter your email and we'll send you a link to choose a new one.</p>

        {submitted ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-800 text-sm">
              If that email is registered, a reset link is on the way. The link is valid for 1 hour.
            </div>
            <a
              href="/login"
              className="block text-center w-full px-5 py-3 bg-[#8A1538] hover:bg-[#a02050] text-white rounded-lg font-medium"
            >
              Back to sign in
            </a>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#8A1538]"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !email}
              className="w-full px-5 py-3 bg-[#8A1538] hover:bg-[#a02050] text-white rounded-lg font-medium disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
            <div className="text-center">
              <a href="/login" className="text-sm text-slate-500 hover:text-slate-700">
                ← Back to sign in
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
