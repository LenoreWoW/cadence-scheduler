import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { canApprove } from '../lib/roles';
import { useI18n, roleLabelKey } from '../lib/i18n';
import { useMeetings, usePendingApproval } from '../lib/hooks';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';
import {
  InboxIcon, CalendarIcon, LayersIcon, CalendarPlusIcon, UsersIcon, ArrowRightIcon,
} from '../ui/icons';
import type { Meeting } from '../../types';

// Mount-based reveal (robust for SSR-less first paint + screenshots; content is
// never left hidden by an IntersectionObserver that didn't fire).
const inView = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4 },
});

export const Home: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const { data: meetings = [], isLoading, isError } = useMeetings();
  const { data: pending = [] } = usePendingApproval();
  const statVal = (n: number): React.ReactNode => (isLoading ? '—' : n);

  const first = user?.name?.split(' ')[0] ?? '';
  const isApprover = canApprove(user?.role);
  const roleKey = roleLabelKey(user?.role);
  const upcoming = meetings
    .filter((m) => m.status !== 'cancelled' && m.status !== 'rejected')
    .slice(0, 5);

  const stats: { label: string; value: number; Icon: typeof InboxIcon }[] = [
    { label: t('home.statPending'), value: isApprover ? pending.length : meetings.filter((m) => m.status === 'pending').length, Icon: InboxIcon },
    { label: t('home.statUpcoming'), value: upcoming.length, Icon: CalendarIcon },
    { label: t('home.statTotal'), value: meetings.length, Icon: LayersIcon },
  ];

  type Action = { to: string; title: string; desc: string; Icon: typeof InboxIcon; badge?: number };
  const actions: Action[] = [
    { to: '/book', title: t('home.requestMeeting'), desc: t('home.qaBookDesc'), Icon: CalendarPlusIcon },
    ...(isApprover ? [{ to: '/requests', title: t('home.reviewRequests'), desc: t('home.qaReviewDesc'), Icon: InboxIcon, badge: pending.length }] : []),
    { to: '/schedule', title: t('home.viewSchedule'), desc: t('home.qaScheduleDesc'), Icon: CalendarIcon },
    { to: '/profile', title: t('home.manageDelegates'), desc: t('home.qaDelegatesDesc'), Icon: UsersIcon },
  ];

  return (
    <div>
      {/* Immersive hero */}
      <section className="relative gba-aurora noise text-white overflow-hidden">
        <div className="absolute inset-0 gba-grid opacity-[0.12]" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 md:py-28">
          <motion.span
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium mb-6"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white" /> Cadence · {t(roleKey ?? 'role.guest')}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="font-display text-4xl md:text-6xl font-semibold leading-[1.05] tracking-tight max-w-2xl"
          >
            {isApprover ? (
              <>{t('home.greetingApprover1', { name: first })}<br /><span className="text-white/70">{t('home.greetingApprover2')}</span></>
            ) : (
              <>{t('home.greetingGuest', { name: first })}</>
            )}
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link to="/book"><Button>{t('home.requestMeeting')}</Button></Link>
            {isApprover && (
              <Link to="/requests">
                <Button variant="secondary" className="!bg-white/10 !text-white glass !border-white/20">
                  {t('home.reviewRequests')}{pending.length ? ` (${pending.length})` : ''}
                </Button>
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {isError ? (
        <section className="mx-auto max-w-6xl px-5 -mt-10 relative z-10">
          <Card role="alert" className="py-10 text-center">
            <p className="font-medium">{t('home.errTitle')}</p>
            <p className="text-muted text-sm mt-1">{t('common.connErr')}</p>
          </Card>
        </section>
      ) : (
        <div className="relative gba-mesh">
          {/* Stat band — overlaps the hero for depth */}
          <section className="mx-auto max-w-6xl px-5 -mt-12 relative z-10 grid gap-4 sm:grid-cols-3">
            {stats.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
                <Card interactive className="flex items-center gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-al-adaam/10 text-al-adaam">
                    <s.Icon size={20} />
                  </span>
                  <div>
                    <p className="text-muted text-xs uppercase tracking-wide">{s.label}</p>
                    <p className="text-3xl font-display font-semibold leading-none mt-1">{statVal(s.value)}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </section>

          {/* Quick actions */}
          <section className="mx-auto max-w-6xl px-5 pt-12">
            <motion.h2 {...inView()} className="font-display text-xl font-semibold mb-4">{t('home.quickActions')}</motion.h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {actions.map((a, i) => (
                <motion.div key={a.to + a.title} {...inView(0.04 * i)}>
                  <Link to={a.to} className="block h-full ring-focus rounded-2xl">
                    <Card interactive className="h-full flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-al-adaam/10 text-al-adaam">
                          <a.Icon size={20} />
                        </span>
                        {a.badge ? (
                          <span className="inline-flex items-center rounded-full status-warn px-2 py-0.5 text-xs font-semibold">{a.badge}</span>
                        ) : null}
                      </div>
                      <div>
                        <p className="font-semibold">{a.title}</p>
                        <p className="text-muted text-sm mt-0.5">{a.desc}</p>
                      </div>
                      <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-al-adaam">
                        <ArrowRightIcon size={16} className="rtl:rotate-180" />
                      </span>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Upcoming + side rail */}
          <section className="mx-auto max-w-6xl px-5 py-12 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold">{t('home.upcoming')}</h2>
                <Link to="/schedule" className="text-sm font-medium text-al-adaam hover:underline">{t('home.viewSchedule')}</Link>
              </div>
              <div className="space-y-2" aria-busy={isLoading}>
                {isLoading && [0, 1, 2].map((i) => (
                  <Card key={i} className="animate-pulse"><div className="h-4 w-1/3 rounded bg-[color:var(--border)]" /><div className="mt-2 h-3 w-1/2 rounded bg-[color:var(--border)]" /></Card>
                ))}
                {!isLoading && upcoming.length === 0 && (
                  <Card className="text-center py-10">
                    <p className="text-muted text-sm">{t('home.nothingScheduled')}</p>
                    <Link to="/book" className="mt-4 inline-block"><Button>{t('home.requestMeeting')}</Button></Link>
                  </Card>
                )}
                {!isLoading && upcoming.map((m: Meeting, i) => (
                  <motion.div key={m.id} {...inView(Math.min(i * 0.03, 0.18))}>
                    <Card interactive className="flex items-center gap-4">
                      <div className="w-16 shrink-0 text-center">
                        <p className="font-display text-lg font-semibold leading-none">{m.time}</p>
                        <p className="text-muted text-[11px] mt-1">{m.durationMinutes} {t('unit.min')}</p>
                      </div>
                      <div className="w-px self-stretch bg-[color:var(--border)]" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{m.title}</p>
                        <p className="text-muted text-sm truncate">{m.date} · {m.attendeeName}</p>
                      </div>
                      <StatusPill status={m.status} />
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Side rail — role-aware */}
            <aside>
              {isApprover ? (
                <Card className="gba-glow relative overflow-hidden h-full">
                  <h3 className="font-display text-lg font-semibold">{t('home.awaitingTitle')}</h3>
                  <p className="mt-1 text-4xl font-display font-semibold text-al-adaam">{isLoading ? '—' : pending.length}</p>
                  {pending.length === 0 ? (
                    <p className="text-muted text-sm mt-2">{t('home.awaitingEmpty')}</p>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {pending.slice(0, 3).map((m: Meeting) => (
                        <li key={m.id} className="surface-2 rounded-xl px-3 py-2 text-sm">
                          <p className="font-medium truncate">{m.title}</p>
                          <p className="text-muted text-xs truncate">{m.attendeeName} · {m.date}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {pending.length > 0 && (
                    <Link to="/requests" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-al-adaam hover:underline">
                      {t('home.reviewAll')} <ArrowRightIcon size={15} className="rtl:rotate-180" />
                    </Link>
                  )}
                </Card>
              ) : (
                <Card className="gba-glow relative overflow-hidden h-full">
                  <h3 className="font-display text-lg font-semibold">{t('home.howTitle')}</h3>
                  <ol className="mt-4 space-y-4">
                    {[t('home.step1'), t('home.step2'), t('home.step3')].map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-al-adaam text-white text-xs font-semibold">{i + 1}</span>
                        <span className="text-sm pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <Link to="/book" className="mt-5 inline-block"><Button>{t('home.requestMeeting')}</Button></Link>
                </Card>
              )}
            </aside>
          </section>
        </div>
      )}
    </div>
  );
};
