import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { ConfirmationModal } from './ConfirmationModal';
import { apiJson } from '../services/api';

export type PixelProvider = 'ga4' | 'gtm' | 'posthog' | 'fathom' | 'plausible';

export interface AnalyticsPixel {
  id: string;
  provider: PixelProvider;
  trackingId: string;
}

interface Props {
  linkId: string;
  lang?: 'en' | 'ar';
}

/**
 * AnalyticsPixelsEditor
 *
 * Manage per-booking-link analytics pixels. The public booking page injects
 * the right script tag at render time based on these entries.
 */
export const AnalyticsPixelsEditor: React.FC<Props> = ({ linkId, lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [pixels, setPixels] = useState<AnalyticsPixel[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<PixelProvider>('ga4');
  const [trackingId, setTrackingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<AnalyticsPixel[]>(`/api/analytics-pixels/links/${linkId}`);
      setPixels(Array.isArray(data) ? data : []);
    } catch {
      setPixels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!trackingId.trim()) return;
    setSubmitting(true);
    try {
      await apiJson(`/api/analytics-pixels/links/${linkId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, trackingId: trackingId.trim() }),
      });
      setTrackingId('');
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
      await apiJson(`/api/analytics-pixels/${pendingDelete}`, { method: 'DELETE' });
      setPixels((xs) => xs.filter((x) => x.id !== pendingDelete));
    } finally {
      setPendingDelete(null);
    }
  };

  const placeholderFor = (p: PixelProvider): string => {
    switch (p) {
      case 'ga4':
        return 'G-XXXXXXXXXX';
      case 'gtm':
        return 'GTM-XXXXXXX';
      case 'posthog':
        return 'phc_xxx';
      case 'fathom':
        return 'XXXXXXX (site id)';
      case 'plausible':
        return 'yourdomain.com';
    }
  };

  const labels = {
    title: lang === 'ar' ? 'بكسلات التحليلات' : 'Analytics pixels',
    subtitle:
      lang === 'ar'
        ? 'تتبع زيارات صفحة الحجز.'
        : 'Track visits to this booking page.',
    provider: lang === 'ar' ? 'المزود' : 'Provider',
    trackingId: lang === 'ar' ? 'مُعرّف التتبع' : 'Tracking ID',
    add: lang === 'ar' ? 'إضافة' : 'Add',
    delete: lang === 'ar' ? 'حذف' : 'Remove',
    none: lang === 'ar' ? 'لا توجد بكسلات.' : 'No pixels configured.',
    confirmDelete: lang === 'ar' ? 'حذف هذا البكسل؟' : 'Remove this pixel?',
    confirmDeleteMsg: lang === 'ar' ? 'لن يُحقن بعد ذلك.' : 'It will no longer be injected.',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
  };

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">{labels.title}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{labels.subtitle}</p>
      </div>

      <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
        <div className="md:col-span-3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.provider}</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as PixelProvider)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#8A1538]"
          >
            <option value="ga4">GA4</option>
            <option value="gtm">GTM</option>
            <option value="posthog">PostHog</option>
            <option value="fathom">Fathom</option>
            <option value="plausible">Plausible</option>
          </select>
        </div>
        <div className="md:col-span-7">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.trackingId}</label>
          <input
            type="text"
            required
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            placeholder={placeholderFor(provider)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538] font-mono"
            dir="ltr"
          />
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
      ) : pixels.length === 0 ? (
        <p className="text-sm text-gray-400 italic">{labels.none}</p>
      ) : (
        <div className="space-y-2">
          {pixels.map((p) => (
            <div
              key={p.id}
              className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-600 uppercase">
                  {p.provider}
                </span>
                <p className="text-sm font-mono text-charcoal truncate" dir="ltr">{p.trackingId}</p>
              </div>
              <button
                onClick={() => setPendingDelete(p.id)}
                className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider flex-shrink-0"
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

export default AnalyticsPixelsEditor;
