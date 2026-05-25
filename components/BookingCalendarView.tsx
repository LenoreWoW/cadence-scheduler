import React, { useEffect, useMemo, useState } from 'react';
import { apiJson } from '../services/api';
import { Button } from './Button';

interface Meeting {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
  attendeeName?: string;
  status?: string;
  meetingFormat?: string;
}

interface Props {
  lang?: 'en' | 'ar';
  t?: (key: string) => string;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * BookingCalendarView
 *
 * Top-level booking calendar — month grid of all meetings the current user
 * can see, with day-detail drill-down.
 */
export const BookingCalendarView: React.FC<Props> = ({ lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [month, setMonth] = useState(new Date());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monthRange = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    return { start: ymd(start), end: ymd(end) };
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiJson<Meeting[] | { meetings: Meeting[] }>(
          `/api/meetings?startDate=${monthRange.start}&endDate=${monthRange.end}`,
        );
        if (cancelled) return;
        const list = Array.isArray(data) ? data : (data as any).meetings || [];
        setMeetings(list);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.body?.error || err?.message || 'Failed to load');
        setMeetings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monthRange.start, monthRange.end]);

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

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      if (!map.has(m.date)) map.set(m.date, []);
      map.get(m.date)!.push(m);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [meetings]);

  const monthName = month.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });

  const labels = {
    title: lang === 'ar' ? 'تقويم الحجوزات' : 'Booking calendar',
    today: lang === 'ar' ? 'اليوم' : 'Today',
    noMeetings: lang === 'ar' ? 'لا توجد اجتماعات في هذا اليوم.' : 'No meetings on this day.',
    close: lang === 'ar' ? 'إغلاق' : 'Close',
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold text-charcoal">{labels.title}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="prev"
          >
            <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="text-sm font-bold text-charcoal min-w-[120px] text-center">{monthName}</p>
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="next"
          >
            <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <Button variant="secondary" onClick={() => setMonth(new Date())}>{labels.today}</Button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-500 py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square md:aspect-[7/4] bg-gray-50/40 border-b border-r border-gray-50" />;
            const key = ymd(d);
            const list = meetingsByDay.get(key) || [];
            const isToday = ymd(new Date()) === key;
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(key)}
                className={`aspect-square md:aspect-[7/4] text-left p-2 border-b border-r border-gray-50 hover:bg-[#8A1538]/5 transition-colors ${
                  isToday ? 'bg-[#8A1538]/5' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className={`text-xs font-bold ${isToday ? 'text-[#8A1538]' : 'text-charcoal'}`}>
                    {d.getDate()}
                  </span>
                  {list.length > 0 && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[#8A1538]/10 text-[#8A1538]">
                      {list.length}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {list.slice(0, 3).map((m) => (
                    <div
                      key={m.id}
                      className="text-[10px] truncate bg-gray-100 text-charcoal px-1.5 py-0.5 rounded"
                      title={`${m.time} – ${m.title}`}
                    >
                      <span className="font-mono text-gray-500 mr-1">{m.time}</span>
                      {m.title}
                    </div>
                  ))}
                  {list.length > 3 && (
                    <div className="text-[9px] text-gray-400 px-1.5">+{list.length - 3} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {loading && <p className="text-xs text-gray-400 text-center">…</p>}
      {error && (
        <div className="text-salmon text-xs font-bold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r">
          {error}
        </div>
      )}

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => setSelectedDay(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-display font-bold text-charcoal">{selectedDay}</h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-gray-400 hover:text-charcoal p-2 rounded-full hover:bg-gray-100"
                aria-label={labels.close}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-6 space-y-3">
              {(meetingsByDay.get(selectedDay) || []).length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-8">{labels.noMeetings}</p>
              ) : (
                (meetingsByDay.get(selectedDay) || []).map((m) => (
                  <div key={m.id} className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-charcoal">{m.title}</p>
                      <span className="text-[10px] font-mono text-gray-500">{m.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1">
                      {m.attendeeName && <span>{m.attendeeName}</span>}
                      <span>·</span>
                      <span>{m.durationMinutes} min</span>
                      {m.meetingFormat && (
                        <>
                          <span>·</span>
                          <span className="capitalize">{m.meetingFormat}</span>
                        </>
                      )}
                      {m.status && (
                        <>
                          <span>·</span>
                          <span className="capitalize">{m.status}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingCalendarView;
