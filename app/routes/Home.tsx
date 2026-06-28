import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useMeetings, usePendingApproval } from '../lib/hooks';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';

export const Home: React.FC = () => {
  const { user } = useAuth();
  const { data: meetings = [] } = useMeetings();
  const { data: pending = [] } = usePendingApproval();

  const first = user?.name?.split(' ')[0] ?? 'there';
  const isManager = !!user && user.role !== 'guest';
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
            <span className="w-1.5 h-1.5 rounded-full bg-white" /> Cadence · {user?.role ?? 'guest'}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="font-display text-4xl md:text-6xl font-semibold leading-[1.05] max-w-2xl"
          >
            {isManager ? (
              <>Good day, {first}.<br /><span className="text-white/70">Your schedule, under control.</span></>
            ) : (
              <>Book time with the team, {first}.</>
            )}
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link to="/book"><Button>Request a meeting</Button></Link>
            {isManager && (
              <Link to="/requests">
                <Button variant="secondary" className="!bg-white/10 !text-white glass !border-white/20">
                  Review requests{pending.length ? ` (${pending.length})` : ''}
                </Button>
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* Summary cards (overlap the hero for depth) */}
      <section className="mx-auto max-w-6xl px-5 -mt-10 relative z-10 grid gap-4 sm:grid-cols-3">
        <Card><p className="text-muted text-xs uppercase tracking-wide">Pending</p><p className="text-3xl font-display font-semibold mt-1">{isManager ? pending.length : meetings.filter((m) => m.status === 'pending').length}</p></Card>
        <Card><p className="text-muted text-xs uppercase tracking-wide">Upcoming</p><p className="text-3xl font-display font-semibold mt-1">{upcoming.length}</p></Card>
        <Card><p className="text-muted text-xs uppercase tracking-wide">Total</p><p className="text-3xl font-display font-semibold mt-1">{meetings.length}</p></Card>
      </section>

      {/* Upcoming list */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">Upcoming</h2>
          <Link to="/schedule" className="text-sm font-medium text-al-adaam hover:underline">View schedule</Link>
        </div>
        <div className="space-y-2">
          {upcoming.length === 0 && <Card><p className="text-muted text-sm">Nothing scheduled yet.</p></Card>}
          {upcoming.map((m) => (
            <Card key={m.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{m.title}</p>
                <p className="text-muted text-sm">{m.date} · {m.time} · {m.attendeeName}</p>
              </div>
              <StatusPill status={m.status} />
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};
