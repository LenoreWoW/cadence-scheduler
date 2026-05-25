import React, { useState } from 'react';
import { Button } from './Button';

interface EmbedSnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  lang?: 'en' | 'ar';
}

/**
 * EmbedSnippetModal
 *
 * Given a booking-link slug, builds the two snippets a user can copy to embed
 * the booking page on their own site: an iframe and a vendored script tag.
 */
export const EmbedSnippetModal: React.FC<EmbedSnippetModalProps> = ({ isOpen, onClose, slug, lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [tab, setTab] = useState<'iframe' | 'script'>('iframe');
  const [copied, setCopied] = useState<'iframe' | 'script' | null>(null);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const apiUrl = (import.meta.env?.VITE_API_URL as string | undefined) || 'http://localhost:3001';

  const iframeSnippet = `<iframe src="${origin}/book/${slug}" width="100%" height="650" frameborder="0"></iframe>`;
  const scriptSnippet = `<script src="${apiUrl}/api/embed/widget.js" data-slug="${slug}"></script>`;

  const copy = async (which: 'iframe' | 'script') => {
    const text = which === 'iframe' ? iframeSnippet : scriptSnippet;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied((curr) => (curr === which ? null : curr)), 1800);
    } catch {
      /* swallow — clipboard may be unavailable in some browsers */
    }
  };

  const labels = {
    title: lang === 'ar' ? 'تضمين رابط الحجز' : 'Embed booking link',
    subtitle: lang === 'ar' ? 'انسخ الكود وألصقه في موقعك.' : 'Copy the snippet and paste it on your site.',
    iframe: lang === 'ar' ? 'إطار' : 'iframe',
    script: lang === 'ar' ? 'نص برمجي' : 'script tag',
    copy: lang === 'ar' ? 'نسخ' : 'Copy',
    copied: lang === 'ar' ? 'تم النسخ!' : 'Copied!',
    close: lang === 'ar' ? 'إغلاق' : 'Close',
    iframeHint:
      lang === 'ar'
        ? 'يعمل في أي صفحة HTML. اضبط العرض والارتفاع حسب الحاجة.'
        : 'Works on any HTML page. Adjust width and height as needed.',
    scriptHint:
      lang === 'ar'
        ? 'يحقن وحدة الحجز ذاتيًا عند تحميل البرنامج النصي.'
        : 'Auto-injects the booking widget when the script loads.',
  };

  const activeSnippet = tab === 'iframe' ? iframeSnippet : scriptSnippet;
  const activeHint = tab === 'iframe' ? labels.iframeHint : labels.scriptHint;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-display font-bold text-charcoal">{labels.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{labels.subtitle}</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-charcoal p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label={labels.close}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="mt-6 flex items-center gap-1 bg-gray-100 rounded-full p-1 w-fit">
              {(['iframe', 'script'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setTab(opt)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                    tab === opt ? 'bg-white text-charcoal shadow-sm' : 'text-gray-500 hover:text-charcoal'
                  }`}
                >
                  {opt === 'iframe' ? labels.iframe : labels.script}
                </button>
              ))}
            </div>
          </div>

          <div className="px-8 py-6 space-y-4">
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 text-xs font-mono p-5 rounded-xl overflow-x-auto leading-relaxed whitespace-pre-wrap break-all" dir="ltr">
                {activeSnippet}
              </pre>
              <button
                onClick={() => copy(tab)}
                className="absolute top-3 right-3 px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider rounded-md transition-all"
                aria-label={labels.copy}
              >
                {copied === tab ? labels.copied : labels.copy}
              </button>
            </div>
            <p className="text-xs text-gray-400 font-mono">{activeHint}</p>
          </div>

          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              {labels.close}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbedSnippetModal;
