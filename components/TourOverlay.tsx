import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { tourService, TourStep } from '../services/tourService';
import { createPortal } from 'react-dom';

const SpotlightOverlay: React.FC<{ target: string }> = ({ target }) => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const updateRect = () => {
      const element = document.querySelector(target);
      if (element) {
        setRect(element.getBoundingClientRect());
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    
    // Check periodically for layout changes
    const interval = setInterval(updateRect, 500);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      clearInterval(interval);
    };
  }, [target]);

  if (!rect) return null;

  return (
    <>
      <svg className="fixed inset-0 w-full h-full pointer-events-none z-[9998]">
        <defs>
          <mask id="spotlight-mask">
            <rect className="w-full h-full fill-white" />
            <rect 
              x={rect.left - 4} 
              y={rect.top - 4} 
              width={rect.width + 8} 
              height={rect.height + 8} 
              rx="8" 
              className="fill-black" 
            />
          </mask>
        </defs>
        <rect className="w-full h-full fill-black/60" mask="url(#spotlight-mask)" />
        
        {/* Glow ring */}
        <rect 
          x={rect.left - 4} 
          y={rect.top - 4} 
          width={rect.width + 8} 
          height={rect.height + 8} 
          rx="8"
          className="fill-none stroke-al-adaam stroke-2 animate-pulse"
        />
      </svg>
    </>
  );
};

interface TourTooltipProps {
  step: TourStep;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  currentIndex: number;
  totalSteps: number;
}

const TourTooltip: React.FC<TourTooltipProps> = ({ 
  step, 
  onNext, 
  onPrev, 
  onSkip, 
  currentIndex, 
  totalSteps 
}) => {
  const [position, setPosition] = useState<{ top: number, left: number }>({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      const element = document.querySelector(step.target);
      if (element && tooltipRef.current) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const padding = 20;

        let top = 0;
        let left = 0;

        switch (step.position) {
          case 'top':
            top = rect.top - tooltipRect.height - padding;
            left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            break;
          case 'bottom':
            top = rect.bottom + padding;
            left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            break;
          case 'left':
            top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
            left = rect.left - tooltipRect.width - padding;
            break;
          case 'right':
            top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
            left = rect.right + padding;
            break;
          case 'center':
            top = (window.innerHeight / 2) - (tooltipRect.height / 2);
            left = (window.innerWidth / 2) - (tooltipRect.width / 2);
            break;
        }

        // Keep within viewport
        const margin = 20;
        left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
        top = Math.max(margin, Math.min(top, window.innerHeight - tooltipRect.height - margin));

        setPosition({ top, left });
      } else if (step.position === 'center' && tooltipRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        setPosition({
          top: (window.innerHeight / 2) - (tooltipRect.height / 2),
          left: (window.innerWidth / 2) - (tooltipRect.width / 2)
        });
      }
    };

    // Need small delay for layout to stabilize
    const timer = setTimeout(updatePosition, 50);
    window.addEventListener('resize', updatePosition);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
    };
  }, [step]);

  const isRTL = document.dir === 'rtl';

  return (
    <motion.div
      ref={tooltipRef}
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      transition={{ duration: 0.2 }}
      style={{ top: position.top, left: position.left }}
      className="fixed z-[9999] w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 p-6"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-bold text-charcoal dark:text-white">
          {isRTL ? step.titleAr : step.title}
        </h3>
        <button 
          onClick={onSkip}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
        {isRTL ? step.contentAr : step.content}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400 font-medium">
          {currentIndex + 1} / {totalSteps}
        </span>
        
        <div className="flex gap-2">
          {currentIndex > 0 && (
            <button
              onClick={onPrev}
              className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-charcoal dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              {isRTL ? 'السابق' : 'Back'}
            </button>
          )}
          <button
            onClick={onNext}
            className="px-4 py-1.5 text-sm font-bold text-white bg-al-adaam hover:bg-al-adaam-dark rounded-lg shadow-lg shadow-al-adaam/20 transition-all transform hover:scale-105"
          >
            {currentIndex === totalSteps - 1 
              ? (isRTL ? 'إنهاء' : 'Finish') 
              : (isRTL ? 'التالي' : 'Next')}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export const TourOverlay: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<TourStep | null>(null);
  
  useEffect(() => {
    // Initial sync
    setCurrentStep(tourService.getCurrentStep());

    return tourService.subscribe(() => {
      const step = tourService.getCurrentStep();
      setCurrentStep(step);
      
      // Auto-scroll to target
      if (step) {
        setTimeout(() => {
          const element = document.querySelector(step.target);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    });
  }, []);
  
  if (!currentStep) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div className="pointer-events-auto">
        <SpotlightOverlay target={currentStep.target} />
        
        <AnimatePresence mode="wait">
          <TourTooltip
            key={currentStep.id}
            step={currentStep}
            onNext={() => tourService.nextStep()}
            onPrev={() => tourService.prevStep()}
            onSkip={() => tourService.dismissTour()}
            currentIndex={tourService.getCurrentStepIndex()}
            totalSteps={tourService.getTotalSteps()}
          />
        </AnimatePresence>
      </div>
    </div>,
    document.body
  );
};

