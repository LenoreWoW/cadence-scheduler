
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  interactive?: boolean;
  selected?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  interactive = false, 
  selected = false, 
  className = '', 
  onClick 
}) => {
  return (
    <div 
      className={`
        card 
        ${interactive ? 'card--interactive cursor-pointer' : ''} 
        ${selected ? 'card--selected' : ''} 
        ${className}
      `}
      onClick={interactive ? onClick : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-al-adaam rounded-full flex items-center justify-center animate-pop-in z-10">
           <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
        </div>
      )}
      {children}
    </div>
  );
};
