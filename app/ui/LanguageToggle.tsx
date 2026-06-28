import React from 'react';
import { useI18n } from '../lib/i18n';

// Compact toggle that flips between English and Arabic. Shows the *target*
// language as its label (the language you'd switch to).
export const LanguageToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { lang, toggle, t } = useI18n();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('a11y.switchLanguage')}
      className={`ring-focus rounded-lg px-2.5 py-1.5 text-sm font-medium ${className}`}
    >
      {lang === 'en' ? 'العربية' : 'English'}
    </button>
  );
};
