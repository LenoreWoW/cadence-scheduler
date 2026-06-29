import React, { useState } from 'react';
import { motion } from 'motion/react';
import type { Meeting } from '../../types';
import { useSetMeetingStatus, useRescheduleMeeting } from '../lib/hooks';
import { canApprove } from '../lib/roles';
import { useI18n } from '../lib/i18n';
import { Button } from './Button';
import { StatusPill } from './StatusPill';

interface Props {
  meeting: Meeting;
  role?: string;
  currentUserId?: string;
  onClose: () => void;
}

// Meeting detail + lifecycle actions (approve/reject/reschedule/cancel) — audit M11/C3/C5.
export const MeetingDetail: React.FC<Props> = ({ meeting, role, currentUserId, onClose }) => {
  const { t } = useI18n();
  const setStatus = useSetMeetingStatus();
  const reschedule = useRescheduleMeeting();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(meeting.date);
  const [time, setTime] = useState(meeting.time);
  const [err, setErr] = useState('');

  const isOpen = meeting.status === 'pending' || meeting.status === 'approved';
  const canManage = role === 'admin' || meeting.hostId === currentUserId || meeting.userId === currentUserId;
  const canDecide = meeting.status === 'pending' && (canApprove(role) || meeting.hostId === currentUserId);
  const busy = setStatus.isPending || reschedule.isPending;

  const act = async (fn: () => Promise<unknown>, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setErr('');
    try { await fn(); onClose(); }
    catch (e: any) { setErr(e?.body?.error || e?.message || t('detail.errAction')); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={t('detail.aria', { title: meeting.title })}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        className="surface relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-6 [box-shadow:var(--shadow)] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-semibold">{meeting.title}</h2>
              <StatusPill status={meeting.status} />
            </div>
            <p className="text-muted text-sm mt-1">{meeting.date} · {meeting.time} · {meeting.durationMinutes} {t('unit.min')}</p>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="ring-focus rounded-lg p-2 text-muted hover:text-[color:var(--text)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-y-3 text-sm">
          <dt className="text-muted">{t('detail.host')}</dt><dd className="col-span-2">{meeting.hostName ?? meeting.hostId}</dd>
          <dt className="text-muted">{t('detail.attendee')}</dt><dd className="col-span-2">{meeting.attendeeName}{meeting.attendeeEmail ? ` · ${meeting.attendeeEmail}` : ''}</dd>
          <dt className="text-muted">{t('detail.format')}</dt><dd className="col-span-2">{meeting.meetingFormat ? (meeting.meetingFormat === 'online' ? t('book.online') : t('book.inPerson')) : ''}{meeting.locality ? ` · ${meeting.locality === 'external' ? t('book.external') : t('book.internal')}` : ''}</dd>
          {meeting.onBehalf && (<><dt className="text-muted">{t('detail.onBehalf')}</dt><dd className="col-span-2">{t('detail.onBehalfValue')}</dd></>)}
          {meeting.notes && (<><dt className="text-muted">{t('detail.notes')}</dt><dd className="col-span-2 whitespace-pre-wrap">{meeting.notes}</dd></>)}
        </dl>

        {editing && (
          <div className="mt-5 surface-2 rounded-xl p-4">
            <p className="text-sm font-semibold mb-2">{t('detail.reschedule')}</p>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" aria-label={t('detail.newDate')} className="surface w-full rounded-lg px-3 py-2 text-sm ring-focus" value={date} onChange={(e) => setDate(e.target.value)} />
              <input type="time" aria-label={t('detail.newTime')} className="surface w-full rounded-lg px-3 py-2 text-sm ring-focus" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => act(() => reschedule.mutateAsync({ id: meeting.id, date, time }))} disabled={busy}>
                {reschedule.isPending ? t('detail.saving') : t('detail.saveNewTime')}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>{t('common.cancel')}</Button>
            </div>
          </div>
        )}

        {err && <p role="alert" className="text-bad text-sm mt-4">{err}</p>}

        {!editing && isOpen && (canDecide || canManage) && (
          <div className="mt-6 flex flex-wrap gap-2">
            {canDecide && <Button onClick={() => act(() => setStatus.mutateAsync({ id: meeting.id, status: 'approved' }))} disabled={busy}>{t('common.approve')}</Button>}
            {canDecide && <Button variant="secondary" onClick={() => act(() => setStatus.mutateAsync({ id: meeting.id, status: 'rejected' }), t('detail.confirmReject'))} disabled={busy}>{t('common.reject')}</Button>}
            {canManage && <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>{t('detail.reschedule')}</Button>}
            {canManage && <Button variant="ghost" className="text-bad" onClick={() => act(() => setStatus.mutateAsync({ id: meeting.id, status: 'cancelled' }), t('detail.confirmCancel'))} disabled={busy}>{t('detail.cancelMeeting')}</Button>}
          </div>
        )}
      </motion.div>
    </div>
  );
};
