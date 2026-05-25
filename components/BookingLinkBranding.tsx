import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

interface BookingLink {
  id: string;
  brandLogoUrl?: string | null;
  brandColor?: string | null;
  brandFont?: string | null;
  redirectUrlOnSuccess?: string | null;
}

interface Props {
  link: BookingLink;
  onChange?: () => void;
  lang?: 'en' | 'ar';
}

const FONT_OPTIONS = [
  'Inter',
  'System UI',
  'Helvetica',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Playfair Display',
];

/**
 * BookingLinkBranding
 *
 * Per-link branding overrides: logo, accent color, font, and a custom
 * redirect URL to send attendees to after a successful booking.
 */
export const BookingLinkBranding: React.FC<Props> = ({ link, onChange, lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [logoUrl, setLogoUrl] = useState(link.brandLogoUrl || '');
  const [color, setColor] = useState(link.brandColor || '#8A1538');
  const [font, setFont] = useState(link.brandFont || '');
  const [redirect, setRedirect] = useState(link.redirectUrlOnSuccess || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLogoUrl(link.brandLogoUrl || '');
    setColor(link.brandColor || '#8A1538');
    setFont(link.brandFont || '');
    setRedirect(link.redirectUrlOnSuccess || '');
  }, [link]);

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiJson(`/api/booking-links/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandLogoUrl: logoUrl.trim() || null,
          brandColor: color || null,
          brandFont: font || null,
          redirectUrlOnSuccess: redirect.trim() || null,
        }),
      });
      onChange?.();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'الهوية البصرية' : 'Branding',
    subtitle:
      lang === 'ar'
        ? 'خصص شكل صفحة الحجز.'
        : 'Customize how your booking page looks.',
    logo: lang === 'ar' ? 'رابط الشعار' : 'Logo URL',
    color: lang === 'ar' ? 'اللون الأساسي' : 'Brand color',
    font: lang === 'ar' ? 'الخط' : 'Font',
    redirect: lang === 'ar' ? 'تحويل بعد الحجز' : 'Redirect URL after success',
    save: lang === 'ar' ? 'حفظ' : 'Save',
  };

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">{labels.title}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{labels.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.logo}</label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
            dir="ltr"
          />
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              className="mt-2 max-h-12 object-contain"
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
          )}
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.color}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 border border-gray-200 rounded cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-[#8A1538]"
              dir="ltr"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.font}</label>
          <select
            value={font}
            onChange={(e) => setFont(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
          >
            <option value="">—</option>
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.redirect}</label>
          <input
            type="url"
            value={redirect}
            onChange={(e) => setRedirect(e.target.value)}
            placeholder="https://your-site.com/thanks"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
            dir="ltr"
          />
        </div>
      </div>

      {error && (
        <div className="text-salmon text-xs font-bold p-2 bg-salmon/5 border-l-2 border-salmon rounded-r">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="secondary" onClick={handleSave} loading={submitting}>
          {labels.save}
        </Button>
      </div>
    </div>
  );
};

export default BookingLinkBranding;
