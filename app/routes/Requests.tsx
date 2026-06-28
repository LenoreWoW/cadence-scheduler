import React, { useState } from 'react';
import { motion } from 'motion/react';
import { usePendingApproval, useSetMeetingStatus } from '../lib/hooks';
import { useI18n } from '../lib/i18n';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';
import { PageHeader } from '../ui/PageHeader';
import { InboxIcon, CheckCircleIcon, CalendarIcon } from '../ui/icons';
import type { Meeting } from '../../types';

export const Requests: React.FC = () => {
  const { t } = useI18n();
  const { data: pending = [], isLoading, isError } = usePendingApproval();
  const setStatus = useSetMeetingStatus();

  // Track which card (and which action) is in-flight so we only disable that row.
  const [active, setActive] = useState<{ id: string; status: 'approved' | 'rejected' } | null>(null);
  const [actionErr, setActionErr] = useState('');
  const [notice, setNotice] = useState('');

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    // Reject is consequential + effectively irreversible — confirm it (audit C3).
    if (status === 'rejected' && !window.confirm(t('requests.confirmReject'))) return;
    setActive({ id, status });
    setActionErr('');
    setNotice('');
    try {
      await setStatus.mutateAsync({ id, status });
      setNotice(status === 'approved' ? t('requests.approvedNotice') : t('requests.rejectedNotice'));
    } catch (e: any) {
      setActionErr(e?.body?.error || e?.message || t('requests.errUpdate'));
    } finally {
      setActive(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={t('requests.eyebrow')}
        icon={<InboxIcon size={14} />}
        title={t('requests.title')}
        right={
          !isLoading && pending.length > 0 ? (
            <span className="inline-flex items-center rounded-full status-warn px-2.5 py-0.5 text-sm font-semibold">
              {pending.length}
            </span>
          ) : undefined
        }
      />

      <div className="relative gba-mesh">
        <div className="mx-auto max-w-6xl px-5 py-8">
          {notice && (
            <div role="status" className="mb-4 rounded-xl status-ok px-4 py-3 text-sm font-medium">{notice}</div>
          )}
          {actionErr && (
            <div role="alert" className="mb-4 rounded-xl status-bad px-4 py-3 text-sm">{actionErr}</div>
          )}

          {/* Load error */}
          {isError && !isLoading && (
            <Card className="py-12 text-center">
              <p className="font-medium">{t('requests.errLoad')}</p>
              <p className="mt-1 text-sm text-muted">{t('common.connErr')}</p>
            </Card>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="space-y-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-4 w-1/3 rounded bg-[color:var(--border)]" />
                  <div className="mt-3 h-3 w-1/2 rounded bg-[color:var(--border)]" />
                </Card>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && pending.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="gba-aurora noise relative overflow-hidden rounded-2xl px-6 py-20 text-center text-white"
            >
              <div className="absolute inset-0 gba-grid opacity-[0.12]" aria-hidden="true" />
              <div className="relative mx-auto max-w-md">
                <span className="glass mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl">
                  <CheckCircleIcon size={28} />
                </span>
                <h2 className="font-display text-2xl font-semibold">{t('requests.allCaught')}</h2>
                <p className="mt-2 text-white/70">{t('requests.noWaiting')}</p>
              </div>
            </motion.div>
          )}

          {/* Request list */}
          {!isLoading && pending.length > 0 && (
            <div className="space-y-3">
              {pending.map((m: Meeting, i) => {
                const busy = setStatus.isPending && active?.id === m.id;
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.18) }}
                  >
                    <Card interactive className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-al-adaam/10 text-al-adaam">
                          <CalendarIcon size={20} />
                        </span>
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
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => decide(m.id, 'rejected')}
                          disabled={setStatus.isPending}
                        >
                          {busy && active?.status === 'rejected' ? t('requests.rejecting') : t('common.reject')}
                        </Button>
                        <Button
                          onClick={() => decide(m.id, 'approved')}
                          disabled={setStatus.isPending}
                        >
                          {busy && active?.status === 'approved' ? t('requests.approving') : t('common.approve')}
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
