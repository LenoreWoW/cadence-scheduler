/**
 * UserBookingCapsEditor
 *
 * Per-user booking caps (weekly / monthly / yearly). Empty or 0 means no cap.
 *
 * Endpoints:
 *   GET /api/users/me/booking-caps
 *   PUT /api/users/me/booking-caps   { weeklyCap, monthlyCap, yearlyCap }
 */

import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiFetch, apiJson } from '../services/api';
import { Language } from '../types';

interface Caps {
  weeklyCap: number | null;
  monthlyCap: number | null;
  yearlyCap: number | null;
}

interface Props {
  lang: Language;
}

export const UserBookingCapsEditor: React.FC<Props> = ({ lang }) => {
  const isRTL = lang === 'ar';

  const [weekly, setWeekly] = useState<string>('');
  const [monthly, setMonthly] = useState<string>('');
  const [yearly, setYearly] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/users/me/booking-caps');
        if (res.status === 404) {
          setUnavailable(true);
          return;
        }
        if (!res.ok) return;
        const data: Caps = await res.json();
        setWeekly(data.weeklyCap?.toString() ?? '');
        setMonthly(data.monthlyCap?.toString() ?? '');
        setYearly(data.yearlyCap?.toString() ?? '');
      } catch {
        /* swallow */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const parseCap = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  };

  const handleSave = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      await apiJson('/api/users/me/booking-caps', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weeklyCap: parseCap(weekly),
          monthlyCap: parseCap(monthly),
          yearlyCap: parseCap(yearly),
        }),
      });
      setMessage({
        kind: 'success',
        text: isRTL ? 'تم الحفظ' : 'Saved',
      });
    } catch (err: any) {
      setMessage({
        kind: 'error',
        text: err?.body?.error || err?.message || (isRTL ? 'فشل الحفظ' : 'Failed to save'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-24 bg-gray-100 rounded-xl" />;
  }

  if (unavailable) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500">
        {isRTL ? 'حدود الحجز غير متاحة بعد.' : 'Booking caps coming soon.'}
      </div>
    );
  }

  return (
    <div className="pt-6 border-t border-gray-100 space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">
          {isRTL ? 'حدود الحجز' : 'Booking caps'}
        </h4>
        <p className="text-xs text-gray-500 mt-1">
          {isRTL
            ? 'حدد الحد الأقصى لعدد الاجتماعات. اترك فارغاً (أو 0) لعدم وجود حد.'
            : 'Cap how many meetings can be booked with you. Leave blank or 0 for no cap.'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">
            {isRTL ? 'أسبوعي' : 'Weekly'}
          </label>
          <input
            type="number"
            min={0}
            value={weekly}
            onChange={(e) => setWeekly(e.target.value)}
            placeholder="—"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">
            {isRTL ? 'شهري' : 'Monthly'}
          </label>
          <input
            type="number"
            min={0}
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            placeholder="—"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">
            {isRTL ? 'سنوي' : 'Yearly'}
          </label>
          <input
            type="number"
            min={0}
            value={yearly}
            onChange={(e) => setYearly(e.target.value)}
            placeholder="—"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        {message && (
          <span
            className={`text-xs font-bold ${
              message.kind === 'success' ? 'text-palm' : 'text-salmon'
            }`}
          >
            {message.text}
          </span>
        )}
        <Button onClick={handleSave} loading={submitting} variant="secondary" className="ml-auto">
          {isRTL ? 'حفظ الحدود' : 'Save caps'}
        </Button>
      </div>
    </div>
  );
};

export default UserBookingCapsEditor;
