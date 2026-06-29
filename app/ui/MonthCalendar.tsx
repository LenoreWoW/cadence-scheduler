import React, { useMemo, useState } from 'react';
import type { Meeting } from '../../types';
import { useI18n, type StringKey } from '../lib/i18n';
import { ChevronDownIcon } from './icons';

const DOW_KEYS: StringKey[] = ['cal.dowSun', 'cal.dowMon', 'cal.dowTue', 'cal.dowWed', 'cal.dowThu', 'cal.dowFri', 'cal.dowSat'];
const key = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Status → event-chip styling.
const CHIP: Record<string, string> = {
  approved: 'status-ok',
  pending: 'status-warn',
  rejected: 'status-bad',
  cancelled: 'status-neutral',
};

interface Props {
  meetings: Meeting[]; // already filtered by the caller (e.g. show/hide cancelled)
  onSelect: (m: Meeting) => void;
}

// Month grid (cal.com-style): full weeks with leading/trailing days, today
// highlighted, meetings as status-coloured chips. Opens on the month of the
// next upcoming meeting so it's never an empty grid.
export const MonthCalendar: React.FC<Props> = ({ meetings, onSelect }) => {
  const { t, locale } = useI18n();
  const now = new Date();
  const todayKey = key(now.getFullYear(), now.getMonth(), now.getDate());

  const byDate = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const mt of meetings) {
      const arr = map.get(mt.date) ?? [];
      arr.push(mt);
      map.set(mt.date, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [meetings]);

  // Default to the month of the earliest meeting on/after today; else this month.
  const [cursor, setCursor] = useState(() => {
    const upcoming = meetings.map((m) => m.date).filter((d) => d >= todayKey).sort();
    if (upcoming.length) {
      const [y, m] = upcoming[0].split('-').map(Number);
      return { y, m: (m || 1) - 1 };
    }
    return { y: now.getFullYear(), m: now.getMonth() };
  });

  const first = new Date(cursor.y, cursor.m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const rows = Math.ceil((startDow + daysInMonth) / 7);
  const gridStart = new Date(cursor.y, cursor.m, 1 - startDow);
  const monthLabel = first.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const cells = Array.from({ length: rows * 7 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return { date: d, inMonth: d.getMonth() === cursor.m, k: key(d.getFullYear(), d.getMonth(), d.getDate()) };
  });

  const move = (delta: number) => setCursor((c) => {
    let m = c.m + delta, y = c.y;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    return { y, m };
  });
  const goToday = () => setCursor({ y: now.getFullYear(), m: now.getMonth() });

  const navBtn = 'ring-focus grid h-9 w-9 place-items-center rounded-lg surface-2 hover:bg-al-adaam/10 hover:text-al-adaam transition-colors';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold tracking-tight">{monthLabel}</h2>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => move(-1)} aria-label={t('cal.prevMonth')} className={navBtn}>
            <ChevronDownIcon size={18} className="rotate-90" />
          </button>
          <button type="button" onClick={goToday} className="ring-focus rounded-lg surface-2 px-3 h-9 text-sm font-medium hover:bg-al-adaam/10 hover:text-al-adaam transition-colors">
            {t('date.today')}
          </button>
          <button type="button" onClick={() => move(1)} aria-label={t('cal.nextMonth')} className={navBtn}>
            <ChevronDownIcon size={18} className="-rotate-90" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1.5 text-center text-xs font-medium text-muted">
        {DOW_KEYS.map((k) => <div key={k} className="py-1">{t(k)}</div>)}
      </div>

      {/* Day grid — thin hairlines via gap-px over a border-coloured backplate */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--border)]">
        {cells.map((c) => {
          const items = byDate.get(c.k) ?? [];
          const isToday = c.k === todayKey;
          return (
            <div
              key={c.k}
              className={`min-h-24 sm:min-h-28 p-1.5 ${c.inMonth ? 'bg-[color:var(--surface)]' : 'bg-[color:var(--surface-2)]'}`}
            >
              <div className="flex items-center justify-end">
                <span
                  className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-semibold ${
                    isToday ? 'bg-al-adaam text-white' : c.inMonth ? 'text-[color:var(--text)]' : 'text-[color:var(--muted)] opacity-60'
                  }`}
                >
                  {c.date.getDate()}
                </span>
              </div>
              <div className="mt-1 space-y-1">
                {items.slice(0, 3).map((mt) => (
                  <button
                    key={mt.id}
                    onClick={() => onSelect(mt)}
                    title={`${mt.time} · ${mt.title}`}
                    className={`ring-focus block w-full truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium text-start hover:opacity-80 transition-opacity ${CHIP[mt.status] ?? 'status-neutral'}`}
                  >
                    {mt.time} {mt.title}
                  </button>
                ))}
                {items.length > 3 && (
                  <div className="px-1 text-[10px] text-muted">{t('cal.more', { n: items.length - 3 })}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
