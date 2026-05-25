import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { ConfirmationModal } from './ConfirmationModal';
import { apiJson } from '../services/api';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt?: string;
}

interface TeamInvitationsPanelProps {
  teamId?: string;
  lang?: 'en' | 'ar';
}

/**
 * TeamInvitationsPanel
 *
 * Lists pending team invitations and lets a manager/admin invite new members
 * by email + role. Invitations are POSTed to /api/team-invitations and can be
 * revoked from the list.
 */
export const TeamInvitationsPanel: React.FC<TeamInvitationsPanelProps> = ({ teamId, lang = 'en' }) => {
  const isRTL = lang === 'ar';

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('subordinate');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (teamId) params.set('teamId', teamId);
      const data = await apiJson<Invitation[]>(`/api/team-invitations?${params}`);
      setInvitations(Array.isArray(data) ? data : []);
    } catch {
      /* swallow */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiJson('/api/team-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role, teamId }),
      });
      setEmail('');
      setShowModal(false);
      load();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || (lang === 'ar' ? 'فشل الإرسال' : 'Failed to send'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!pendingRevoke) return;
    try {
      await apiJson(`/api/team-invitations/${pendingRevoke}`, { method: 'DELETE' });
      setInvitations((prev) => prev.filter((i) => i.id !== pendingRevoke));
    } finally {
      setPendingRevoke(null);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'الدعوات المعلقة' : 'Pending invitations',
    invite: lang === 'ar' ? '+ دعوة عضو' : '+ Invite member',
    email: lang === 'ar' ? 'البريد الإلكتروني' : 'Email',
    role: lang === 'ar' ? 'الدور' : 'Role',
    send: lang === 'ar' ? 'إرسال الدعوة' : 'Send invitation',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
    revoke: lang === 'ar' ? 'إلغاء' : 'Revoke',
    none: lang === 'ar' ? 'لا توجد دعوات معلقة' : 'No pending invitations',
    expires: lang === 'ar' ? 'تنتهي' : 'Expires',
    sent: lang === 'ar' ? 'تم الإرسال' : 'Sent',
    confirmRevoke: lang === 'ar' ? 'إلغاء هذه الدعوة؟' : 'Revoke this invitation?',
    confirmRevokeMsg: lang === 'ar' ? 'لن يتمكن المستلم من الانضمام برابط الدعوة.' : 'The recipient will no longer be able to join with this link.',
  };

  const ROLES = ['admin', 'manager', 'subordinate', 'guest'];

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-charcoal">{labels.title}</h3>
        <Button onClick={() => setShowModal(true)}>{labels.invite}</Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : invitations.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-8">{labels.none}</p>
      ) : (
        <div className="space-y-2">
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="flex justify-between items-center p-4 bg-gray-50 border border-gray-100 rounded-lg"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-charcoal truncate">{inv.email}</p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                  {inv.role} · {labels.sent} {new Date(inv.createdAt).toLocaleDateString()}
                  {inv.expiresAt && ` · ${labels.expires} ${new Date(inv.expiresAt).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                    inv.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : inv.status === 'accepted'
                      ? 'bg-palm/10 text-palm'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {inv.status}
                </span>
                {inv.status === 'pending' && (
                  <button
                    onClick={() => setPendingRevoke(inv.id)}
                    className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider"
                  >
                    {labels.revoke}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h3 className="text-xl font-display font-bold text-charcoal mb-6">{labels.invite}</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  {labels.email}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  {labels.role}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              {error && (
                <div className="text-salmon text-xs font-bold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>
                  {labels.cancel}
                </Button>
                <Button type="submit" loading={submitting}>
                  {labels.send}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!pendingRevoke}
        onClose={() => setPendingRevoke(null)}
        onConfirm={handleRevoke}
        title={labels.confirmRevoke}
        message={labels.confirmRevokeMsg}
        confirmLabel={labels.revoke}
        cancelLabel={labels.cancel}
        isRTL={isRTL}
      />
    </div>
  );
};

export default TeamInvitationsPanel;
