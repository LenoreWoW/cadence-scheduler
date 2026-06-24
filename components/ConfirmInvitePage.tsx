import React, { useState } from 'react';
import { confirmByToken } from '../services/delegationApi';

export const ConfirmInvitePage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id') || '';
  const token = params.get('token') || '';
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const onConfirm = async () => {
    try { const r = await confirmByToken(id, token); setMsg(r.message); setState('done'); }
    catch (e: any) { setMsg(e?.body?.error || e?.message || 'Failed'); setState('error'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-serif font-bold text-charcoal mb-4">Confirm your meeting</h1>
        {state === 'done' ? (
          <p className="text-palm font-medium">Your meeting is confirmed.</p>
        ) : state === 'error' ? (
          <p className="text-salmon">{msg}</p>
        ) : (
          <button onClick={onConfirm} disabled={!id || !token}
            className="px-6 py-3 bg-al-adaam text-white font-bold rounded-lg disabled:opacity-50">
            Confirm
          </button>
        )}
      </div>
    </div>
  );
};
