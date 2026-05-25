import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Achievement } from '../types';
import { audioService } from '../services/audioService';

// Compact confetti for smaller popup
const Confetti: React.FC<{ count: number; colors: string[] }> = ({ count, colors }) => {
  const particles = useMemo(() => 
    Array.from({ length: count }, (_, i) => ({
      id: i,
      color: colors[Math.floor(Math.random() * colors.length)],
      left: `${Math.random() * 100}%`,
      delay: Math.random() * 0.3,
      duration: 0.8 + Math.random() * 0.5,
      size: 3 + Math.random() * 5,
      rotate: Math.random() * 360,
      drift: (Math.random() - 0.5) * 60,
    }))
  , [count, colors]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -10, x: 0, opacity: 1, rotate: 0 }}
          animate={{ 
            y: 150, 
            x: p.drift, 
            opacity: 0, 
            rotate: p.rotate 
          }}
          transition={{ 
            duration: p.duration, 
            delay: p.delay,
            ease: "easeOut"
          }}
          className="absolute"
          style={{ 
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
};

interface AchievementPopupProps {
  achievements: Achievement[];
  onClose: () => void;
}

export const AchievementPopup: React.FC<AchievementPopupProps> = ({ achievements, onClose }) => {
  const [current, setCurrent] = useState<Achievement | null>(null);
  const [queue, setQueue] = useState<Achievement[]>([]);

  useEffect(() => {
    if (achievements.length > 0) {
       setQueue(prev => [...prev, ...achievements]);
    }
  }, [achievements]);

  useEffect(() => {
    if (!current && queue.length > 0) {
       const next = queue[0];
       setCurrent(next);
       setQueue(prev => prev.slice(1));
       audioService.play('success');
       
       // Auto dismiss after 4 seconds
       const timer = setTimeout(() => {
          setCurrent(null);
          if (queue.length === 0) onClose();
       }, 4000);
       
       return () => clearTimeout(timer);
    }
  }, [queue, current, onClose]);

  const confettiColors = {
    common: ['#9CA3AF', '#D1D5DB', '#6B7280'],
    uncommon: ['#22C55E', '#4ADE80', '#15803D'],
    rare: ['#3B82F6', '#60A5FA', '#1D4ED8'],
    legendary: ['#A855F7', '#F472B6', '#FBBF24', '#60A5FA'],
  };

  const rarityColors = {
    common: 'border-gray-400 bg-gray-100',
    uncommon: 'border-green-500 bg-green-50',
    rare: 'border-blue-500 bg-blue-50',
    legendary: 'border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50',
  };

  const rarityGlow = {
    common: '',
    uncommon: 'shadow-green-500/20',
    rare: 'shadow-blue-500/30',
    legendary: 'shadow-purple-500/40',
  };

  return (
    <AnimatePresence>
      {current && (
        <motion.div 
          className="fixed bottom-6 left-6 z-[200] pointer-events-auto"
          initial={{ opacity: 0, x: -100, y: 20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: -100, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={() => {
            setCurrent(null);
            if (queue.length === 0) onClose();
          }}
        >
          {/* Confetti burst */}
          <Confetti 
            count={current.rarity === 'legendary' ? 40 : current.rarity === 'rare' ? 25 : 15} 
            colors={confettiColors[current.rarity as keyof typeof confettiColors] || confettiColors.common} 
          />
          
          {/* Compact WoW-style achievement banner */}
          <div 
            className={`relative flex items-center gap-4 px-5 py-4 rounded-xl border-2 shadow-xl backdrop-blur-sm cursor-pointer
              ${rarityColors[current.rarity as keyof typeof rarityColors] || rarityColors.common}
              ${rarityGlow[current.rarity as keyof typeof rarityGlow] || ''}
              hover:scale-[1.02] transition-transform
            `}
            style={{ minWidth: 280, maxWidth: 360 }}
          >
            {/* Icon badge */}
            <motion.div 
              className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-2xl
                ${current.rarity === 'legendary' 
                  ? 'bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-400 shadow-lg' 
                  : current.rarity === 'rare'
                  ? 'bg-blue-500 shadow-lg shadow-blue-500/40'
                  : current.rarity === 'uncommon'
                  ? 'bg-green-500 shadow-lg shadow-green-500/40'
                  : 'bg-gray-400 shadow-lg'
                }
              `}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            >
              {current.icon}
            </motion.div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <motion.div 
                className="flex items-center gap-2 mb-1"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-al-adaam">
                  🏆 Achievement
                </span>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full
                  ${current.rarity === 'legendary' ? 'bg-purple-500 text-white' :
                    current.rarity === 'rare' ? 'bg-blue-500 text-white' :
                    current.rarity === 'uncommon' ? 'bg-green-500 text-white' :
                    'bg-gray-400 text-white'}
                `}>
                  {current.rarity}
                </span>
              </motion.div>
              
              {/* Title */}
              <motion.h3 
                className="text-base font-bold text-charcoal truncate"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                {current.title}
              </motion.h3>
              
              {/* Description + XP */}
              <motion.div 
                className="flex items-center justify-between gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
              >
                <p className="text-xs text-gray-500 truncate flex-1">
                  {current.description}
                </p>
                <span className="flex-shrink-0 text-sm font-bold text-al-adaam">
                  +{current.rarity === 'legendary' ? 100 : current.rarity === 'rare' ? 50 : current.rarity === 'uncommon' ? 25 : 10} XP
                </span>
              </motion.div>
            </div>
            
            {/* Progress bar animation at bottom */}
            <motion.div 
              className="absolute bottom-0 left-0 right-0 h-1 bg-al-adaam/30 rounded-b-xl overflow-hidden"
            >
              <motion.div 
                className="h-full bg-al-adaam"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 4, ease: "linear" }}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
