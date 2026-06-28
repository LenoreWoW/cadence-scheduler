import React from 'react';
import { motion } from 'motion/react';
import { useMeetings } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { useI18n, type TFunction } from '../lib/i18n';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';
import { MeetingDetail } from '../ui/MeetingDetail';
import { MonthCalendar } from '../ui/MonthCalendar';
import { PageHeader } from '../ui/PageHeader';
import { CalendarIcon } from '../ui/icons';
import type { Meeting } from '../../types';

const HIDDEN_STATUSES = new Set(['cancelled', 'rejected']);

const formatGroupDate = (date: string, t: TFunction, locale: string): string => {
  // date is YYYY-MM-DD — parse as local to avoid TZ drift.
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  if (Number.isNaN(dt.getTime())) return date;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dt);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  const label = dt.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  if (diffDays === 0) return `${t('date.today')} · ${label}`;
  if (diffDays === 1) return `${t('date.tomorrow')} · ${label}`;
  if (diffDays === -1) return `${t('date.yesterday')} · ${label}`;
  return label;
};

const sortByTime = (a: Meeting, b: Meeting) => a.time.localeCompare(b.time);

export const Schedule: React.FC = () => {
  const { data: meetings = [], isLoading, isError } = useMeetings();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [showAll, setShowAll] = React.useState(false);
  const [selected, setSelected] = React.useState<Meeting | null>(null);
  const [view, setView] = React.useState<'agenda' | 'month'>('agenda');

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

  const viewToggle = (
    <>
      <div className="inline-flex rounded-xl surface-2 p-1">
        {(['agenda', 'month'] as const).map((v) => (
          <button
            key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-focus ${view === v ? 'bg-al-adaam text-white shadow-sm' : 'text-[color:var(--muted)]'}`}
          >
            {t(v === 'agenda' ? 'schedule.viewAgenda' : 'schedule.viewMonth')}
          </button>
        ))}
      </div>
      {view === 'agenda' && (
        <Button variant={showAll ? 'secondary' : 'ghost'} onClick={() => setShowAll((v) => !v)} aria-pressed={showAll}>
          {showAll ? t('schedule.hideCancelled') : `${t('schedule.showCancelled')}${hiddenCount ? ` (${hiddenCount})` : ''}`}
        </Button>
      )}
    </>
  );

  return (
    <div>
      <PageHeader
        eyebrow={t('schedule.eyebrow')}
        icon={<CalendarIcon size={14} />}
        title={t('schedule.title')}
        subtitle={t('schedule.subtitle')}
        right={viewToggle}
      />

      <div className="relative gba-mesh">
        <div className="mx-auto max-w-6xl px-5 py-8">
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
              <p className="font-medium">{t('schedule.errLoad')}</p>
              <p className="mt-1 text-sm text-muted">{t('common.connErr')}</p>
            </Card>
          )}

          {/* Empty */}
          {view === 'agenda' && !isLoading && !isError && groups.length === 0 && (
            <div className="gba-aurora noise glass rounded-2xl text-white px-6 py-16 text-center overflow-hidden">
              <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl glass text-white">
                <CalendarIcon size={26} />
              </span>
              <h2 className="font-display text-2xl font-semibold">{t('schedule.emptyTitle')}</h2>
              <p className="text-white/70 mt-2 max-w-md mx-auto text-sm">
                {meetings.length > 0 ? t('schedule.emptyAllHidden') : t('schedule.emptyNone')}
              </p>
            </div>
          )}

          {/* Agenda */}
          {view === 'agenda' && !isLoading && !isError && groups.length > 0 && (
            <div className="space-y-10">
              {groups.map((group) => (
                <section key={group.date}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-al-adaam/10 text-al-adaam">
                      <CalendarIcon size={16} />
                    </span>
                    <h2 className="font-display text-lg font-semibold">{formatGroupDate(group.date, t, locale)}</h2>
                    <span className="text-muted text-xs">
                      {group.items.length} {group.items.length === 1 ? t('unit.meeting') : t('unit.meetings')}
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
                        <button type="button" onClick={() => setSelected(m)} className="w-full text-left ring-focus rounded-2xl">
                          <Card interactive className="flex items-center gap-4">
                            <div className="w-16 shrink-0 text-center">
                              <p className="font-display text-lg font-semibold leading-none">{m.time}</p>
                              <p className="text-muted text-[11px] mt-1">{m.durationMinutes} {t('unit.min')}</p>
                            </div>
                            <div className="w-px self-stretch bg-[color:var(--border)]" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{m.title}</p>
                              <p className="text-muted text-sm truncate">
                                {m.attendeeName}
                                {m.hostName ? ` · ${t('meeting.with', { name: m.hostName })}` : ''}
                                {m.meetingFormat ? ` · ${m.meetingFormat === 'online' ? t('book.online') : t('book.inPerson')}` : ''}
                              </p>
                            </div>
                            <StatusPill status={m.status} />
                          </Card>
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Month view */}
          {view === 'month' && !isLoading && !isError && (
            <MonthCalendar meetings={meetings} onSelect={setSelected} />
          )}
        </div>
      </div>

      {selected && (
        <MeetingDetail meeting={selected} role={user?.role} currentUserId={user?.id} onClose={() => setSelected(null)} />
      )}
    </div>
  );
};
