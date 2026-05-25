import React, { useEffect, useMemo, useState } from 'react';
import { apiJson } from '../services/api';

interface MemberSlot {
  start: string; // HH:MM
  end: string; // HH:MM
  title?: string;
}

interface MemberRow {
  userId: string;
  userName: string;
  avatar?: string | null;
  slots: MemberSlot[]; // booked slots for the week
}

interface TeamAvailabilityResponse {
  weekStart: string;
  weekEnd: string;
  members: MemberRow[];
}

interface TeamAvailabilityDashboardProps {
  teamId?: string;
  lang?: 'en' | 'ar';
}

const WEEK_DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_DAYS_AR = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];

const HOURS_START = 8;
const HOURS_END = 20;

/**
 * TeamAvailabilityDashboard
 *
 * Manager-view dashboard rendering a horizontal week grid with each team
 * member's booked time. Read-only.
 */
export const TeamAvailabilityDashboard: React.FC<TeamAvailabilityDashboardProps> = ({ teamId, lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [data, setData] = useState<TeamAvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (teamId) params.set('teamId', teamId);
        params.set('weekOffset', String(weekOffset));
        const res = await apiJson<TeamAvailabilityResponse>(`/api/team-availability?${params}`);
        if (!cancelled) setData(res);
      } catch (err: any) {
        if (!cancelled) setError(err?.body?.error || err?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, weekOffset]);

  // Compute the 7 days starting from the data weekStart
  const days = useMemo(() => {
    const start = data ? new Date(data.weekStart) : new Date();
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [data]);

  const hourSlots = useMemo(() => {
    const arr: string[] = [];
    for (let h = HOURS_START; h < HOURS_END; h++) {
      arr.push(`${String(h).padStart(2, '0')}:00`);
    }
    return arr;
  }, []);

  const labels = {
    title: lang === 'ar' ? 'توفر الفريق' : 'Team availability',
    subtitle: lang === 'ar' ? 'الأوقات المحجوزة والشاغرة' : 'Booked vs free time',
    prev: lang === 'ar' ? '◄ السابق' : '◄ Prev',
    next: lang === 'ar' ? 'التالي ►' : 'Next ►',
    today: lang === 'ar' ? 'هذا الأسبوع' : 'This week',
    empty: lang === 'ar' ? 'لا يوجد أعضاء.' : 'No members.',
    booked: lang === 'ar' ? 'محجوز' : 'Booked',
    free: lang === 'ar' ? 'متاح' : 'Free',
  };

  // Group slots by date
  const memberDayMap = (member: MemberRow) => {
    const map = new Map<string, MemberSlot[]>();
    for (const s of member.slots) {
      // slot must include date in start? We'll treat start as ISO datetime if present.
      const dateKey = s.start.length > 5 ? s.start.slice(0, 10) : 'TODAY';
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(s);
    }
    return map;
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-charcoal">{labels.title}</h3>
          <p className="text-xs text-gray-500">{labels.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="px-3 py-1.5 rounded-md border border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-500 hover:border-[#8A1538] hover:text-[#8A1538] transition-colors"
          >
            {labels.prev}
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
              weekOffset === 0 ? 'bg-[#8A1538] text-white' : 'border border-gray-200 text-gray-500 hover:border-[#8A1538] hover:text-[#8A1538]'
            }`}
          >
            {labels.today}
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="px-3 py-1.5 rounded-md border border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-500 hover:border-[#8A1538] hover:text-[#8A1538] transition-colors"
          >
            {labels.next}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-salmon/5 border border-salmon/20 text-salmon text-sm rounded-lg p-4">{error}</div>
      ) : !data || data.members.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-12">{labels.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Day headers */}
            <div className="grid grid-cols-[180px_repeat(7,1fr)] gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
              <div></div>
              {days.map((d, i) => (
                <div key={i} className="text-center">
                  <div>{lang === 'ar' ? WEEK_DAYS_AR[d.getDay()] : WEEK_DAYS_EN[d.getDay()]}</div>
                  <div className="text-charcoal font-mono">{d.getDate()}</div>
                </div>
              ))}
            </div>

            {/* Member rows */}
            <div className="space-y-2">
              {data.members.map((m) => {
                const dayMap = memberDayMap(m);
                return (
                  <div key={m.userId} className="grid grid-cols-[180px_repeat(7,1fr)] gap-2 items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.userName)}`}
                        alt=""
                        className="w-8 h-8 rounded-full border border-gray-200 flex-shrink-0"
                      />
                      <span className="text-sm font-bold text-charcoal truncate">{m.userName}</span>
                    </div>
                    {days.map((d, di) => {
                      const key = d.toISOString().slice(0, 10);
                      const slots = dayMap.get(key) || [];
                      const bookedHours = new Set(slots.map((s) => s.start.slice(-5).slice(0, 2)));
                      return (
                        <div key={di} className="flex flex-col gap-px">
                          {hourSlots.map((hh) => {
                            const hour = hh.slice(0, 2);
                            const booked = bookedHours.has(hour);
                            return (
                              <div
                                key={hh}
                                title={`${hh} ${booked ? labels.booked : labels.free}`}
                                className={`h-1.5 rounded-sm ${booked ? 'bg-[#8A1538]' : 'bg-gray-100'}`}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-6 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#8A1538]"></span> {labels.booked}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200"></span> {labels.free}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamAvailabilityDashboard;
