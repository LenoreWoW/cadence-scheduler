
import React from 'react';
import { shortcuts, shortcutManager } from '../services/keyboardShortcuts';
import { Button } from './Button';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  // Group by category
  const grouped = shortcuts.reduce((acc, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {} as Record<string, typeof shortcuts>);

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" aria-modal="true" role="dialog">
      <div className="flex items-center justify-center min-h-screen px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-middle bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full p-8 animate-scale-in">
          
          <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-6">
            <h3 className="text-2xl font-serif font-bold text-charcoal">Keyboard Shortcuts</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-charcoal p-2 rounded-full hover:bg-gray-100 transition-colors">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
             {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                   <h4 className="text-xs font-bold uppercase tracking-widest text-dune mb-4 border-b border-dune/10 pb-2">{category}</h4>
                   <ul className="space-y-3">
                      {items.map(item => (
                         <li key={item.action} className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{item.description}</span>
                            <div className="flex gap-1">
                               {item.key.split(' ').map((k, i) => (
                                  <kbd key={i}>{k}</kbd>
                               ))}
                            </div>
                         </li>
                      ))}
                   </ul>
                </div>
             ))}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
             <div className="text-xs text-gray-400">
                Press <kbd>?</kbd> to toggle this dialog
             </div>
             <Button variant="primary" onClick={onClose}>Done</Button>
          </div>

        </div>
      </div>
    </div>
  );
};
