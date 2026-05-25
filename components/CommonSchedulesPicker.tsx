import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

interface CommonSchedule {
  id: string;
  name: string;
  days?: number[];
  startHour?: number;
  endHour?: number;
}

interface BookingLink {
  id: string;
  commonScheduleId?: string | null;
}

interface Props {
  link?: BookingLink;
  onChange?: () => void;
  lang?: 'en' | 'ar';
}

/**
 * CommonSchedulesPicker
 *
 * Inline picker shown in BookingLinkAdvancedSettings: lets the user pick
 * one of their saved common schedules to apply to the link, or save the
 * link's current availability as a new preset.
 */
export const CommonSchedulesPicker: React.FC<Props> = ({ link, onChange, lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [schedules, setSchedules] = useState<CommonSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<CommonSchedule[]>('/api/common-schedules');
      setSchedules(Array.isArray(data) ? data : []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleApply = async (scheduleId: string) => {
    if (!link?.id) return;
    setSavingId(scheduleId);
    setError(null);
    try {
      await apiJson(`/api/booking-links/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commonScheduleId: scheduleId }),
      });
      onChange?.();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Apply failed');
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveNew = async () => {
    if (!newName.trim()) return;
    setSavingNew(true);
    setError(null);
    try {
      await apiJson('/api/common-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), bookingLinkId: link?.id }),
      });
      setNewName('');
      load();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Save failed');
    } finally {
      setSavingNew(false);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'الجداول الشائعة' : 'Common schedules',
    apply: lang === 'ar' ? 'تطبيق' : 'Use this schedule',
    saveCurrent: lang === 'ar' ? 'احفظ الإعداد الحالي كقالب' : 'Save current as preset',
    placeholder: lang === 'ar' ? 'اسم القالب' : 'Preset name',
    active: lang === 'ar' ? 'مُطبَّق' : 'Applied',
    none: lang === 'ar' ? 'لا توجد قوالب محفوظة.' : 'No presets saved yet.',
  };

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <h4 className="text-sm font-bold text-charcoal">{labels.title}</h4>

      {loading ? (
        <div className="h-12 bg-gray-50 rounded-lg animate-pulse" />
      ) : schedules.length === 0 ? (
        <p className="text-xs text-gray-400 italic">{labels.none}</p>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => {
            const isActive = link?.commonScheduleId === s.id;
            return (
              <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-charcoal truncate">{s.name}</p>
                  {(s.startHour !== undefined || s.endHour !== undefined) && (
                    <p className="text-[10px] font-mono text-gray-400">
                      {s.startHour ?? '?'}:00 – {s.endHour ?? '?'}:00
                    </p>
                  )}
                </div>
                {isActive ? (
                  <span className="px-2 py-0.5 rounded-full bg-palm/10 text-palm text-[10px] font-bold uppercase tracking-wider">
                    {labels.active}
                  </span>
                ) : (
                  <button
                    onClick={() => handleApply(s.id)}
                    disabled={savingId === s.id || !link?.id}
                    className="text-xs font-bold text-[#8A1538] hover:text-[#5f0e26] uppercase tracking-wider disabled:opacity-50"
                  >
                    {labels.apply}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <input
          type="text"
          placeholder={labels.placeholder}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
        />
        <Button variant="secondary" onClick={handleSaveNew} loading={savingNew} disabled={!newName.trim()}>
          {labels.saveCurrent}
        </Button>
      </div>

      {error && (
        <div className="text-salmon text-xs font-bold p-2 bg-salmon/5 border-l-2 border-salmon rounded-r">
          {error}
        </div>
      )}
    </div>
  );
};

export default CommonSchedulesPicker;
