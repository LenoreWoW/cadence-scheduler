import React from 'react';
import { useI18n, type StringKey } from '../lib/i18n';

const MAP: Record<string, { key: StringKey; cls: string }> = {
  pending: { key: 'status.pending', cls: 'status-warn' },
  approved: { key: 'status.approved', cls: 'status-ok' },
  rejected: { key: 'status.rejected', cls: 'status-bad' },
  cancelled: { key: 'status.cancelled', cls: 'status-neutral' },
};

export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useI18n();
  const s = MAP[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s?.cls ?? 'status-neutral'}`}>
      {s ? t(s.key) : status}
    </span>
  );
};
