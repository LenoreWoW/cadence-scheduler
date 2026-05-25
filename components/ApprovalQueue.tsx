import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

interface PendingMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  attendeeName: string;
  attendeeEmail?: string;
  notes?: string;
  requesterName?: string;
}

interface ApprovalQueueProps {
  lang?: 'en' | 'ar';
}

/**
 * ApprovalQueue
 *
 * Manager view: lists meetings where approval_required is set and the current
 * user is the approver. Provides approve/reject actions.
 */
export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({ lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [items, setItems] = useState<PendingMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<PendingMeeting[]>('/api/meetings/pending-approval');
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setBusyId(id);
    try {
      await apiJson(`/api/meetings/${id}/${decision}`, { method: 'POST' });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      /* swallow — could surface a toast */
    } finally {
      setBusyId(null);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'قائمة الموافقات' : 'Approval queue',
    subtitle: lang === 'ar' ? 'اجتماعات بانتظار موافقتك' : 'Meetings waiting for your decision',
    none: lang === 'ar' ? 'لا توجد طلبات معلقة.' : 'Nothing waiting for approval.',
    approve: lang === 'ar' ? 'موافقة' : 'Approve',
    reject: lang === 'ar' ? 'رفض' : 'Reject',
    from: lang === 'ar' ? 'من' : 'From',
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-5">
        <h3 className="text-lg font-bold text-charcoal">{labels.title}</h3>
        <p className="text-xs text-gray-500">{labels.subtitle}</p>
      </div>

      {error && <div className="bg-salmon/5 border border-salmon/20 text-salmon text-sm rounded-lg p-4 mb-4">{error}</div>}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-palm/10 flex items-center justify-center text-palm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 italic">{labels.none}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <div key={m.id} className="p-4 bg-gradient-to-r from-white to-gray-50 border border-gray-100 rounded-xl">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-charcoal truncate">{m.title}</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {m.date} · {m.time} ({m.durationMinutes} min)
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {labels.from} <span className="font-bold text-charcoal">{m.attendeeName}</span>
                    {m.requesterName && m.requesterName !== m.attendeeName && ` · ${m.requesterName}`}
                  </p>
                  {m.notes && <p className="text-xs text-gray-500 mt-2 italic line-clamp-2">{m.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="success"
                  onClick={() => decide(m.id, 'approve')}
                  loading={busyId === m.id}
                  className="!py-2 !px-4 !text-xs"
                >
                  {labels.approve}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => decide(m.id, 'reject')}
                  loading={busyId === m.id}
                  className="!py-2 !px-4 !text-xs"
                >
                  {labels.reject}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApprovalQueue;
