import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
  isRTL: boolean;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove, isRTL }) => {
  return (
    <div className={`fixed bottom-6 ${isRTL ? 'left-6' : 'right-6'} z-[1000] flex flex-col-reverse gap-3 pointer-events-none`}>
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onRemove={onRemove} isRTL={isRTL} />
      ))}
    </div>
  );
};

const Toast: React.FC<ToastMessage & { onRemove: (id: string) => void, isRTL: boolean }> = ({ 
  id, type, message, onRemove, isRTL 
}) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(id), 200);
    }, 5000);
    return () => clearTimeout(timer);
  }, [id, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(id), 200);
  };

  const styles = {
    success: {
      border: 'border-l-palm',
      bgIcon: 'bg-palm/10',
      textIcon: 'text-palm',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      )
    },
    error: {
      border: 'border-l-salmon',
      bgIcon: 'bg-salmon/10',
      textIcon: 'text-salmon',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      )
    },
    info: {
      border: 'border-l-sea',
      bgIcon: 'bg-sea/10',
      textIcon: 'text-sea',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      )
    },
    warning: {
      border: 'border-l-yellow-accent',
      bgIcon: 'bg-yellow-accent/10',
      textIcon: 'text-yellow-accent',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
      )
    }
  };

  const style = styles[type] || styles.info;

  return (
    <div 
      className={`pointer-events-auto bg-white shadow-xl rounded-lg flex items-start p-4 min-w-[340px] max-w-sm border-l-4 ${style.border} transition-all duration-300 ${isExiting ? 'opacity-0 translate-x-full' : 'animate-toast-in'}`}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${style.bgIcon} ${style.textIcon} ${isRTL ? 'ml-3' : 'mr-3'}`}>
        {style.icon}
      </div>
      <div className="flex-1 pt-1">
         <p className="text-sm font-medium text-charcoal leading-tight">{message}</p>
      </div>
      <button onClick={handleClose} className="opacity-40 hover:opacity-100 transition-opacity ml-4 text-dune p-1 hover:bg-gray-100 rounded">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
      
      {/* Progress Bar */}
      <div className={`absolute bottom-0 left-0 h-0.5 bg-current opacity-20 ${style.textIcon} rounded-bl-lg`} style={{ 
        width: '100%',
        animation: 'progress 5s linear forwards',
        transformOrigin: isRTL ? 'right' : 'left'
      }}>
        <style>{`
          @keyframes progress {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
          }
        `}</style>
      </div>
    </div>
  );
};
