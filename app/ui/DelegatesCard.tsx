import React, { useState } from 'react';
import { useDelegates, useAddDelegate, useRemoveDelegate, useHosts } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { Card } from './Card';
import { Button } from './Button';
import { Select } from './Select';

// Manage who may act on your calendar (the assistant/gatekeeper model) — audit M12.
export const DelegatesCard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
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
    catch (e: any) { setErr(e?.body?.error || e?.message || t('delegates.errAdd')); }
  };
  const onRemove = async (id: string) => {
    setErr('');
    try { await remove.mutateAsync(id); }
    catch (e: any) { setErr(e?.body?.error || e?.message || t('delegates.errRemove')); }
  };

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold mb-1">{t('delegates.title')}</h2>
      <p className="text-muted text-sm mb-4">{t('delegates.subtitle')}</p>

      {isLoading ? (
        <p className="text-muted text-sm">{t('common.loading')}</p>
      ) : isError ? (
        <p role="alert" className="text-bad text-sm">{t('delegates.errLoad')}</p>
      ) : (
        <>
          <div className="space-y-2">
            {myDelegates.length === 0 && <p className="text-muted text-sm">{t('delegates.none')}</p>}
            {myDelegates.map((d) => (
              <div key={d.delegateUserId} className="flex items-center justify-between surface-2 rounded-xl px-3 py-2">
                <span className="text-sm font-medium">{d.name ?? d.delegateUserId}</span>
                <Button variant="ghost" className="text-bad" onClick={() => onRemove(d.delegateUserId)} disabled={remove.isPending}>{t('common.remove')}</Button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <div className="flex-1">
              <Select
                value={pick}
                onChange={setPick}
                ariaLabel={t('delegates.add')}
                placeholder={t('delegates.addPlaceholder')}
                options={candidates.map((h) => ({ value: h.id, label: `${h.name}${h.title ? ` — ${h.title}` : ''}` }))}
              />
            </div>
            <Button onClick={onAdd} disabled={!pick || add.isPending}>{add.isPending ? t('delegates.adding') : t('common.add')}</Button>
          </div>

          {err && <p role="alert" className="text-bad text-sm mt-3">{err}</p>}

          {iManage.length > 0 && (
            <div className="mt-5 border-t border-[color:var(--border)] pt-4">
              <p className="text-muted text-xs uppercase tracking-wide mb-2">{t('delegates.iManage')}</p>
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
