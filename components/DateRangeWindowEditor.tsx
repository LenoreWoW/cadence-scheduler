/**
 * DateRangeWindowEditor
 *
 * Lets the user set an explicit "live from" start date next to the existing
 * bookable_window_days control. Useful for time-boxed campaigns
 * (e.g. "live Dec 1 → Jan 15").
 *
 * PUT /api/booking-links/:id   { bookableStartDate }
 */

import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

interface BookingLinkLike {
  id: string;
  bookableStartDate?: string | null;
  bookable_start_date?: string | null;
  bookableWindowDays?: number | null;
  bookable_window_days?: number | null;
}

interface Props {
  link: BookingLinkLike;
  onChange?: () => void;
  lang?: 'en' | 'ar';
}

export const DateRangeWindowEditor: React.FC<Props> = ({ link, onChange, lang = 'en' }) => {
  const isRTL = lang === 'ar';

  const initialDate =
    link.bookableStartDate || link.bookable_start_date || '';
  const initialWindow =
    link.bookableWindowDays ?? link.bookable_window_days ?? 60;

  const [startDate, setStartDate] = useState<string>(initialDate || '');
  const [windowDays, setWindowDays] = useState<number>(initialWindow);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  );

  useEffect(() => {
    setStartDate(link.bookableStartDate || link.bookable_start_date || '');
    setWindowDays(link.bookableWindowDays ?? link.bookable_window_days ?? 60);
  }, [link.id, link.bookableStartDate, link.bookable_start_date, link.bookableWindowDays, link.bookable_window_days]);

  const handleSave = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      await apiJson(`/api/booking-links/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookableStartDate: startDate || null,
          bookableWindowDays: windowDays,
        }),
      });
      setMessage({ kind: 'success', text: isRTL ? 'تم الحفظ' : 'Saved' });
      onChange?.();
    } catch (err: any) {
      setMessage({
        kind: 'error',
        text:
          err?.body?.error ||
          err?.message ||
          (isRTL ? 'فشل الحفظ' : 'Failed to save'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Compute end date label for the preview row.
  const endLabel = (() => {
    if (!startDate) return null;
    try {
      const d = new Date(startDate);
      d.setDate(d.getDate() + windowDays);
      return d.toISOString().slice(0, 10);
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">
          {isRTL ? 'نافذة الحجز' : 'Booking window'}
        </h4>
        <p className="text-xs text-gray-500 mt-1">
          {isRTL
            ? 'متى يبدأ الرابط في قبول الحجوزات، ولكم يومًا.'
            : 'When the link starts accepting bookings, and for how many days.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
            {isRTL ? 'تاريخ البدء' : 'Start date'}
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
            {isRTL ? 'النافذة (أيام)' : 'Window (days)'}
          </label>
          <input
            type="number"
            min={1}
            max={365}
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value) || 1)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
          />
        </div>
      </div>

      {endLabel && (
        <p className="text-xs text-gray-500">
          {isRTL ? 'مفعّل من' : 'Live from'}{' '}
          <span className="font-mono text-charcoal">{startDate}</span>{' '}
          {isRTL ? 'إلى' : 'to'}{' '}
          <span className="font-mono text-charcoal">{endLabel}</span>.
        </p>
      )}

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
          {isRTL ? 'حفظ النافذة' : 'Save window'}
        </Button>
      </div>
    </div>
  );
};

export default DateRangeWindowEditor;
