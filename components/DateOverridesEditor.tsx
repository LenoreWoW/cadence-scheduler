import React, { useEffect, useState, useMemo } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

interface DateOverride {
  id: string;
  date: string; // YYYY-MM-DD
  startHour?: number;
  endHour?: number;
  available: boolean;
  note?: string;
}

interface Props {
  lang?: 'en' | 'ar';
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * DateOverridesEditor
 *
 * Calendar grid — clicking a date opens a small modal where the user sets
 * a custom availability for that specific day.
 */
export const DateOverridesEditor: React.FC<Props> = ({ lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [editing, setEditing] = useState<DateOverride | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<DateOverride[]>('/api/date-overrides');
      setOverrides(Array.isArray(data) ? data : []);
    } catch {
      setOverrides([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const overrideMap = useMemo(() => {
    const m = new Map<string, DateOverride>();
    for (const o of overrides) m.set(o.date, o);
    return m;
  }, [overrides]);

  const days = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const pad = first.getDay();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < pad; i++) arr.push(null);
    for (let d = 1; d <= last.getDate(); d++) arr.push(new Date(y, m, d));
    return arr;
  }, [month]);

  const openEditor = (date: Date) => {
    const key = ymd(date);
    const existing = overrideMap.get(key);
    setEditingDate(key);
    setEditing(
      existing || {
        id: '',
        date: key,
        startHour: 9,
        endHour: 17,
        available: true,
        note: '',
      },
    );
  };

  const closeEditor = () => {
    setEditing(null);
    setEditingDate(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    setError(null);
    try {
      if (editing.id) {
        await apiJson(`/api/date-overrides/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editing),
        });
      } else {
        await apiJson('/api/date-overrides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editing),
        });
      }
      closeEditor();
      load();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Save failed');
    }
  };

  const handleClear = async () => {
    if (!editing || !editing.id) {
      closeEditor();
      return;
    }
    try {
      await apiJson(`/api/date-overrides/${editing.id}`, { method: 'DELETE' });
      closeEditor();
      load();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Delete failed');
    }
  };

  const labels = {
    title: lang === 'ar' ? 'تجاوزات يومية' : 'Date overrides',
    subtitle:
      lang === 'ar'
        ? 'انقر على يوم لتعديل توافره بشكل فردي.'
        : 'Click a day to customize availability for that specific date.',
    available: lang === 'ar' ? 'متاح' : 'Available',
    unavailable: lang === 'ar' ? 'غير متاح' : 'Unavailable',
    start: lang === 'ar' ? 'البداية' : 'Start',
    end: lang === 'ar' ? 'النهاية' : 'End',
    note: lang === 'ar' ? 'ملاحظة' : 'Note',
    save: lang === 'ar' ? 'حفظ' : 'Save',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
    clear: lang === 'ar' ? 'مسح' : 'Clear override',
  };

  const monthName = month.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">{labels.title}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{labels.subtitle}</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            aria-label="prev"
          >
            <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="text-sm font-bold text-charcoal">{monthName}</p>
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            aria-label="next"
          >
            <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square" />;
            const key = ymd(d);
            const o = overrideMap.get(key);
            const cls = !o
              ? 'hover:bg-gray-100 text-charcoal'
              : o.available
                ? 'bg-palm/10 text-palm hover:bg-palm/20'
                : 'bg-salmon/10 text-salmon hover:bg-salmon/20';
            return (
              <button
                key={i}
                onClick={() => openEditor(d)}
                className={`aspect-square rounded text-xs font-medium transition-all border border-transparent ${cls}`}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        {loading && <p className="text-[10px] text-gray-400 mt-2">…</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={closeEditor} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-display font-bold text-charcoal mb-1">{editingDate}</h3>
            <p className="text-xs text-gray-500 mb-4">{labels.subtitle}</p>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.available}
                onChange={(e) => setEditing({ ...editing, available: e.target.checked })}
                className="rounded text-[#8A1538] focus:ring-[#8A1538]"
              />
              <span className="text-sm font-bold text-charcoal">
                {editing.available ? labels.available : labels.unavailable}
              </span>
            </label>

            {editing.available && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.start}</label>
                  <select
                    value={editing.startHour ?? 9}
                    onChange={(e) => setEditing({ ...editing, startHour: Number(e.target.value) })}
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
                    value={editing.endHour ?? 17}
                    onChange={(e) => setEditing({ ...editing, endHour: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#8A1538]"
                  >
                    {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                      <option key={h} value={h}>{h}:00</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.note}</label>
              <input
                type="text"
                value={editing.note || ''}
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
              />
            </div>

            {error && (
              <div className="text-salmon text-xs font-bold p-2 bg-salmon/5 border-l-2 border-salmon rounded-r mb-3">
                {error}
              </div>
            )}

            <div className="flex justify-between">
              {editing.id ? (
                <button
                  onClick={handleClear}
                  className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider"
                >
                  {labels.clear}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={closeEditor}>
                  {labels.cancel}
                </Button>
                <Button onClick={handleSave}>{labels.save}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateOverridesEditor;
