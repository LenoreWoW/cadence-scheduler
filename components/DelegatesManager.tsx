import React, { useEffect, useState } from 'react';
import { User, Language } from '../types';
import { Button } from './Button';
import { listDelegates, addDelegate, removeDelegate, DelegateLists } from '../services/delegationApi';

interface Props { users: User[]; t: (k: string) => string; lang: Language; }

export const DelegatesManager: React.FC<Props> = ({ users, t, lang }) => {
  const isRTL = lang === 'ar';
  const [data, setData] = useState<DelegateLists>({ iManage: [], myDelegates: [] });
  const [picked, setPicked] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try { setData(await listDelegates()); }
    catch (e: any) { setError(e?.body?.error || e?.message || 'Failed to load'); }
  };
  useEffect(() => { load(); }, []);

  const onAdd = async () => {
    if (!picked) return;
    try { await addDelegate(picked); setPicked(''); await load(); }
    catch (e: any) { setError(e?.body?.error || e?.message || 'Failed to add'); }
  };
  const onRemove = async (id: string) => {
    try { await removeDelegate(id); await load(); }
    catch (e: any) { setError(e?.body?.error || e?.message || 'Failed to remove'); }
  };
  const nameOf = (id: string) => users.find(u => u.id === id)?.name || id;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-4">
      <h4 className="text-xs font-bold uppercase tracking-widest text-dune">{t('manageDelegates')}</h4>
      {error && <p className="text-xs text-salmon">{error}</p>}
      <div>
        <p className="text-[10px] uppercase text-gray-400 font-bold mb-2">{t('whoCanBookForMe')}</p>
        <div className="space-y-2">
          {data.myDelegates.map(d => (
            <div key={d.delegateUserId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-sm text-charcoal">{nameOf(d.delegateUserId)}</span>
              <button onClick={() => onRemove(d.delegateUserId)} className="text-salmon text-xs font-bold">{t('decline')}</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <select value={picked} onChange={e => setPicked(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">—</option>
            {users.filter(u => u.role !== 'guest').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <Button onClick={onAdd} disabled={!picked}>{t('addDelegate')}</Button>
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase text-gray-400 font-bold mb-2">{t('whoseCalendarIManage')}</p>
        <div className="space-y-2">
          {data.iManage.map(d => (
            <div key={d.principalUserId} className="p-2 bg-gray-50 rounded-lg text-sm text-charcoal">{nameOf(d.principalUserId)}</div>
          ))}
        </div>
      </div>
    </div>
  );
};
