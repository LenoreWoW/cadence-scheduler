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

export const Home: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const { data: meetings = [], isLoading, isError } = useMeetings();
  const { data: pending = [] } = usePendingApproval();
  const stat = (n: number) => (isLoading ? '—' : n);

  const first = user?.name?.split(' ')[0] ?? '';
  const isApprover = canApprove(user?.role);
  const roleKey = roleLabelKey(user?.role);
  const upcoming = meetings
    .filter((m) => m.status !== 'cancelled' && m.status !== 'rejected')
    .slice(0, 6);

  return (
    <div>
      {/* Immersive hero */}
      <section className="relative gba-aurora text-white overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <motion.span
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium mb-6"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white" /> Cadence · {t(roleKey ?? 'role.guest')}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="font-display text-4xl md:text-6xl font-semibold leading-[1.05] max-w-2xl"
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
        <>
          {/* Summary cards (overlap the hero for depth) */}
          <section className="mx-auto max-w-6xl px-5 -mt-10 relative z-10 grid gap-4 sm:grid-cols-3">
            <Card><p className="text-muted text-xs uppercase tracking-wide">{t('home.statPending')}</p><p className="text-3xl font-display font-semibold mt-1">{stat(isApprover ? pending.length : meetings.filter((m) => m.status === 'pending').length)}</p></Card>
            <Card><p className="text-muted text-xs uppercase tracking-wide">{t('home.statUpcoming')}</p><p className="text-3xl font-display font-semibold mt-1">{stat(upcoming.length)}</p></Card>
            <Card><p className="text-muted text-xs uppercase tracking-wide">{t('home.statTotal')}</p><p className="text-3xl font-display font-semibold mt-1">{stat(meetings.length)}</p></Card>
          </section>

          {/* Upcoming list */}
          <section className="mx-auto max-w-6xl px-5 py-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold">{t('home.upcoming')}</h2>
              <Link to="/schedule" className="text-sm font-medium text-al-adaam hover:underline">{t('home.viewSchedule')}</Link>
            </div>
            <div className="space-y-2" aria-busy={isLoading}>
              {isLoading && [0, 1, 2].map((i) => (
                <Card key={i} className="animate-pulse"><div className="h-4 w-1/3 rounded bg-[color:var(--border)]" /><div className="mt-2 h-3 w-1/2 rounded bg-[color:var(--border)]" /></Card>
              ))}
              {!isLoading && upcoming.length === 0 && <Card><p className="text-muted text-sm">{t('home.nothingScheduled')}</p></Card>}
              {!isLoading && upcoming.map((m) => (
                <Card key={m.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.title}</p>
                    <p className="text-muted text-sm truncate">{m.date} · {m.time} · {m.attendeeName}</p>
                  </div>
                  <StatusPill status={m.status} />
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
