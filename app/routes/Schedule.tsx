import React from 'react';
import { motion } from 'motion/react';
import { useMeetings } from '../lib/hooks';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';
import type { Meeting } from '../../types';

const HIDDEN_STATUSES = new Set(['cancelled', 'rejected']);

const formatGroupDate = (date: string): string => {
  // date is YYYY-MM-DD — parse as local to avoid TZ drift.
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  if (Number.isNaN(dt.getTime())) return date;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dt);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  const label = dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  if (diffDays === 0) return `Today · ${label}`;
  if (diffDays === 1) return `Tomorrow · ${label}`;
  if (diffDays === -1) return `Yesterday · ${label}`;
  return label;
};

const sortByTime = (a: Meeting, b: Meeting) => a.time.localeCompare(b.time);

export const Schedule: React.FC = () => {
  const { data: meetings = [], isLoading, isError } = useMeetings();
  const [showAll, setShowAll] = React.useState(false);

  const visible = React.useMemo(
    () => meetings.filter((m) => showAll || !HIDDEN_STATUSES.has(m.status)),
    [meetings, showAll],
  );

  const groups = React.useMemo(() => {
    const byDate = new Map<string, Meeting[]>();
    for (const m of visible) {
      const list = byDate.get(m.date) ?? [];
      list.push(m);
      byDate.set(m.date, list);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, items: [...items].sort(sortByTime) }));
  }, [visible]);

  const hiddenCount = meetings.length - meetings.filter((m) => !HIDDEN_STATUSES.has(m.status)).length;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold">Schedule</h1>
          <p className="text-muted text-sm mt-1">Your agenda, grouped by day.</p>
        </div>
        <Button
          variant={showAll ? 'secondary' : 'ghost'}
          onClick={() => setShowAll((v) => !v)}
          aria-pressed={showAll}
        >
          {showAll ? 'Hide cancelled & rejected' : `Show cancelled & rejected${hiddenCount ? ` (${hiddenCount})` : ''}`}
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-3 w-32 rounded bg-[color:var(--border)]" />
              <div className="mt-3 h-4 w-2/3 rounded bg-[color:var(--border)]" />
            </Card>
          ))}
        </div>
      )}

      {/* Load error */}
      {isError && !isLoading && (
        <Card className="py-12 text-center">
          <p className="font-medium">Couldn't load your schedule</p>
          <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
        </Card>
      )}

      {/* Empty */}
      {!isLoading && !isError && groups.length === 0 && (
        <div className="gba-aurora glass rounded-2xl text-white px-6 py-16 text-center">
          <h2 className="font-display text-2xl font-semibold">Nothing on the calendar</h2>
          <p className="text-white/70 mt-2 max-w-md mx-auto text-sm">
            {meetings.length > 0
              ? 'Every meeting here is cancelled or rejected. Toggle them on to take a look.'
              : 'When meetings are scheduled, they will show up here grouped by day.'}
          </p>
        </div>
      )}

      {/* Agenda */}
      {!isLoading && groups.length > 0 && (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.date}>
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="font-display text-lg font-semibold">{formatGroupDate(group.date)}</h2>
                <span className="text-muted text-xs">
                  {group.items.length} {group.items.length === 1 ? 'meeting' : 'meetings'}
                </span>
              </div>
              <div className="space-y-2">
                {group.items.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.2) }}
                  >
                    <Card className="flex items-center gap-4">
                      <div className="w-16 shrink-0 text-center">
                        <p className="font-display text-lg font-semibold leading-none">{m.time}</p>
                        <p className="text-muted text-[11px] mt-1">{m.durationMinutes} min</p>
                      </div>
                      <div className="w-px self-stretch bg-[color:var(--border)]" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{m.title}</p>
                        <p className="text-muted text-sm truncate">
                          {m.attendeeName}
                          {m.hostName ? ` · with ${m.hostName}` : ''}
                          {m.meetingFormat ? ` · ${m.meetingFormat === 'online' ? 'Online' : 'In person'}` : ''}
                        </p>
                      </div>
                      <StatusPill status={m.status} />
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
