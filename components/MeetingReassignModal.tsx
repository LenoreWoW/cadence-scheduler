/**
 * MeetingReassignModal
 *
 * Reassigns a meeting to another team member with an optional reason.
 *
 * Endpoints:
 *   GET  /api/users?role=manager,subordinate,admin   (or fallback list endpoint)
 *   POST /api/meetings/:id/reassign                  { newHostId, reason? }
 */

import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiFetch, apiJson } from '../services/api';
import { Language } from '../types';

interface AssignableUser {
  id: string;
  name: string;
  title?: string | null;
  email?: string | null;
  role?: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  currentHostId?: string | null;
  onReassigned: () => void;
  lang: Language;
}

export const MeetingReassignModal: React.FC<Props> = ({
  isOpen,
  onClose,
  meetingId,
  currentHostId,
  onReassigned,
  lang,
}) => {
  const isRTL = lang === 'ar';

  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [newHostId, setNewHostId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setReason('');
    setNewHostId('');
    setUsersLoading(true);

    (async () => {
      // Try a few likely endpoints in order; tolerate 404s.
      const candidates = ['/api/users/assignable', '/api/users', '/api/team/members'];
      let list: AssignableUser[] = [];
      for (const url of candidates) {
        try {
          const res = await apiFetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          if (Array.isArray(data)) {
            list = data;
            break;
          }
          if (Array.isArray(data.users)) {
            list = data.users;
            break;
          }
          if (Array.isArray(data.members)) {
            list = data.members;
            break;
          }
        } catch {
          /* try next */
        }
      }
      // Filter out current host.
      setUsers(list.filter((u) => u.id !== currentHostId));
      setUsersLoading(false);
    })();
  }, [isOpen, currentHostId]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!newHostId) {
      setError(isRTL ? 'اختر مستخدماً' : 'Select a team member');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiJson(`/api/meetings/${meetingId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newHostId,
          reason: reason.trim() || null,
        }),
      });
      onReassigned();
      onClose();
    } catch (err: any) {
      setError(
        err?.body?.error ||
          err?.message ||
          (isRTL ? 'فشل إعادة التعيين' : 'Failed to reassign meeting'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div
          className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm"
          onClick={() => !submitting && onClose()}
        />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-charcoal">
              {isRTL ? 'إعادة تعيين الاجتماع' : 'Reassign meeting'}
            </h3>
            <button
              onClick={() => !submitting && onClose()}
              className="text-gray-400 hover:text-charcoal p-1 rounded-full hover:bg-gray-100"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                {isRTL ? 'تعيين إلى' : 'Assign to'}
              </label>
              {usersLoading ? (
                <div className="animate-pulse h-10 bg-gray-100 rounded-lg" />
              ) : users.length === 0 ? (
                <div className="text-sm text-gray-500 italic">
                  {isRTL ? 'لا يوجد أعضاء آخرون' : 'No other team members available.'}
                </div>
              ) : (
                <select
                  value={newHostId}
                  onChange={(e) => setNewHostId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                >
                  <option value="">{isRTL ? '— اختر —' : '— Select —'}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.title ? ` — ${u.title}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                {isRTL ? 'السبب (اختياري)' : 'Reason (optional)'}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder={isRTL ? 'سيظهر السبب في سجل الاجتماع.' : 'Shown in the meeting audit log.'}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538] resize-none"
              />
            </div>

            {error && (
              <div className="text-salmon text-xs font-bold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r">
                {error}
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSubmit} loading={submitting} disabled={!newHostId}>
              {isRTL ? 'إعادة تعيين' : 'Reassign'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingReassignModal;
