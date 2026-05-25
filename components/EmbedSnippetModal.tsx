import React, { useState } from 'react';
import { Button } from './Button';

interface EmbedSnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  lang?: 'en' | 'ar';
}

type EmbedMode = 'iframe' | 'script' | 'popup' | 'floating';

/**
 * EmbedSnippetModal
 *
 * Given a booking-link slug, builds four embed snippets the user can copy:
 *   1. iframe              — direct iframe embed
 *   2. script (auto-mount) — drops a <script> tag that auto-mounts the widget
 *   3. popup               — opens the widget in a modal when triggered
 *   4. floating button     — floating button anchored to a corner of the page
 *
 * The widget script (served at `${VITE_API_URL}/api/embed/widget.js`)
 * recognizes `data-mode` to switch between auto-mount, popup, and
 * floating-button behaviour. Backend ships the loader.
 */
export const EmbedSnippetModal: React.FC<EmbedSnippetModalProps> = ({ isOpen, onClose, slug, lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [tab, setTab] = useState<EmbedMode>('iframe');
  const [copied, setCopied] = useState<EmbedMode | null>(null);
  const [floatingPosition, setFloatingPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>('bottom-right');

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const apiUrl = (import.meta.env?.VITE_API_URL as string | undefined) || 'http://localhost:3001';
  const widgetSrc = `${apiUrl}/api/embed/widget.js`;

  const iframeSnippet = `<iframe src="${origin}/book/${slug}" width="100%" height="650" frameborder="0"></iframe>`;
  const scriptSnippet = `<script src="${widgetSrc}" data-slug="${slug}"></script>`;
  // Note: the loader at /api/embed/widget.js recognizes `data-mode` (auto-mount/popup/floating-button)
  const popupSnippet = `<button data-cadence-popup data-slug="${slug}">Book a meeting</button>\n<script src="${widgetSrc}" data-mode="popup" data-slug="${slug}"></script>`;
  const floatingSnippet = `<script src="${widgetSrc}" data-mode="floating-button" data-slug="${slug}" data-position="${floatingPosition}"></script>`;

  const snippets: Record<EmbedMode, string> = {
    iframe: iframeSnippet,
    script: scriptSnippet,
    popup: popupSnippet,
    floating: floatingSnippet,
  };

  const copy = async (which: EmbedMode) => {
    try {
      await navigator.clipboard.writeText(snippets[which]);
      setCopied(which);
      setTimeout(() => setCopied((curr) => (curr === which ? null : curr)), 1800);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  const labels = {
    title: lang === 'ar' ? 'تضمين رابط الحجز' : 'Embed booking link',
    subtitle: lang === 'ar' ? 'انسخ الكود وألصقه في موقعك.' : 'Copy the snippet and paste it on your site.',
    iframe: lang === 'ar' ? 'إطار' : 'iframe',
    script: lang === 'ar' ? 'نص (تثبيت ذاتي)' : 'script (auto-mount)',
    popup: lang === 'ar' ? 'نافذة منبثقة' : 'popup',
    floating: lang === 'ar' ? 'زر عائم' : 'floating button',
    copy: lang === 'ar' ? 'نسخ' : 'Copy',
    copied: lang === 'ar' ? 'تم النسخ!' : 'Copied!',
    close: lang === 'ar' ? 'إغلاق' : 'Close',
    position: lang === 'ar' ? 'الموقع' : 'Position',
    preview: lang === 'ar' ? 'معاينة' : 'Preview',
    hints: {
      iframe: lang === 'ar' ? 'يعمل في أي صفحة HTML.' : 'Works on any HTML page.',
      script: lang === 'ar' ? 'يحقن وحدة الحجز ذاتيًا.' : 'Auto-injects the booking widget where the script sits.',
      popup: lang === 'ar' ? 'يفتح الحجز في نافذة منبثقة عند الضغط.' : 'Opens the booking flow in a modal when clicked.',
      floating: lang === 'ar' ? 'يضع زراً عائماً في الزاوية.' : 'Sticks a floating button to a corner of the page.',
    },
  };

  const tabs: { id: EmbedMode; label: string }[] = [
    { id: 'iframe', label: labels.iframe },
    { id: 'script', label: labels.script },
    { id: 'popup', label: labels.popup },
    { id: 'floating', label: labels.floating },
  ];

  const positions: { id: typeof floatingPosition; classes: string }[] = [
    { id: 'top-left', classes: 'top-2 left-2' },
    { id: 'top-right', classes: 'top-2 right-2' },
    { id: 'bottom-left', classes: 'bottom-2 left-2' },
    { id: 'bottom-right', classes: 'bottom-2 right-2' },
  ];

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
            <div className="mt-6 flex items-center gap-1 bg-gray-100 rounded-full p-1 w-fit flex-wrap">
              {tabs.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setTab(opt.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                    tab === opt.id ? 'bg-white text-charcoal shadow-sm' : 'text-gray-500 hover:text-charcoal'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-8 py-6 space-y-4">
            {tab === 'floating' && (
              <div className="flex items-center gap-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{labels.position}:</label>
                <select
                  value={floatingPosition}
                  onChange={(e) => setFloatingPosition(e.target.value as any)}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                >
                  <option value="bottom-right">bottom-right</option>
                  <option value="bottom-left">bottom-left</option>
                  <option value="top-right">top-right</option>
                  <option value="top-left">top-left</option>
                </select>
              </div>
            )}

            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 text-xs font-mono p-5 rounded-xl overflow-x-auto leading-relaxed whitespace-pre-wrap break-all" dir="ltr">
                {snippets[tab]}
              </pre>
              <button
                onClick={() => copy(tab)}
                className="absolute top-3 right-3 px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider rounded-md transition-all"
                aria-label={labels.copy}
              >
                {copied === tab ? labels.copied : labels.copy}
              </button>
            </div>
            <p className="text-xs text-gray-400 font-mono">{labels.hints[tab]}</p>

            {/* Live preview */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.preview}</p>
              <div className="relative bg-gray-50 border border-dashed border-gray-200 rounded-lg h-48 overflow-hidden">
                {tab === 'iframe' && (
                  <div className="absolute inset-3 bg-white rounded-md border border-gray-200 flex items-center justify-center text-[10px] text-gray-400 font-mono">
                    iframe → /book/{slug}
                  </div>
                )}
                {tab === 'script' && (
                  <div className="absolute inset-3 bg-white rounded-md border border-gray-200 flex flex-col items-center justify-center gap-1 text-[10px] text-gray-400 font-mono">
                    <span className="text-charcoal">[ Cadence widget ]</span>
                    <span>auto-mount on page load</span>
                  </div>
                )}
                {tab === 'popup' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      type="button"
                      className="px-4 py-2 bg-[#8A1538] text-white text-xs font-bold uppercase tracking-wider rounded-md shadow-md"
                    >
                      Book a meeting
                    </button>
                  </div>
                )}
                {tab === 'floating' && (
                  <div
                    className={`absolute ${positions.find((p) => p.id === floatingPosition)?.classes} w-12 h-12 rounded-full bg-[#8A1538] text-white flex items-center justify-center shadow-lg`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
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
