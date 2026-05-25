import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

type Period = 'day' | 'week' | 'month';

interface BookingLink {
  id: string;
  maxPerAttendeeCount?: number | null;
  maxPerAttendeePeriod?: Period | null;
  maxTotalMinutes?: number | null;
  totalMinutesPeriod?: Period | null;
}

interface Props {
  link: BookingLink;
  onChange?: () => void;
  lang?: 'en' | 'ar';
}

/**
 * FrequencyLimitsEditor
 *
 * Per-link booking-frequency caps: max bookings per attendee per period,
 * plus a total-duration cap per period.
 */
export const FrequencyLimitsEditor: React.FC<Props> = ({ link, onChange, lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [perAttendeeCount, setPerAttendeeCount] = useState<number>(
    link.maxPerAttendeeCount ?? 0,
  );
  const [perAttendeePeriod, setPerAttendeePeriod] = useState<Period>(
    link.maxPerAttendeePeriod || 'week',
  );
  const [maxTotalMinutes, setMaxTotalMinutes] = useState<number>(link.maxTotalMinutes ?? 0);
  const [totalMinutesPeriod, setTotalMinutesPeriod] = useState<Period>(
    link.totalMinutesPeriod || 'week',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPerAttendeeCount(link.maxPerAttendeeCount ?? 0);
    setPerAttendeePeriod(link.maxPerAttendeePeriod || 'week');
    setMaxTotalMinutes(link.maxTotalMinutes ?? 0);
    setTotalMinutesPeriod(link.totalMinutesPeriod || 'week');
  }, [link]);

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiJson(`/api/booking-links/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxPerAttendeeCount: perAttendeeCount > 0 ? perAttendeeCount : null,
          maxPerAttendeePeriod: perAttendeeCount > 0 ? perAttendeePeriod : null,
          maxTotalMinutes: maxTotalMinutes > 0 ? maxTotalMinutes : null,
          totalMinutesPeriod: maxTotalMinutes > 0 ? totalMinutesPeriod : null,
        }),
      });
      onChange?.();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'حدود الحجز' : 'Frequency limits',
    subtitle:
      lang === 'ar'
        ? 'حدد عدد الحجوزات والمدة الإجمالية المسموح بها.'
        : 'Cap how many bookings and total minutes are allowed.',
    perAttendee: lang === 'ar' ? 'الحد لكل ضيف' : 'Per-attendee cap',
    perAttendeeHint:
      lang === 'ar'
        ? 'الحد الأقصى لعدد الحجوزات لكل ضيف لكل فترة (0 = بدون حد).'
        : 'Max bookings per attendee per period (0 = no limit).',
    totalCap: lang === 'ar' ? 'إجمالي الدقائق' : 'Total minutes cap',
    totalCapHint:
      lang === 'ar'
        ? 'إجمالي الدقائق المسموح بها لكل فترة (0 = بدون حد).'
        : 'Total minutes allowed per period (0 = no limit).',
    day: lang === 'ar' ? 'يومياً' : 'per day',
    week: lang === 'ar' ? 'أسبوعياً' : 'per week',
    month: lang === 'ar' ? 'شهرياً' : 'per month',
    save: lang === 'ar' ? 'حفظ' : 'Save',
  };

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">{labels.title}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{labels.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
          <p className="text-xs font-bold text-charcoal mb-2">{labels.perAttendee}</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              value={perAttendeeCount}
              onChange={(e) => setPerAttendeeCount(Math.max(0, Number(e.target.value) || 0))}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#8A1538]"
            />
            <select
              value={perAttendeePeriod}
              onChange={(e) => setPerAttendeePeriod(e.target.value as Period)}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#8A1538]"
            >
              <option value="day">{labels.day}</option>
              <option value="week">{labels.week}</option>
              <option value="month">{labels.month}</option>
            </select>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">{labels.perAttendeeHint}</p>
        </div>

        <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
          <p className="text-xs font-bold text-charcoal mb-2">{labels.totalCap}</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              value={maxTotalMinutes}
              onChange={(e) => setMaxTotalMinutes(Math.max(0, Number(e.target.value) || 0))}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#8A1538]"
            />
            <select
              value={totalMinutesPeriod}
              onChange={(e) => setTotalMinutesPeriod(e.target.value as Period)}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#8A1538]"
            >
              <option value="day">{labels.day}</option>
              <option value="week">{labels.week}</option>
              <option value="month">{labels.month}</option>
            </select>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">{labels.totalCapHint}</p>
        </div>
      </div>

      {error && (
        <div className="text-salmon text-xs font-bold p-2 bg-salmon/5 border-l-2 border-salmon rounded-r">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="secondary" onClick={handleSave} loading={submitting}>
          {labels.save}
        </Button>
      </div>
    </div>
  );
};

export default FrequencyLimitsEditor;
