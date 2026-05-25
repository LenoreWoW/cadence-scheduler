import React, { useEffect, useState, useMemo } from 'react';
import { Button } from './Button';
import { ConfirmationModal } from './ConfirmationModal';
import { apiJson } from '../services/api';

interface TravelSchedule {
  id: string;
  startDate: string;
  endDate: string;
  timezone: string;
}

interface Props {
  lang?: 'en' | 'ar';
}

const COMMON_TZS = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Athens',
  'Africa/Cairo',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function getTimezones(): string[] {
  try {
    const intl: any = Intl as any;
    if (typeof intl.supportedValuesOf === 'function') {
      const list = intl.supportedValuesOf('timeZone');
      if (Array.isArray(list) && list.length > 0) return list as string[];
    }
  } catch {
    /* fallthrough */
  }
  return COMMON_TZS;
}

/**
 * TravelSchedulesEditor
 *
 * Add ranges where the user will be in a different timezone — the system
 * uses these to display times correctly to attendees.
 */
export const TravelSchedulesEditor: React.FC<Props> = ({ lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [items, setItems] = useState<TravelSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [tz, setTz] = useState<string>(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tzOptions = useMemo(() => getTimezones(), []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<TravelSchedule[]>('/api/travel-schedules');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!start || !end || !tz) return;
    setSubmitting(true);
    try {
      await apiJson('/api/travel-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: start, endDate: end, timezone: tz }),
      });
      setStart('');
      setEnd('');
      load();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Add failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await apiJson(`/api/travel-schedules/${pendingDelete}`, { method: 'DELETE' });
      setItems((xs) => xs.filter((x) => x.id !== pendingDelete));
    } finally {
      setPendingDelete(null);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'جداول السفر' : 'Travel schedules',
    subtitle:
      lang === 'ar'
        ? 'حدد مناطق زمنية مختلفة أثناء السفر.'
        : 'Set a different timezone for travel periods.',
    start: lang === 'ar' ? 'البداية' : 'Start',
    end: lang === 'ar' ? 'النهاية' : 'End',
    tz: lang === 'ar' ? 'المنطقة الزمنية' : 'Timezone',
    add: lang === 'ar' ? 'إضافة' : 'Add',
    delete: lang === 'ar' ? 'حذف' : 'Delete',
    none: lang === 'ar' ? 'لا توجد جداول سفر.' : 'No travel schedules.',
    confirmDelete: lang === 'ar' ? 'حذف هذا الجدول؟' : 'Delete this travel schedule?',
    confirmDeleteMsg: lang === 'ar' ? 'لن يتم تطبيقه بعد ذلك.' : 'It will no longer apply.',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
  };

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">{labels.title}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{labels.subtitle}</p>
      </div>

      <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
        <div className="md:col-span-3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.start}</label>
          <input
            type="date"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#8A1538]"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.end}</label>
          <input
            type="date"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#8A1538]"
          />
        </div>
        <div className="md:col-span-4">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.tz}</label>
          <select
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#8A1538]"
          >
            {tzOptions.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <Button type="submit" loading={submitting} fullWidth>
            {labels.add}
          </Button>
        </div>
      </form>

      {error && (
        <div className="text-salmon text-xs font-bold p-2 bg-salmon/5 border-l-2 border-salmon rounded-r">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-16 bg-gray-50 rounded-lg animate-pulse" />
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 italic">{labels.none}</p>
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <div
              key={t.id}
              className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg shadow-sm"
            >
              <div>
                <p className="text-sm font-mono text-charcoal">
                  {t.startDate} → {t.endDate}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">{t.timezone}</p>
              </div>
              <button
                onClick={() => setPendingDelete(t.id)}
                className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider"
              >
                {labels.delete}
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={labels.confirmDelete}
        message={labels.confirmDeleteMsg}
        confirmLabel={labels.delete}
        cancelLabel={labels.cancel}
        isRTL={isRTL}
      />
    </div>
  );
};

export default TravelSchedulesEditor;
