
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: {
    id: string;
    label: string;
    icon?: React.ReactNode;
    shortcut?: string;
    action: () => void;
    category?: string;
  }[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, actions }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredActions = actions.filter(action => 
    action.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredActions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        filteredActions[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Group by category
  const grouped = filteredActions.reduce((acc, action) => {
    const cat = action.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(action);
    return acc;
  }, {} as Record<string, typeof actions>);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4" onClick={onClose}>
      <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm transition-opacity"></div>
      
      <div 
        className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden animate-scale-in border border-gray-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-gray-100">
          <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-base text-charcoal placeholder-gray-400 h-6"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          <div className="flex gap-2">
             <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-medium text-gray-500 bg-gray-100 rounded border border-gray-200">ESC</kbd>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          {Object.keys(grouped).length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">No commands found.</div>
          )}

          {Object.entries(grouped).map(([category, catActions]) => (
            <div key={category} className="mb-2">
              <div className="px-4 py-1 text-[10px] font-bold text-dune uppercase tracking-widest bg-gray-50/50">{category}</div>
              {catActions.map((action) => {
                // Find global index for highlighting
                const globalIndex = filteredActions.indexOf(action);
                const isSelected = globalIndex === selectedIndex;
                
                return (
                  <button
                    key={action.id}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${isSelected ? 'bg-al-adaam/5 text-al-adaam' : 'text-charcoal hover:bg-gray-50'}`}
                    onClick={() => { action.action(); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  >
                    <div className="flex items-center gap-3">
                      {action.icon ? (
                        <span className={isSelected ? 'text-al-adaam' : 'text-gray-400'}>{action.icon}</span>
                      ) : (
                        <div className={`w-4 h-4 rounded-full border ${isSelected ? 'border-al-adaam' : 'border-gray-300'}`}></div>
                      )}
                      <span className={`text-sm ${isSelected ? 'font-medium' : ''}`}>{action.label}</span>
                    </div>
                    {action.shortcut && (
                      <kbd className={`px-2 py-0.5 text-[10px] font-mono rounded ${isSelected ? 'bg-al-adaam/10 text-al-adaam' : 'bg-gray-100 text-gray-400'}`}>
                        {action.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400">
           <div className="flex gap-3">
              <span><span className="font-bold text-gray-600">↑↓</span> to navigate</span>
              <span><span className="font-bold text-gray-600">↵</span> to select</span>
           </div>
           <span>Cadence</span>
        </div>
      </div>
    </div>
  );
};