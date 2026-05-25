import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'cadence_cookies_accepted';

interface CookieBannerProps {
  lang?: 'en' | 'ar';
}

/**
 * CookieBanner
 *
 * Small fixed bottom-right banner shown until the user clicks "Accept".
 * Persists the choice in localStorage so it doesn't reappear on subsequent loads.
 */
export const CookieBanner: React.FC<CookieBannerProps> = ({ lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // Defer slightly so the banner animates in after first paint.
        const t = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage unavailable — just don't show.
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* noop */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={lang === 'ar' ? 'إشعار ملفات تعريف الارتباط' : 'Cookie notice'}
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`fixed z-[60] bottom-4 ${isRTL ? 'left-4' : 'right-4'} max-w-sm bg-white border border-gray-200 rounded-2xl shadow-2xl shadow-black/10 p-5 animate-slide-up`}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-[#8A1538]/10 text-[#8A1538] flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-charcoal mb-1">
            {lang === 'ar' ? 'نحن نستخدم ملفات تعريف الارتباط' : 'We use cookies'}
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            {lang === 'ar'
              ? 'نستخدم ملفات تعريف الارتباط الأساسية للمصادقة وحفظ تفضيلاتك. لا نستخدم ملفات إعلانية.'
              : 'We use essential cookies for sign-in and saving your preferences. We do not use advertising cookies.'}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <a
          href="/privacy"
          className="text-xs font-bold text-gray-500 hover:text-[#8A1538] underline underline-offset-2 transition-colors"
        >
          {lang === 'ar' ? 'اقرأ المزيد' : 'Learn more'}
        </a>
        <button
          onClick={accept}
          className="px-5 py-2 bg-[#8A1538] hover:bg-[#5f0e26] text-white text-xs font-bold uppercase tracking-wider rounded-full transition-colors shadow-md shadow-[#8A1538]/20"
        >
          {lang === 'ar' ? 'موافق' : 'Accept'}
        </button>
      </div>
    </div>
  );
};

export default CookieBanner;
