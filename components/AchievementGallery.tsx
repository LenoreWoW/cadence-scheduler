import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Achievement, UserStats, AchievementCategory } from '../types';
import { achievementService, LEVEL_XP, getXPForNextLevel, ACHIEVEMENTS } from '../services/achievementService';
import { Button } from './Button';

interface AchievementGalleryProps {
  achievements: Achievement[];
  userAchievements: string[]; // IDs of unlocked achievements
  onClose: () => void;
  t: (key: string) => string;
  userId?: string;
}

export const AchievementGallery: React.FC<AchievementGalleryProps> = ({
  achievements,
  userAchievements,
  onClose,
  t,
  userId
}) => {
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [activeTab, setActiveTab] = useState<'achievements' | 'stats'>('achievements');
  const [filterCategory, setFilterCategory] = useState<AchievementCategory | 'all'>('all');

  const stats: UserStats | null = userId ? achievementService.getStats(userId) : null;
  
  const unlockedCount = userAchievements.length;
  const visibleAchievements = achievements.filter(a => !a.hidden || userAchievements.includes(a.id));
  const totalVisible = visibleAchievements.length;
  const progress = totalVisible > 0 ? (unlockedCount / totalVisible) * 100 : 0;
  
  const totalXP = stats?.totalXP || 0;
  const currentLevel = stats?.level || 1;
  const nextLevelXP = getXPForNextLevel(currentLevel);
  const currentLevelXP = LEVEL_XP[currentLevel - 1] || 0;
  const levelProgress = nextLevelXP > currentLevelXP 
    ? ((totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100 
    : 100;

  const topPartner = userId ? achievementService.getTopPartner(userId) : null;
  
  const filteredAchievements = useMemo(() => {
    if (filterCategory === 'all') return visibleAchievements;
    return visibleAchievements.filter(a => a.category === filterCategory);
  }, [visibleAchievements, filterCategory]);

  const categories: { id: AchievementCategory | 'all'; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: '🏆' },
    { id: 'booking', label: 'Booking', icon: '📅' },
    { id: 'attendance', label: 'Attendance', icon: '🔥' },
    { id: 'social', label: 'Social', icon: '👥' },
    { id: 'productivity', label: 'Productivity', icon: '⏱️' },
    { id: 'explorer', label: 'Explorer', icon: '🔍' },
    { id: 'secret', label: 'Secret', icon: '🎁' },
  ];

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-5xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-al-adaam/10 via-transparent to-purple-500/10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              {/* Level Badge */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-al-adaam to-al-adaam-dark flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  {currentLevel}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-900 text-[8px] font-black px-1.5 py-0.5 rounded-full">
                  LVL
                </div>
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-display font-bold text-charcoal dark:text-white">
                  Achievements
                </h2>
                <p className="text-dune text-sm">{totalXP} XP • Level {currentLevel}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-charcoal dark:hover:text-white transition-colors">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Level Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-bold text-al-adaam">Level {currentLevel}</span>
              <span className="text-gray-500">{totalXP} / {nextLevelXP} XP</span>
            </div>
            <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-al-adaam to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${levelProgress}%` }}
                transition={{ duration: 1, delay: 0.2 }}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('achievements')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'achievements' ? 'bg-charcoal dark:bg-white text-white dark:text-charcoal' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              🏆 Achievements ({unlockedCount}/{totalVisible})
            </button>
            <button 
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'stats' ? 'bg-charcoal dark:bg-white text-white dark:text-charcoal' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              📊 Stats
            </button>
          </div>
        </div>

        {activeTab === 'achievements' ? (
          <>
            {/* Category Filter */}
            <div className="px-6 md:px-8 py-4 border-b border-gray-100 dark:border-gray-800 overflow-x-auto no-scrollbar">
              <div className="flex gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterCategory(cat.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      filterCategory === cat.id 
                        ? 'bg-al-adaam text-white' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50 dark:bg-gray-900/50">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredAchievements.map((achievement) => {
                  const isUnlocked = userAchievements.includes(achievement.id);
                  const progressPct = userId && achievement.requiredCount 
                    ? achievementService.getProgress(userId, achievement.id) 
                    : 0;
                  
                  return (
                    <motion.button
                      key={achievement.id}
                      onClick={() => setSelectedAchievement(achievement)}
                      whileHover={{ scale: 1.03, y: -3 }}
                      whileTap={{ scale: 0.97 }}
                      className={`relative aspect-square rounded-xl p-3 flex flex-col items-center justify-center text-center transition-all border-2
                        ${isUnlocked 
                          ? 'bg-white dark:bg-gray-800 border-transparent shadow-lg hover:shadow-xl' 
                          : 'bg-gray-100 dark:bg-gray-800/50 border-dashed border-gray-300 dark:border-gray-700'}
                        ${achievement.hidden && !isUnlocked ? 'opacity-50' : ''}
                      `}
                    >
                      {/* Icon */}
                      <div className={`text-3xl mb-2 ${isUnlocked ? '' : 'grayscale opacity-50'}`}>
                        {achievement.hidden && !isUnlocked ? '❓' : achievement.icon}
                      </div>
                      
                      {/* Title */}
                      <h3 className={`text-xs font-bold line-clamp-2 ${isUnlocked ? 'text-charcoal dark:text-white' : 'text-gray-400'}`}>
                        {achievement.hidden && !isUnlocked ? 'Secret' : achievement.title}
                      </h3>
                      
                      {/* Progress bar for locked achievements */}
                      {!isUnlocked && achievement.requiredCount && progressPct > 0 && (
                        <div className="absolute bottom-2 left-2 right-2">
                          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-al-adaam/50" 
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="text-[8px] text-gray-400">{progressPct}%</span>
                        </div>
                      )}
                      
                      {/* Rarity indicator */}
                      {isUnlocked && (
                        <div className={`absolute top-2 right-2 w-2 h-2 rounded-full 
                          ${achievement.rarity === 'legendary' ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]' :
                            achievement.rarity === 'rare' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' :
                            achievement.rarity === 'uncommon' ? 'bg-green-500' :
                            'bg-gray-400'} 
                        `}/>
                      )}
                      
                      {/* XP badge */}
                      {isUnlocked && achievement.xp && (
                        <div className="absolute bottom-2 right-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[8px] font-bold px-1.5 py-0.5 rounded">
                          +{achievement.xp}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* Stats Tab */
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50 dark:bg-gray-900/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Total Meetings */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-al-adaam/10 flex items-center justify-center text-2xl">📅</div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Total Meetings</p>
                    <p className="text-3xl font-bold text-charcoal dark:text-white">{stats?.totalBookings || 0}</p>
                  </div>
                </div>
              </div>
              
              {/* Login Streak */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-2xl">🔥</div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Current Streak</p>
                    <p className="text-3xl font-bold text-charcoal dark:text-white">{stats?.loginStreak || 0} <span className="text-sm font-normal text-gray-400">days</span></p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">Longest: {stats?.longestStreak || 0} days</p>
              </div>
              
              {/* Time Spent */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-2xl">⏱️</div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Time in Meetings</p>
                    <p className="text-3xl font-bold text-charcoal dark:text-white">{formatTime(stats?.totalTimeSpent || 0)}</p>
                  </div>
                </div>
              </div>
              
              {/* Most Meetings With */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-2xl">💞</div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Most Meetings With</p>
                    {topPartner ? (
                      <>
                        <p className="text-xl font-bold text-charcoal dark:text-white">{topPartner.name}</p>
                        <p className="text-sm text-gray-400">{topPartner.count} meetings</p>
                      </>
                    ) : (
                      <p className="text-gray-400 text-sm">No data yet</p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Network Size */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-2xl">🌐</div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Network Size</p>
                    <p className="text-3xl font-bold text-charcoal dark:text-white">{stats?.meetingPartners?.length || 0} <span className="text-sm font-normal text-gray-400">people</span></p>
                  </div>
                </div>
              </div>
              
              {/* Level */}
              <div className="bg-gradient-to-br from-al-adaam to-purple-600 rounded-xl p-6 shadow-lg text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">⭐</div>
                  <div>
                    <p className="text-xs text-white/70 uppercase tracking-wider">Current Level</p>
                    <p className="text-4xl font-bold">{currentLevel}</p>
                  </div>
                </div>
                <p className="text-xs text-white/60">{nextLevelXP - totalXP} XP to next level</p>
              </div>
            </div>
            
            {/* Meeting Partners List */}
            {stats?.meetingPartners && stats.meetingPartners.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-bold text-charcoal dark:text-white mb-4">Meeting Partners</h3>
                <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
                  {[...stats.meetingPartners]
                    .sort((a, b) => b.meetingCount - a.meetingCount)
                    .slice(0, 10)
                    .map((partner, idx) => (
                      <div key={partner.partnerId} className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-gray-300 w-6">#{idx + 1}</span>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-al-adaam to-dune flex items-center justify-center text-white text-sm font-bold">
                            {partner.partnerName.charAt(0)}
                          </div>
                          <span className="font-medium text-charcoal dark:text-white">{partner.partnerName}</span>
                        </div>
                        <span className="text-sm font-mono text-gray-500">{partner.meetingCount} meetings</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Achievement Details Modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 pointer-events-auto border border-gray-100 dark:border-gray-600 m-4"
            >
              <div className="text-center mb-6">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center text-6xl mb-4 shadow-inner">
                  {selectedAchievement.hidden && !userAchievements.includes(selectedAchievement.id) 
                    ? '❓' 
                    : selectedAchievement.icon}
                </div>
                <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-3
                  ${selectedAchievement.rarity === 'legendary' ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-400 text-white' :
                    selectedAchievement.rarity === 'rare' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                    selectedAchievement.rarity === 'uncommon' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}
                `}>
                  {selectedAchievement.rarity}
                </span>
                <h3 className="text-2xl font-bold text-charcoal dark:text-white mb-2">
                  {selectedAchievement.hidden && !userAchievements.includes(selectedAchievement.id) 
                    ? 'Secret Achievement' 
                    : selectedAchievement.title}
                </h3>
                <p className="text-gray-500 leading-relaxed">
                  {selectedAchievement.hidden && !userAchievements.includes(selectedAchievement.id) 
                    ? 'Keep exploring to unlock this secret achievement!' 
                    : selectedAchievement.description}
                </p>
                
                {selectedAchievement.xp && (
                  <div className="mt-4 inline-flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-3 py-1 rounded-full">
                    <span className="font-bold">+{selectedAchievement.xp}</span>
                    <span className="text-xs">XP</span>
                  </div>
                )}
              </div>
              
              <Button fullWidth onClick={() => setSelectedAchievement(null)}>Close</Button>
            </motion.div>
            
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm -z-10" onClick={() => setSelectedAchievement(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
