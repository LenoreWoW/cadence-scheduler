
import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  type: 'dashboard' | 'search' | 'appointments' | 'team';
  title: string;
  subtitle: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ type, title, subtitle, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      {/* Abstract Geometric Representation */}
      <div className="relative w-48 h-48 mb-8">
        <div className="absolute inset-0 flex items-center justify-center">
           {/* Layered Shapes Animation */}
           <div className={`w-32 h-32 rounded-full border-4 border-dune/20 animate-[spin_10s_linear_infinite] ${type === 'dashboard' ? '' : 'hidden'}`}></div>
           <div className={`absolute w-24 h-24 border-2 border-al-adaam/30 rotate-45 animate-[pulse_3s_ease-in-out_infinite] ${type === 'dashboard' ? '' : 'hidden'}`}></div>
           
           {type === 'appointments' && (
             <>
               <div className="w-20 h-32 border-2 border-dune/30 rounded-lg animate-[bounce_3s_infinite]"></div>
               <div className="absolute w-12 h-1 bg-al-adaam/40 rounded-full top-1/2 -translate-y-4"></div>
               <div className="absolute w-12 h-1 bg-dune/20 rounded-full top-1/2"></div>
               <div className="absolute w-8 h-1 bg-dune/20 rounded-full top-1/2 translate-y-4"></div>
             </>
           )}

           {type === 'search' && (
             <div className="relative">
                <div className="w-16 h-16 border-4 border-al-adaam/40 rounded-full animate-[ping_2s_infinite_reverse]"></div>
                <div className="absolute -bottom-4 -right-4 w-8 h-2 bg-dune/40 rotate-45 rounded-full"></div>
             </div>
           )}
           
           {type === 'team' && (
             <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-dune/20 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-8 h-8 rounded-full bg-al-adaam/20 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-8 h-8 rounded-full bg-dune/20 animate-bounce" style={{ animationDelay: '300ms' }}></div>
             </div>
           )}
        </div>
      </div>

      <h3 className="text-2xl font-serif font-medium text-charcoal mb-2">{title}</h3>
      <p className="text-dune text-sm max-w-xs mb-8 font-medium">{subtitle}</p>
      
      {action && (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};
