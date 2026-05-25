import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

interface RestrictionSchedule {
  id?: string;
  linkId: string;
  daysOfWeek: number[];
  startHour: number;
  endHour: number;
}

interface Props {
  linkId: string;
  lang?: 'en' | 'ar';
}

const DAYS = [
  { id: 0, en: 'Sun', ar: 'أحد' },
  { id: 1, en: 'Mon', ar: 'إثن' },
  { id: 2, en: 'Tue', ar: 'ثلا' },
  { id: 3, en: 'Wed', ar: 'أرب' },
  { id: 4, en: 'Thu', ar: 'خمي' },
  { id: 5, en: 'Fri', ar: 'جمع' },
  { id: 6, en: 'Sat', ar: 'سبت' },
];

/**
 * RestrictionScheduleEditor
 *
 * Optional schedule that further restricts when this booking link can be
 * booked, on top of the host's regular availability.
 */
export const RestrictionScheduleEditor: React.FC<Props> = ({ linkId, lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<RestrictionSchedule | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<RestrictionSchedule | null>(
          `/api/restriction-schedules/links/${linkId}`,
        );
        if (cancelled) return;
        if (data && (data as any).id) {
          setExisting(data);
          setEnabled(true);
          setDays(data.daysOfWeek || []);
          setStartHour(data.startHour ?? 9);
          setEndHour(data.endHour ?? 17);
        } else {
          setEnabled(false);
        }
      } catch {
        /* swallow */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkId]);

  const toggleDay = (d: number) => {
    setDays((xs) =>
      xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d].sort((a, b) => a - b),
    );
  };

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (!enabled) {
        if (existing?.id) {
          await apiJson(`/api/restriction-schedules/links/${linkId}`, { method: 'DELETE' });
          setExisting(null);
        }
      } else {
        const saved = await apiJson<RestrictionSchedule>(
          `/api/restriction-schedules/links/${linkId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ daysOfWeek: days, startHour, endHour }),
          },
        );
        setExisting(saved);
      }
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'جدول التقييد' : 'Restriction schedule',
    subtitle:
      lang === 'ar'
        ? 'قيد هذا الرابط إلى أيام/ساعات محددة.'
        : 'Restrict this link to specific days and hours.',
    enable: lang === 'ar' ? 'تفعيل' : 'Enable',
    days: lang === 'ar' ? 'الأيام' : 'Days',
    start: lang === 'ar' ? 'البداية' : 'Start',
    end: lang === 'ar' ? 'النهاية' : 'End',
    save: lang === 'ar' ? 'حفظ' : 'Save',
  };

  if (!loaded) {
    return <div className="h-16 bg-gray-50 rounded-lg animate-pulse" />;
  }

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">{labels.title}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{labels.subtitle}</p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded text-[#8A1538] focus:ring-[#8A1538]"
        />
        <span className="text-sm font-bold text-charcoal">{labels.enable}</span>
      </label>

      {enabled && (
        <div className="space-y-3 pl-6 rtl:pr-6 rtl:pl-0 border-l-2 border-[#8A1538]/20 rtl:border-r-2 rtl:border-l-0">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.days}</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDay(d.id)}
                  className={`w-10 h-10 rounded-lg text-xs font-bold border transition-all ${
                    days.includes(d.id)
                      ? 'bg-[#8A1538] text-white border-[#8A1538]'
                      : 'bg-white text-gray-400 border-gray-200'
                  }`}
                >
                  {lang === 'ar' ? d.ar : d.en}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.start}</label>
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#8A1538]"
              >
                {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                  <option key={h} value={h}>{h}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.end}</label>
              <select
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#8A1538]"
              >
                {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                  <option key={h} value={h}>{h}:00</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

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

export default RestrictionScheduleEditor;
