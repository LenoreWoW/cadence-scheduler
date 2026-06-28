import React, { useMemo, useState } from 'react';
import type { Meeting } from '../../types';
import { useI18n, type StringKey } from '../lib/i18n';
import { Button } from './Button';

const HIDDEN = new Set(['cancelled', 'rejected']);
const DOW_KEYS: StringKey[] = ['cal.dowSun', 'cal.dowMon', 'cal.dowTue', 'cal.dowWed', 'cal.dowThu', 'cal.dowFri', 'cal.dowSat'];
const key = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Month-grid density view — at-a-glance "how full is the day/week" (audit M21).
export const MonthCalendar: React.FC<{ meetings: Meeting[]; onSelect: (m: Meeting) => void }> = ({ meetings, onSelect }) => {
  const { t, locale } = useI18n();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const byDate = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const mt of meetings) {
      if (HIDDEN.has(mt.status)) continue;
      const arr = map.get(mt.date) ?? [];
      arr.push(mt);
      map.set(mt.date, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [meetings]);

  const first = new Date(cursor.y, cursor.m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const todayKey = key(now.getFullYear(), now.getMonth(), now.getDate());
  const monthLabel = first.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const cells: ({ day: number; k: string } | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, k: key(cursor.y, cursor.m, d) });

  const move = (delta: number) => {
    let m = cursor.m + delta, y = cursor.y;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCursor({ y, m });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-semibold">{monthLabel}</h2>
        <div className="flex gap-1">
          <Button variant="ghost" onClick={() => move(-1)} aria-label={t('cal.prevMonth')}>‹</Button>
          <Button variant="ghost" onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}>{t('date.today')}</Button>
          <Button variant="ghost" onClick={() => move(1)} aria-label={t('cal.nextMonth')}>›</Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted mb-1">
        {DOW_KEYS.map((k) => <div key={k} className="py-1">{t(k)}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) =>
          c === null ? (
            <div key={`e${i}`} />
          ) : (
            <div key={c.k} className={`surface rounded-lg min-h-[4.5rem] p-1.5 ${c.k === todayKey ? 'ring-1 ring-al-adaam' : ''}`}>
              <div className="text-xs font-medium text-muted">{c.day}</div>
              <div className="mt-1 space-y-0.5">
                {(byDate.get(c.k) ?? []).slice(0, 3).map((mt) => (
                  <button
                    key={mt.id}
                    onClick={() => onSelect(mt)}
                    title={`${mt.time} · ${mt.title}`}
                    className="ring-focus block w-full truncate rounded px-1 py-0.5 text-[11px] text-left bg-al-adaam/10 text-al-adaam hover:bg-al-adaam/20"
                  >
                    {mt.time} {mt.title}
                  </button>
                ))}
                {(byDate.get(c.k) ?? []).length > 3 && (
                  <div className="px-1 text-[10px] text-muted">{t('cal.more', { n: (byDate.get(c.k) ?? []).length - 3 })}</div>
                )}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
};
