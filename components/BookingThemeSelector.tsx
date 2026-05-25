/**
 * BookingThemeSelector
 *
 * Per-link theme selector (system / light / dark) plus a "hide details on
 * embed" toggle.
 *
 * PUT /api/booking-links/:id   { theme, hideDetails }
 */

import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

type Theme = 'system' | 'light' | 'dark';

interface BookingLinkLike {
  id: string;
  theme?: Theme | null;
  hideDetails?: boolean | null;
  hide_details?: boolean | null;
}

interface Props {
  link: BookingLinkLike;
  onChange?: () => void;
  lang?: 'en' | 'ar';
}

export const BookingThemeSelector: React.FC<Props> = ({ link, onChange, lang = 'en' }) => {
  const isRTL = lang === 'ar';

  const [theme, setTheme] = useState<Theme>(link.theme || 'system');
  const [hideDetails, setHideDetails] = useState<boolean>(
    !!(link.hideDetails ?? link.hide_details),
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  );

  useEffect(() => {
    setTheme(link.theme || 'system');
    setHideDetails(!!(link.hideDetails ?? link.hide_details));
  }, [link.id, link.theme, link.hideDetails, link.hide_details]);

  const handleSave = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      await apiJson(`/api/booking-links/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, hideDetails }),
      });
      setMessage({ kind: 'success', text: isRTL ? 'تم الحفظ' : 'Saved' });
      onChange?.();
    } catch (err: any) {
      setMessage({
        kind: 'error',
        text:
          err?.body?.error ||
          err?.message ||
          (isRTL ? 'فشل الحفظ' : 'Failed to save'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const themeLabel = (t: Theme): string => {
    if (t === 'light') return isRTL ? 'فاتح' : 'Light';
    if (t === 'dark') return isRTL ? 'داكن' : 'Dark';
    return isRTL ? 'نظام' : 'System';
  };

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">
          {isRTL ? 'المظهر' : 'Appearance'}
        </h4>
        <p className="text-xs text-gray-500 mt-1">
          {isRTL
            ? 'يتحكم في مظهر صفحة الحجز العامة وعرض الإطار المضمّن.'
            : 'Controls how the public page and embed look to bookers.'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(['system', 'light', 'dark'] as Theme[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
              theme === t
                ? 'bg-[#8A1538] text-white border-[#8A1538]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {themeLabel(t)}
          </button>
        ))}
      </div>

      <label className="flex items-start gap-3 pt-2 cursor-pointer">
        <input
          type="checkbox"
          checked={hideDetails}
          onChange={(e) => setHideDetails(e.target.checked)}
          className="mt-1 rounded text-[#8A1538] focus:ring-[#8A1538]"
        />
        <div>
          <p className="text-sm font-bold text-charcoal">
            {isRTL ? 'إخفاء تفاصيل نوع الحدث في الإطار المضمّن' : 'Hide event-type details on embed'}
          </p>
          <p className="text-xs text-gray-500">
            {isRTL
              ? 'عند تضمين الرابط بـ ?embed=1 سيظهر منتقي الفترات فقط.'
              : 'When embedded with ?embed=1, show only the slot picker — no header.'}
          </p>
        </div>
      </label>

      <div className="flex items-center justify-between">
        {message && (
          <span
            className={`text-xs font-bold ${
              message.kind === 'success' ? 'text-palm' : 'text-salmon'
            }`}
          >
            {message.text}
          </span>
        )}
        <Button onClick={handleSave} loading={submitting} variant="secondary" className="ml-auto">
          {isRTL ? 'حفظ المظهر' : 'Save appearance'}
        </Button>
      </div>
    </div>
  );
};

export default BookingThemeSelector;
