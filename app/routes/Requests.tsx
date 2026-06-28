import React, { useState } from 'react';
import { motion } from 'motion/react';
import { usePendingApproval, useSetMeetingStatus } from '../lib/hooks';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';
import type { Meeting } from '../../types';

export const Requests: React.FC = () => {
  const { data: pending = [], isLoading, isError } = usePendingApproval();
  const setStatus = useSetMeetingStatus();

  // Track which card (and which action) is in-flight so we only disable that row.
  const [active, setActive] = useState<{ id: string; status: 'approved' | 'rejected' } | null>(null);
  const [actionErr, setActionErr] = useState('');

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    setActive({ id, status });
    setActionErr('');
    try {
      await setStatus.mutateAsync({ id, status });
    } catch (e: any) {
      setActionErr(e?.body?.error || e?.message || 'Could not update the request. Please try again.');
    } finally {
      setActive(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-6 flex items-center gap-3">
        <h1 className="font-display text-3xl font-semibold">Requests</h1>
        {!isLoading && pending.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-salmon/15 px-2.5 py-0.5 text-sm font-semibold text-salmon">
            {pending.length}
          </span>
        )}
      </header>

      {actionErr && (
        <div className="mb-4 rounded-xl border border-salmon/30 bg-salmon/10 px-4 py-3 text-sm text-salmon">{actionErr}</div>
      )}

      {/* Load error */}
      {isError && !isLoading && (
        <Card className="py-12 text-center">
          <p className="font-medium">Couldn't load requests</p>
          <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-4 w-1/3 rounded bg-[color:var(--surface-2)]" />
              <div className="mt-3 h-3 w-1/2 rounded bg-[color:var(--surface-2)]" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && pending.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="gba-aurora relative overflow-hidden rounded-2xl px-6 py-20 text-center text-white"
        >
          <div className="mx-auto max-w-md">
            <span className="glass mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl">
              ✓
            </span>
            <h2 className="font-display text-2xl font-semibold">All caught up</h2>
            <p className="mt-2 text-white/70">No requests waiting on your review.</p>
          </div>
        </motion.div>
      )}

      {/* Request list */}
      {!isLoading && pending.length > 0 && (
        <div className="space-y-3">
          {pending.map((m: Meeting) => {
            const busy = setStatus.isPending && active?.id === m.id;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{m.title}</p>
                      <StatusPill status={m.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {m.attendeeName} · {m.date} · {m.time}
                      {m.hostName ? ` · ${m.hostName}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => decide(m.id, 'rejected')}
                      disabled={busy}
                    >
                      {busy && active?.status === 'rejected' ? 'Rejecting…' : 'Reject'}
                    </Button>
                    <Button
                      onClick={() => decide(m.id, 'approved')}
                      disabled={busy}
                    >
                      {busy && active?.status === 'approved' ? 'Approving…' : 'Approve'}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
