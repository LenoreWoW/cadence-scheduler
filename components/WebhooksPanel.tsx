import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { ConfirmationModal } from './ConfirmationModal';
import { apiJson } from '../services/api';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string | null;
  lastStatus?: 'success' | 'failure' | 'unknown' | null;
  lastDeliveredAt?: string | null;
  isActive?: boolean;
}

interface WebhooksPanelProps {
  lang?: 'en' | 'ar';
}

const ALL_EVENTS = [
  'booking.created',
  'booking.cancelled',
  'booking.rescheduled',
  'booking.approved',
  'booking.rejected',
];

/**
 * WebhooksPanel
 *
 * Lists user webhooks with last delivery status. Lets users create, test,
 * and delete webhooks.
 */
export const WebhooksPanel: React.FC<WebhooksPanelProps> = ({ lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ name: string; url: string; events: string[]; secret: string }>({
    name: '',
    url: '',
    events: ['booking.created'],
    secret: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResponse, setTestResponse] = useState<{ id: string; ok: boolean; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<Webhook[]>('/api/webhooks');
      setHooks(Array.isArray(data) ? data : []);
    } catch {
      setHooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleEvent = (ev: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiJson('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          url: form.url.trim(),
          events: form.events,
          secret: form.secret.trim() || null,
        }),
      });
      setForm({ name: '', url: '', events: ['booking.created'], secret: '' });
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || (lang === 'ar' ? 'فشل الإنشاء' : 'Create failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResponse(null);
    try {
      const res = await apiJson<{ ok: boolean; statusCode?: number; message?: string }>(
        `/api/webhooks/${id}/test`,
        { method: 'POST' },
      );
      setTestResponse({
        id,
        ok: !!res.ok,
        message: res.message || (res.ok ? 'Delivery succeeded' : `HTTP ${res.statusCode || '?'}`),
      });
    } catch (err: any) {
      setTestResponse({ id, ok: false, message: err?.body?.error || err?.message || 'Test failed' });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await apiJson(`/api/webhooks/${pendingDelete}`, { method: 'DELETE' });
      setHooks((prev) => prev.filter((h) => h.id !== pendingDelete));
    } finally {
      setPendingDelete(null);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'Webhooks' : 'Webhooks',
    subtitle: lang === 'ar' ? 'استقبل الإشعارات في خدماتك الخاصة' : 'Receive notifications on your own services',
    create: lang === 'ar' ? '+ Webhook جديد' : '+ New webhook',
    name: lang === 'ar' ? 'الاسم' : 'Name',
    url: 'URL',
    events: lang === 'ar' ? 'الأحداث' : 'Events',
    secret: lang === 'ar' ? 'السر (اختياري)' : 'Secret (optional)',
    save: lang === 'ar' ? 'إنشاء' : 'Create',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
    test: lang === 'ar' ? 'اختبار' : 'Test',
    delete: lang === 'ar' ? 'حذف' : 'Delete',
    none: lang === 'ar' ? 'لا توجد webhooks بعد.' : 'No webhooks yet.',
    confirmDelete: lang === 'ar' ? 'حذف هذا الـ webhook؟' : 'Delete this webhook?',
    confirmDeleteMsg: lang === 'ar' ? 'لن تتلقى المزيد من الإشعارات على هذا العنوان.' : 'You will stop receiving deliveries to this URL.',
    statusSuccess: lang === 'ar' ? 'ناجح' : 'Success',
    statusFailure: lang === 'ar' ? 'فاشل' : 'Failure',
    statusUnknown: lang === 'ar' ? 'لم يُسلَّم بعد' : 'Not yet delivered',
  };

  const statusPill = (s: Webhook['lastStatus']) => {
    if (s === 'success')
      return <span className="px-2 py-0.5 rounded-full bg-palm/10 text-palm text-[10px] font-bold uppercase tracking-wider">{labels.statusSuccess}</span>;
    if (s === 'failure')
      return <span className="px-2 py-0.5 rounded-full bg-salmon/10 text-salmon text-[10px] font-bold uppercase tracking-wider">{labels.statusFailure}</span>;
    return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider">{labels.statusUnknown}</span>;
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-charcoal">{labels.title}</h3>
          <p className="text-xs text-gray-500 mt-1">{labels.subtitle}</p>
        </div>
        <Button onClick={() => setShowForm(true)}>{labels.create}</Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : hooks.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-8">{labels.none}</p>
      ) : (
        <div className="space-y-3">
          {hooks.map((h) => (
            <div key={h.id} className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-charcoal truncate">{h.name}</p>
                    {statusPill(h.lastStatus)}
                  </div>
                  <p className="text-xs text-gray-500 font-mono truncate" dir="ltr">
                    {h.url}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleTest(h.id)}
                    disabled={testingId === h.id}
                    className="text-xs font-bold text-[#8A1538] hover:text-[#5f0e26] uppercase tracking-wider disabled:opacity-50"
                  >
                    {labels.test}
                  </button>
                  <button
                    onClick={() => setPendingDelete(h.id)}
                    className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider"
                  >
                    {labels.delete}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {h.events.map((ev) => (
                  <span key={ev} className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    {ev}
                  </span>
                ))}
              </div>
              {testResponse?.id === h.id && (
                <div
                  className={`mt-3 text-xs font-bold p-2 rounded ${
                    testResponse.ok ? 'bg-palm/5 text-palm' : 'bg-salmon/5 text-salmon'
                  }`}
                >
                  {testResponse.message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
            <h3 className="text-xl font-display font-bold text-charcoal mb-6">{labels.create}</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.name}</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.url}</label>
                <input
                  type="url"
                  required
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://example.com/hooks/cadence"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.events}</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_EVENTS.map((ev) => (
                    <label
                      key={ev}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                        form.events.includes(ev)
                          ? 'border-[#8A1538] bg-[#8A1538]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.events.includes(ev)}
                        onChange={() => toggleEvent(ev)}
                        className="rounded text-[#8A1538] focus:ring-[#8A1538]"
                      />
                      <span className="text-xs font-mono text-charcoal">{ev}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.secret}</label>
                <input
                  type="text"
                  value={form.secret}
                  onChange={(e) => setForm({ ...form, secret: e.target.value })}
                  placeholder="whsec_..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none font-mono"
                  dir="ltr"
                />
              </div>
              {error && (
                <div className="text-salmon text-xs font-bold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  {labels.cancel}
                </Button>
                <Button type="submit" loading={submitting} disabled={form.events.length === 0}>
                  {labels.save}
                </Button>
              </div>
            </form>
          </div>
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

export default WebhooksPanel;
