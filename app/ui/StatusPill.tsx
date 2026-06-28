import React from 'react';

const MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-salmon/15 text-salmon' },
  approved: { label: 'Approved', cls: 'bg-palm/15 text-palm' },
  rejected: { label: 'Rejected', cls: 'bg-gray-400/20 text-gray-500' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-400/20 text-gray-500' },
};

export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const s = MAP[status] ?? { label: status, cls: 'bg-gray-400/20 text-gray-500' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
};
