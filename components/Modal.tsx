import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  lang?: 'en' | 'ar';
  size?: 'sm' | 'md' | 'lg';
}

const SIZE: Record<string, string> = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, lang = 'en', size = 'md' }) => {
  const [isMobile, setIsMobile] = useState(false);
  const isRTL = lang === 'ar';

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const closeBtn = (
    <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-charcoal dark:hover:text-white p-2 -m-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" dir={isRTL ? 'rtl' : 'ltr'}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm"
          />
          {isMobile ? (
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              drag="y" dragConstraints={{ top: 0 }} dragElastic={0.2}
              onDragEnd={(_, info) => { if (info.offset.y > 100) onClose(); }}
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl p-6 shadow-xl max-h-[88vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-5" />
              {title && <h3 className="text-lg font-semibold text-charcoal dark:text-white mb-4">{title}</h3>}
              {children}
            </motion.div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.18 }}
                className={`pointer-events-auto w-full ${SIZE[size]} bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden`}
              >
                {title && (
                  <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-charcoal dark:text-white">{title}</h3>
                    {closeBtn}
                  </div>
                )}
                <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
              </motion.div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
