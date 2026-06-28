import React from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

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
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} lang={isRTL ? 'ar' : 'en'} size="sm">
      <div className={`sm:flex sm:items-start ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-salmon/10 sm:mx-0 sm:h-10 sm:w-10 ${isRTL ? 'sm:ml-4' : 'sm:mr-4'}`}>
          <svg className="h-6 w-6 text-salmon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className={`mt-3 text-center sm:mt-0 ${isRTL ? 'sm:text-right' : 'sm:text-left'} w-full`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {message}
          </p>
        </div>
      </div>
      <div className="mt-6 sm:flex sm:flex-row-reverse gap-3">
        <Button variant="danger" onClick={onConfirm} className="w-full sm:w-auto">
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onClose} className="mt-3 w-full sm:w-auto sm:mt-0">
          {cancelLabel}
        </Button>
      </div>
    </Modal>
  );
};
