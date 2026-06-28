import React from 'react';

const MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'status-warn' },
  approved: { label: 'Approved', cls: 'status-ok' },
  rejected: { label: 'Rejected', cls: 'status-bad' },
  cancelled: { label: 'Cancelled', cls: 'status-neutral' },
};

export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const s = MAP[status] ?? { label: status, cls: 'status-neutral' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
};
