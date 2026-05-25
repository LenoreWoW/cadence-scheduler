import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface MobileNavProps {
  currentView: string;
  onNavigate: (view: any) => void;
  pendingCount: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentView, onNavigate, pendingCount }) => {
  const [pressedId, setPressedId] = useState<string | null>(null);

  const navItems = [
    { 
      id: 'dashboard', 
      label: 'Home', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      activeIcon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.71 2.29a1 1 0 00-1.42 0l-9 9a1 1 0 000 1.42A1 1 0 003 13h1v7a2 2 0 002 2h12a2 2 0 002-2v-7h1a1 1 0 00.71-1.71l-9-9zM9 20v-5a1 1 0 011-1h4a1 1 0 011 1v5H9z"/>
        </svg>
      )
    },
    { 
      id: 'scheduler', 
      label: 'Book', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      ),
      activeIcon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm4 11h-3v3a1 1 0 01-2 0v-3H8a1 1 0 010-2h3V8a1 1 0 012 0v3h3a1 1 0 010 2z"/>
        </svg>
      ),
      highlight: true
    },
    { 
      id: 'my-meetings', 
      label: 'Meetings', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      activeIcon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 3H5a3 3 0 00-3 3v12a3 3 0 003 3h14a3 3 0 003-3V6a3 3 0 00-3-3zm-2 4H7a1 1 0 000 2h10a1 1 0 000-2zm0 4H7a1 1 0 000 2h10a1 1 0 000-2zm-4 4H7a1 1 0 000 2h6a1 1 0 000-2z"/>
        </svg>
      ),
      badge: true 
    },
    { 
      id: 'profile', 
      label: 'Profile', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      activeIcon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2a5 5 0 105 5 5 5 0 00-5-5zm0 8a3 3 0 113-3 3 3 0 01-3 3zm9 11v-1a7 7 0 00-7-7h-4a7 7 0 00-7 7v1a1 1 0 001 1h16a1 1 0 001-1z"/>
        </svg>
      )
    }
  ];

  const handlePress = (id: string) => {
    setPressedId(id);
    onNavigate(id);
    // Haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  return (
    <>
      {/* Spacer to prevent content from being hidden behind nav */}
      <div className="h-20 md:hidden" />
      
      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        {/* Glassmorphism background */}
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/90 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-700/50" />
        
        {/* Safe area padding for notched phones */}
        <div className="relative flex justify-around items-stretch h-16 pb-safe px-2">
          {navItems.map(item => {
            const isActive = currentView === item.id || (item.id === 'profile' && currentView === 'profile_modal');
            const isPressed = pressedId === item.id;
            
            return (
              <motion.button
                key={item.id}
                onClick={() => handlePress(item.id)}
                onTouchStart={() => setPressedId(item.id)}
                onTouchEnd={() => setTimeout(() => setPressedId(null), 150)}
                className={`
                  relative flex flex-col items-center justify-center flex-1 py-2 px-1
                  transition-all duration-200 ease-out
                  ${isActive ? 'text-al-adaam' : 'text-gray-400'}
                  ${item.highlight && !isActive ? 'text-al-adaam/70' : ''}
                `}
                whileTap={{ scale: 0.9 }}
                animate={{ 
                  scale: isPressed ? 0.9 : 1,
                  y: isActive ? -2 : 0
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                {/* Active indicator pill */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute -top-1 w-8 h-1 bg-al-adaam rounded-full"
                      layoutId="activeIndicator"
                    />
                  )}
                </AnimatePresence>
                
                {/* Icon container with highlight effect for "Book" */}
                <div className={`
                  relative flex items-center justify-center
                  ${item.highlight ? 'w-12 h-12 -mt-5 rounded-2xl shadow-lg' : 'w-8 h-8'}
                  ${item.highlight && isActive ? 'bg-al-adaam text-white shadow-al-adaam/40' : ''}
                  ${item.highlight && !isActive ? 'bg-gradient-to-br from-al-adaam to-al-adaam-dark text-white shadow-al-adaam/30' : ''}
                  transition-all duration-300
                `}>
                  {/* Badge for pending count */}
                  {item.badge && pendingCount > 0 && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-salmon text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900 shadow-sm"
                    >
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </motion.span>
                  )}
                  
                  {/* Icon with active/inactive states */}
                  <motion.div
                    animate={{ 
                      rotate: isPressed && item.id === 'scheduler' ? 90 : 0 
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    {isActive ? item.activeIcon : item.icon}
                  </motion.div>
                </div>
                
                {/* Label */}
                <span className={`
                  text-[10px] font-semibold tracking-wide mt-1
                  transition-all duration-200
                  ${isActive ? 'opacity-100' : 'opacity-60'}
                  ${item.highlight ? 'mt-2' : ''}
                `}>
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
