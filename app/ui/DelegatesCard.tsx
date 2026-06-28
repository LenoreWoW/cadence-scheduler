import React, { useState } from 'react';
import { useDelegates, useAddDelegate, useRemoveDelegate, useHosts } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { Card } from './Card';
import { Button } from './Button';

// Manage who may act on your calendar (the assistant/gatekeeper model) — audit M12.
export const DelegatesCard: React.FC = () => {
  const { user } = useAuth();
  const { data, isLoading, isError } = useDelegates();
  const { data: hosts = [] } = useHosts();
  const add = useAddDelegate();
  const remove = useRemoveDelegate();
  const [pick, setPick] = useState('');
  const [err, setErr] = useState('');

  const myDelegates = data?.myDelegates ?? [];
  const iManage = data?.iManage ?? [];
  const taken = new Set(myDelegates.map((d) => d.delegateUserId));
  const candidates = hosts.filter((h) => h.id !== user?.id && !taken.has(h.id));

  const onAdd = async () => {
    if (!pick) return;
    setErr('');
    try { await add.mutateAsync(pick); setPick(''); }
    catch (e: any) { setErr(e?.body?.error || e?.message || 'Could not add delegate.'); }
  };
  const onRemove = async (id: string) => {
    setErr('');
    try { await remove.mutateAsync(id); }
    catch (e: any) { setErr(e?.body?.error || e?.message || 'Could not remove delegate.'); }
  };

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold mb-1">Delegates</h2>
      <p className="text-muted text-sm mb-4">People who may manage your calendar and book on your behalf.</p>

      {isLoading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : isError ? (
        <p role="alert" className="text-bad text-sm">Couldn't load delegates.</p>
      ) : (
        <>
          <div className="space-y-2">
            {myDelegates.length === 0 && <p className="text-muted text-sm">No delegates yet.</p>}
            {myDelegates.map((d) => (
              <div key={d.delegateUserId} className="flex items-center justify-between surface-2 rounded-xl px-3 py-2">
                <span className="text-sm font-medium">{d.name ?? d.delegateUserId}</span>
                <Button variant="ghost" className="text-bad" onClick={() => onRemove(d.delegateUserId)} disabled={remove.isPending}>Remove</Button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <select
              className="surface-2 w-full rounded-lg px-3 py-2 text-sm ring-focus"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              aria-label="Add a delegate"
            >
              <option value="">Add someone…</option>
              {candidates.map((h) => (
                <option key={h.id} value={h.id}>{h.name}{h.title ? ` — ${h.title}` : ''}</option>
              ))}
            </select>
            <Button onClick={onAdd} disabled={!pick || add.isPending}>{add.isPending ? 'Adding…' : 'Add'}</Button>
          </div>

          {err && <p role="alert" className="text-bad text-sm mt-3">{err}</p>}

          {iManage.length > 0 && (
            <div className="mt-5 border-t border-[color:var(--border)] pt-4">
              <p className="text-muted text-xs uppercase tracking-wide mb-2">Calendars you manage</p>
              <div className="flex flex-wrap gap-2">
                {iManage.map((d) => (
                  <span key={d.principalUserId} className="status-neutral rounded-full px-2.5 py-0.5 text-xs font-medium">{d.name ?? d.principalUserId}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
};
