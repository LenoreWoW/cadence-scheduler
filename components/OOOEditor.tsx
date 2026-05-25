import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { ConfirmationModal } from './ConfirmationModal';
import { apiJson } from '../services/api';

interface OOO {
  id: string;
  startDate: string;
  endDate: string;
  delegateUserId?: string | null;
  delegateName?: string | null;
}

interface UserOption {
  id: string;
  name: string;
}

interface Props {
  lang?: 'en' | 'ar';
}

/**
 * OOOEditor
 *
 * Out-of-office editor: lists upcoming OOO ranges, lets users add a new one
 * with an optional delegate, and delete existing ones.
 */
export const OOOEditor: React.FC<Props> = ({ lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [items, setItems] = useState<OOO[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [delegate, setDelegate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<OOO[]>('/api/ooo');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await apiJson<UserOption[]>('/api/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => {
    load();
    loadUsers();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!start || !end) return;
    setSubmitting(true);
    try {
      await apiJson('/api/ooo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          delegateUserId: delegate || null,
        }),
      });
      setStart('');
      setEnd('');
      setDelegate('');
      load();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Add failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await apiJson(`/api/ooo/${pendingDelete}`, { method: 'DELETE' });
      setItems((xs) => xs.filter((x) => x.id !== pendingDelete));
    } finally {
      setPendingDelete(null);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'خارج المكتب' : 'Out of office',
    subtitle:
      lang === 'ar'
        ? 'حدد فترات غيابك وفوّض شخصاً آخر.'
        : 'Mark when you are away and optionally delegate.',
    add: lang === 'ar' ? 'إضافة' : 'Add OOO',
    start: lang === 'ar' ? 'البداية' : 'Start',
    end: lang === 'ar' ? 'النهاية' : 'End',
    delegate: lang === 'ar' ? 'المُفوَّض (اختياري)' : 'Delegate (optional)',
    delete: lang === 'ar' ? 'حذف' : 'Delete',
    none: lang === 'ar' ? 'لا توجد فترات غياب قادمة.' : 'No upcoming OOO periods.',
    confirmDelete: lang === 'ar' ? 'حذف هذه الفترة؟' : 'Delete this OOO?',
    confirmDeleteMsg: lang === 'ar' ? 'لن تظهر بعد ذلك.' : 'It will no longer apply.',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
  };

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">{labels.title}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{labels.subtitle}</p>
      </div>

      <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
        <div className="md:col-span-3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.start}</label>
          <input
            type="date"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#8A1538]"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.end}</label>
          <input
            type="date"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#8A1538]"
          />
        </div>
        <div className="md:col-span-4">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.delegate}</label>
          <select
            value={delegate}
            onChange={(e) => setDelegate(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#8A1538]"
          >
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <Button type="submit" loading={submitting} fullWidth>
            {labels.add}
          </Button>
        </div>
      </form>

      {error && (
        <div className="text-salmon text-xs font-bold p-2 bg-salmon/5 border-l-2 border-salmon rounded-r">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-16 bg-gray-50 rounded-lg animate-pulse" />
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 italic">{labels.none}</p>
      ) : (
        <div className="space-y-2">
          {items.map((o) => (
            <div key={o.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
              <div>
                <p className="text-sm font-mono text-charcoal">
                  {o.startDate} → {o.endDate}
                </p>
                {(o.delegateName || o.delegateUserId) && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {labels.delegate}: {o.delegateName || users.find((u) => u.id === o.delegateUserId)?.name || o.delegateUserId}
                  </p>
                )}
              </div>
              <button
                onClick={() => setPendingDelete(o.id)}
                className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider"
              >
                {labels.delete}
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={labels.confirmDelete}
        message={labels.confirmDeleteMsg}
        confirmLabel={labels.delete}
        cancelLabel={labels.cancel}
        isRTL={isRTL}
      />
    </div>
  );
};

export default OOOEditor;
