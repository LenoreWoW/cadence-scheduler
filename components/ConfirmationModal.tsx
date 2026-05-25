import React from 'react';
import { Button } from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isRTL: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isRTL
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        
        <div 
          className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm transition-opacity" 
          aria-hidden="true"
          onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className={`inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full ${isRTL ? 'text-right' : 'text-left'}`}>
          <div className="bg-white px-6 pt-6 pb-6">
            <div className={`sm:flex sm:items-start ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
              <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-salmon/10 sm:mx-0 sm:h-10 sm:w-10 ${isRTL ? 'sm:ml-4' : 'sm:mr-4'}`}>
                <svg className="h-6 w-6 text-salmon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className={`mt-3 text-center sm:mt-0 ${isRTL ? 'sm:text-right' : 'sm:text-left'} w-full`}>
                <h3 className="text-lg leading-6 font-bold text-charcoal" id="modal-title">
                  {title}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    {message}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-4 sm:flex sm:flex-row-reverse gap-3">
            <Button variant="danger" onClick={onConfirm} className={`w-full sm:w-auto`}>
              {confirmLabel}
            </Button>
            <Button variant="secondary" onClick={onClose} className="mt-3 w-full sm:w-auto sm:mt-0">
              {cancelLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};