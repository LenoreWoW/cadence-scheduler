import React from 'react';
import { tourService } from '../services/tourService';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: (key: string) => string;
  lang: 'en' | 'ar';
  role: string;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, t, lang, role }) => {
  if (!isOpen) return null;
  const isRTL = lang === 'ar';

  const sections: Array<{ title: string; body: string }> = [
    { title: 'helpRolesTitle', body: 'helpRolesBody' },
    { title: 'helpSchedulingTitle', body: 'helpSchedulingBody' },
    { title: 'helpApprovalsTitle', body: 'helpApprovalsBody' },
    { title: 'helpColorsTitle', body: 'helpColorsBody' },
    { title: 'helpTentativeTitle', body: 'helpTentativeBody' },
    { title: 'helpBookingLinksTitle', body: 'helpBookingLinksBody' },
    { title: 'helpShortcutsTitle', body: 'helpShortcutsBody' },
  ];

  const launch = (tourId: string) => {
    tourService.resetTour(tourId);
    tourService.startTour(tourId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" role="dialog" aria-modal="true" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" aria-hidden="true" onClick={onClose}></div>
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-serif font-bold text-charcoal dark:text-white">{t('helpTitle')}</h2>
            <button onClick={onClose} aria-label={t('helpClose')} className="text-gray-400 hover:text-charcoal dark:hover:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="overflow-y-auto px-6 py-5 space-y-5">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('helpIntro')}</p>
            {sections.map((s) => (
              <div key={s.title}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-dune mb-1">{t(s.title)}</h3>
                <p className="text-sm text-charcoal dark:text-gray-200 leading-relaxed">{t(s.body)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4 flex flex-wrap gap-2">
            <button onClick={() => launch('welcome')} className="px-4 py-2 bg-al-adaam text-white text-sm font-bold rounded-lg hover:bg-al-adaam-dark transition-colors">
              {t('helpStartTour')}
            </button>
            <button onClick={() => launch('shortcuts')} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-charcoal dark:text-white text-sm font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              {t('helpStartShortcuts')}
            </button>
            {role === 'admin' && (
              <button onClick={() => launch('admin')} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-charcoal dark:text-white text-sm font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                {t('helpStartAdmin')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
