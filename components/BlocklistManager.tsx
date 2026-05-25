import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { ConfirmationModal } from './ConfirmationModal';
import { apiJson } from '../services/api';

interface BlockEntry {
  id: string;
  pattern: string;
  reason?: string | null;
  createdAt?: string;
}

interface Props {
  lang?: 'en' | 'ar';
}

/**
 * BlocklistManager
 *
 * Manage attendee email patterns that should be blocked from booking.
 * Supports exact email, wildcard (`*@spammer.com`), or bare domain.
 */
export const BlocklistManager: React.FC<Props> = ({ lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [items, setItems] = useState<BlockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pattern, setPattern] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<BlockEntry[]>('/api/blocklist');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pattern.trim()) return;
    setSubmitting(true);
    try {
      await apiJson('/api/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: pattern.trim(),
          reason: reason.trim() || null,
        }),
      });
      setPattern('');
      setReason('');
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
      await apiJson(`/api/blocklist/${pendingDelete}`, { method: 'DELETE' });
      setItems((xs) => xs.filter((x) => x.id !== pendingDelete));
    } finally {
      setPendingDelete(null);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'قائمة الحظر' : 'Blocklist',
    subtitle:
      lang === 'ar'
        ? 'احظر أنماط البريد الإلكتروني من حجز المواعيد.'
        : 'Block email patterns from booking with you.',
    pattern: lang === 'ar' ? 'النمط' : 'Pattern',
    reason: lang === 'ar' ? 'السبب (اختياري)' : 'Reason (optional)',
    add: lang === 'ar' ? 'حظر' : 'Block',
    delete: lang === 'ar' ? 'حذف' : 'Remove',
    none: lang === 'ar' ? 'لا توجد أنماط محظورة.' : 'No blocked patterns.',
    examples: lang === 'ar'
      ? 'أمثلة: attendee@example.com أو *@spammer.com أو spammer.com'
      : 'Examples: attendee@example.com or *@spammer.com or spammer.com',
    confirmDelete: lang === 'ar' ? 'إلغاء الحظر؟' : 'Unblock this pattern?',
    confirmDeleteMsg: lang === 'ar' ? 'لن يُحظر بعد ذلك.' : 'It will no longer be blocked.',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
  };

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">{labels.title}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{labels.subtitle}</p>
      </div>

      <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
        <div className="md:col-span-5">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.pattern}</label>
          <input
            type="text"
            required
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="*@spammer.com"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538] font-mono"
            dir="ltr"
          />
        </div>
        <div className="md:col-span-5">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.reason}</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
          />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" loading={submitting} fullWidth>
            {labels.add}
          </Button>
        </div>
      </form>
      <p className="text-[10px] text-gray-400 font-mono">{labels.examples}</p>

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
          {items.map((b) => (
            <div
              key={b.id}
              className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg shadow-sm"
            >
              <div className="min-w-0">
                <p className="text-sm font-mono text-charcoal truncate" dir="ltr">{b.pattern}</p>
                {b.reason && <p className="text-[10px] text-gray-500 truncate mt-0.5">{b.reason}</p>}
              </div>
              <button
                onClick={() => setPendingDelete(b.id)}
                className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider flex-shrink-0 ml-2"
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

export default BlocklistManager;
