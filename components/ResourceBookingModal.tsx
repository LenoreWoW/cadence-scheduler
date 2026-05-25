import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

interface Resource {
  id: string;
  name: string;
  type: string;
  capacity?: number | null;
  location?: string | null;
}

interface ResourceBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBooked?: (resourceId: string) => void;
  meetingId?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  lang?: 'en' | 'ar';
}

/**
 * ResourceBookingModal
 *
 * Picker for a room/equipment to attach to a meeting. Calls the resource
 * availability check endpoint up front to indicate conflicts, then POSTs
 * a booking to /api/resources/:id/bookings.
 */
export const ResourceBookingModal: React.FC<ResourceBookingModalProps> = ({
  isOpen,
  onClose,
  onBooked,
  meetingId,
  date,
  startTime,
  endTime,
  lang = 'en',
}) => {
  const isRTL = lang === 'ar';
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await apiJson<Resource[]>('/api/resources');
        if (cancelled) return;
        setResources(Array.isArray(list) ? list : []);
        // Check conflicts for each resource in parallel
        const checks = await Promise.all(
          (list || []).map(async (r) => {
            try {
              const params = new URLSearchParams({ date, startTime, endTime });
              const res = await apiJson<{ available: boolean }>(`/api/resources/${r.id}/availability?${params}`);
              return [r.id, !res.available] as const;
            } catch {
              return [r.id, false] as const;
            }
          }),
        );
        if (cancelled) return;
        const map: Record<string, boolean> = {};
        for (const [id, conflict] of checks) map[id] = conflict;
        setConflicts(map);
      } catch {
        if (!cancelled) setResources([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, date, startTime, endTime]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiJson(`/api/resources/${selected}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId, date, startTime, endTime }),
      });
      onBooked?.(selected);
      onClose();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || (lang === 'ar' ? 'فشل الحجز' : 'Booking failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'حجز مورد' : 'Book a resource',
    subtitle: `${date} · ${startTime} – ${endTime}`,
    available: lang === 'ar' ? 'متاح' : 'Available',
    conflict: lang === 'ar' ? 'متعارض' : 'Conflict',
    book: lang === 'ar' ? 'حجز' : 'Book',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
    none: lang === 'ar' ? 'لا توجد موارد متاحة.' : 'No resources available.',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
        <h3 className="text-xl font-display font-bold text-charcoal mb-1">{labels.title}</h3>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-6">{labels.subtitle}</p>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-8">{labels.none}</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {resources.map((r) => {
              const conflict = conflicts[r.id];
              return (
                <button
                  key={r.id}
                  disabled={conflict}
                  onClick={() => setSelected(r.id)}
                  className={`w-full text-left rtl:text-right flex items-center justify-between p-3 rounded-lg border transition-all ${
                    conflict
                      ? 'border-salmon/30 bg-salmon/5 opacity-60 cursor-not-allowed'
                      : selected === r.id
                      ? 'border-[#8A1538] bg-[#8A1538]/5 ring-1 ring-[#8A1538]'
                      : 'border-gray-100 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold text-charcoal">{r.name}</p>
                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                      {r.type}
                      {r.location && ` · ${r.location}`}
                      {r.capacity ? ` · ${r.capacity}` : ''}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                      conflict ? 'bg-salmon/10 text-salmon' : 'bg-palm/10 text-palm'
                    }`}
                  >
                    {conflict ? labels.conflict : labels.available}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mt-4 text-salmon text-xs font-bold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {labels.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={!selected || (selected ? conflicts[selected] : false)} loading={submitting}>
            {labels.book}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResourceBookingModal;
