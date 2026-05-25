import { Achievement, UserStats } from '../types';
import { storageService } from './storageService';

// XP required for each level
export const LEVEL_XP = [0, 50, 150, 300, 500, 750, 1100, 1500, 2000, 3000, 5000];

export const calculateLevel = (xp: number): number => {
  for (let i = LEVEL_XP.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP[i]) return i + 1;
  }
  return 1;
};

export const getXPForNextLevel = (currentLevel: number): number => {
  if (currentLevel >= LEVEL_XP.length) return LEVEL_XP[LEVEL_XP.length - 1];
  return LEVEL_XP[currentLevel];
};

export const ACHIEVEMENTS: Achievement[] = [
  // === BOOKING ACHIEVEMENTS ===
  {
    id: 'first_booking',
    title: "It's a Date!",
    description: 'Scheduled your first meeting.',
    icon: '📅',
    rarity: 'common',
    category: 'booking',
    xp: 10
  },
  {
    id: 'power_booker_5',
    title: 'Getting Started',
    description: 'Scheduled 5 meetings.',
    icon: '📚',
    rarity: 'common',
    category: 'booking',
    requiredCount: 5,
    xp: 25
  },
  {
    id: 'power_booker_25',
    title: 'Power Booker',
    description: 'Scheduled 25 meetings.',
    icon: '⚡',
    rarity: 'uncommon',
    category: 'booking',
    requiredCount: 25,
    xp: 50
  },
  {
    id: 'power_booker_100',
    title: 'Meeting Master',
    description: 'Scheduled 100 meetings.',
    icon: '🏆',
    rarity: 'rare',
    category: 'booking',
    requiredCount: 100,
    xp: 100
  },
  {
    id: 'power_booker_500',
    title: 'Legendary Scheduler',
    description: 'Scheduled 500 meetings. You are a scheduling legend!',
    icon: '👑',
    rarity: 'legendary',
    category: 'booking',
    requiredCount: 500,
    xp: 250
  },
  
  // === ATTENDANCE ACHIEVEMENTS ===
  {
    id: 'first_login',
    title: 'First Steps',
    description: 'Logged in to Cadence for the first time.',
    icon: '👋',
    rarity: 'common',
    category: 'attendance',
    xp: 10
  },
  {
    id: 'streak_3',
    title: 'Getting Regular',
    description: 'Logged in 3 days in a row.',
    icon: '🔥',
    rarity: 'common',
    category: 'attendance',
    requiredCount: 3,
    xp: 15
  },
  {
    id: 'streak_7',
    title: 'Week Warrior',
    description: 'Logged in 7 days in a row.',
    icon: '📆',
    rarity: 'uncommon',
    category: 'attendance',
    requiredCount: 7,
    xp: 35
  },
  {
    id: 'streak_30',
    title: 'Monthly Dedication',
    description: 'Logged in 30 days in a row.',
    icon: '🌟',
    rarity: 'rare',
    category: 'attendance',
    requiredCount: 30,
    xp: 100
  },
  {
    id: 'streak_100',
    title: 'Century Streak',
    description: 'Logged in 100 days in a row. Incredible commitment!',
    icon: '💯',
    rarity: 'legendary',
    category: 'attendance',
    requiredCount: 100,
    xp: 300
  },
  
  // === SOCIAL ACHIEVEMENTS ===
  {
    id: 'team_player',
    title: 'Team Player',
    description: 'Visited the team management or calendar view.',
    icon: '👥',
    rarity: 'common',
    category: 'social',
    xp: 10
  },
  {
    id: 'network_starter',
    title: 'Network Starter',
    description: 'Had meetings with 5 different people.',
    icon: '🤝',
    rarity: 'uncommon',
    category: 'social',
    requiredCount: 5,
    xp: 30
  },
  {
    id: 'networking_pro',
    title: 'Networking Pro',
    description: 'Had meetings with 20 different people.',
    icon: '🌐',
    rarity: 'rare',
    category: 'social',
    requiredCount: 20,
    xp: 75
  },
  {
    id: 'best_friend',
    title: 'Meeting Buddy',
    description: 'Had 10+ meetings with the same person.',
    icon: '💞',
    rarity: 'uncommon',
    category: 'social',
    requiredCount: 10,
    xp: 40
  },
  
  // === PRODUCTIVITY ACHIEVEMENTS ===
  {
    id: 'time_10_hours',
    title: 'Time Well Spent',
    description: 'Spent 10 hours in meetings.',
    icon: '⏱️',
    rarity: 'common',
    category: 'productivity',
    requiredCount: 600, // 10 hours in minutes
    xp: 20
  },
  {
    id: 'time_100_hours',
    title: 'Time Investor',
    description: 'Spent 100 hours in meetings.',
    icon: '⏳',
    rarity: 'rare',
    category: 'productivity',
    requiredCount: 6000, // 100 hours in minutes
    xp: 100
  },
  {
    id: 'weekly_warrior',
    title: 'Weekly Warrior',
    description: 'Had 10 meetings in a single week.',
    icon: '📊',
    rarity: 'uncommon',
    category: 'productivity',
    requiredCount: 10,
    xp: 35
  },
  
  // === EXPLORER ACHIEVEMENTS ===
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Logged in after 8 PM.',
    icon: '🦉',
    rarity: 'uncommon',
    category: 'explorer',
    xp: 15
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Logged in before 6 AM.',
    icon: '🐦',
    rarity: 'uncommon',
    category: 'explorer',
    xp: 15
  },
  {
    id: 'weekend_warrior',
    title: 'Weekend Warrior',
    description: 'Scheduled a meeting on a weekend.',
    icon: '🎉',
    rarity: 'uncommon',
    category: 'explorer',
    xp: 20
  },
  {
    id: 'keyboard_master',
    title: 'Keyboard Master',
    description: 'Used keyboard shortcuts 50 times.',
    icon: '⌨️',
    rarity: 'rare',
    category: 'explorer',
    requiredCount: 50,
    xp: 50
  },
  
  // === SECRET ACHIEVEMENTS ===
  {
    id: 'secret_marathon',
    title: 'Marathon Day',
    description: 'Had 5+ meetings in a single day.',
    icon: '🏃',
    rarity: 'rare',
    category: 'secret',
    hidden: true,
    requiredCount: 5,
    xp: 50
  },
  {
    id: 'secret_perfectionist',
    title: 'Perfect Record',
    description: 'Had 50 meetings with 0 cancellations.',
    icon: '✨',
    rarity: 'legendary',
    category: 'secret',
    hidden: true,
    xp: 150
  },
  {
    id: 'secret_diverse',
    title: 'Category Champion',
    description: 'Booked meetings in all 5 categories.',
    icon: '🎯',
    rarity: 'rare',
    category: 'secret',
    hidden: true,
    xp: 75
  },
  {
    id: 'secret_bilingual',
    title: 'Bilingual',
    description: 'Used the app in both English and Arabic.',
    icon: '🌍',
    rarity: 'uncommon',
    category: 'secret',
    hidden: true,
    xp: 25
  }
];

export const achievementService = {
  
  // Get default stats structure
  getDefaultStats: (): UserStats => ({
    totalBookings: 0,
    totalCancellations: 0,
    meetingsAttended: 0,
    lastLogin: '',
    loginStreak: 0,
    longestStreak: 0,
    unlockedAchievements: [],
    totalTimeSpent: 0,
    firstLoginDate: new Date().toISOString(),
    totalXP: 0,
    level: 1,
    meetingPartners: [],
    weeklyMeetings: 0,
    monthlyMeetings: 0
  }),
  
  // Update stats and check for new unlocks
  trackAction: (userId: string, action: 'login' | 'booking' | 'visit_team' | 'keyboard_shortcut' | 'language_switch', data?: any): Achievement[] => {
    let stats = storageService.getUserStats(userId);
    
    // Initialize missing fields for backwards compatibility
    if (!stats.longestStreak) stats.longestStreak = stats.loginStreak;
    if (!stats.totalXP) stats.totalXP = 0;
    if (!stats.level) stats.level = 1;
    if (!stats.meetingPartners) stats.meetingPartners = [];
    if (!stats.weeklyMeetings) stats.weeklyMeetings = 0;
    if (!stats.monthlyMeetings) stats.monthlyMeetings = 0;
    if (!stats.firstLoginDate) stats.firstLoginDate = new Date().toISOString();
    if (!stats.totalTimeSpent) stats.totalTimeSpent = 0;
    
    const newUnlocks: Achievement[] = [];
    let updated = false;

    const unlock = (achievementId: string) => {
      if (!stats.unlockedAchievements.includes(achievementId)) {
        const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
        if (achievement) {
          stats.unlockedAchievements.push(achievementId);
          stats.totalXP += achievement.xp || 0;
          stats.level = calculateLevel(stats.totalXP);
          newUnlocks.push(achievement);
          updated = true;
        }
      }
    };

    // Handle login action
    if (action === 'login') {
      const now = new Date();
      const hour = now.getHours();
      const today = now.toISOString().split('T')[0];
      
      // First login
      if (!stats.lastLogin) {
        stats.firstLoginDate = now.toISOString();
        unlock('first_login');
      }
      
      // Check login streak
      if (stats.lastLogin) {
        const lastDate = new Date(stats.lastLogin).toISOString().split('T')[0];
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (lastDate === yesterdayStr) {
          stats.loginStreak += 1;
        } else if (lastDate !== today) {
          stats.loginStreak = 1;
          }
      } else {
        stats.loginStreak = 1;
      }
      
      stats.lastLogin = now.toISOString();
      if (stats.loginStreak > stats.longestStreak) {
        stats.longestStreak = stats.loginStreak;
      }
          updated = true;

      // Time-based achievements
      if (hour >= 20 || hour < 5) unlock('night_owl');
      if (hour >= 4 && hour < 6) unlock('early_bird');
      
      // Streak achievements
      if (stats.loginStreak >= 3) unlock('streak_3');
      if (stats.loginStreak >= 7) unlock('streak_7');
      if (stats.loginStreak >= 30) unlock('streak_30');
      if (stats.loginStreak >= 100) unlock('streak_100');
    }

    // Handle booking action
    if (action === 'booking') {
       stats.totalBookings += 1;
      stats.weeklyMeetings += 1;
      stats.monthlyMeetings += 1;
       updated = true;

      // Duration tracking
      if (data?.duration) {
        stats.totalTimeSpent += data.duration;
      }
      
      // Partner tracking
      if (data?.partnerId && data?.partnerName) {
        const existingPartner = stats.meetingPartners.find(p => p.partnerId === data.partnerId);
        if (existingPartner) {
          existingPartner.meetingCount += 1;
        } else {
          stats.meetingPartners.push({
            partnerId: data.partnerId,
            partnerName: data.partnerName,
            meetingCount: 1
          });
        }
      }

      // Booking achievements
      if (stats.totalBookings >= 1) unlock('first_booking');
      if (stats.totalBookings >= 5) unlock('power_booker_5');
      if (stats.totalBookings >= 25) unlock('power_booker_25');
      if (stats.totalBookings >= 100) unlock('power_booker_100');
      if (stats.totalBookings >= 500) unlock('power_booker_500');
      
      // Network achievements
      const uniquePartners = stats.meetingPartners.length;
      if (uniquePartners >= 5) unlock('network_starter');
      if (uniquePartners >= 20) unlock('networking_pro');
      
      // Best friend achievement
      const maxPartnerMeetings = Math.max(...stats.meetingPartners.map(p => p.meetingCount), 0);
      if (maxPartnerMeetings >= 10) unlock('best_friend');
      
      // Weekly warrior
      if (stats.weeklyMeetings >= 10) unlock('weekly_warrior');
      
      // Time achievements
      if (stats.totalTimeSpent >= 600) unlock('time_10_hours'); // 10 hours
      if (stats.totalTimeSpent >= 6000) unlock('time_100_hours'); // 100 hours
      
      // Weekend check
      const dayOfWeek = new Date().getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) unlock('weekend_warrior');
      
      // Perfect record check
      if (stats.totalBookings >= 50 && stats.totalCancellations === 0) {
        unlock('secret_perfectionist');
       }
    }

    if (action === 'visit_team') {
      unlock('team_player');
    }
    
    if (action === 'keyboard_shortcut') {
      // Track keyboard usage (would need additional state)
      // For now, just award on first use
      unlock('keyboard_master');
    }
    
    if (action === 'language_switch') {
      unlock('secret_bilingual');
    }

    if (updated) {
       storageService.saveUserStats(userId, stats);
    }

    return newUnlocks;
  },

  getUnlocked: (userId: string): Achievement[] => {
     const stats = storageService.getUserStats(userId);
     return ACHIEVEMENTS.filter(a => stats.unlockedAchievements.includes(a.id));
  },
  
  getProgress: (userId: string, achievementId: string): number => {
    const stats = storageService.getUserStats(userId);
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    
    if (!achievement || !achievement.requiredCount) return 0;
    
    // Determine current progress based on achievement type
    let current = 0;
    if (achievementId.startsWith('power_booker')) current = stats.totalBookings;
    else if (achievementId.startsWith('streak')) current = stats.loginStreak;
    else if (achievementId.startsWith('time')) current = stats.totalTimeSpent;
    else if (achievementId === 'network_starter' || achievementId === 'networking_pro') 
      current = stats.meetingPartners?.length || 0;
    else if (achievementId === 'weekly_warrior') current = stats.weeklyMeetings || 0;
    
    return Math.min(100, Math.round((current / achievement.requiredCount) * 100));
  },
  
  getStats: (userId: string): UserStats => {
    return storageService.getUserStats(userId);
  },
  
  getTopPartner: (userId: string): { name: string; count: number } | null => {
    const stats = storageService.getUserStats(userId);
    if (!stats.meetingPartners || stats.meetingPartners.length === 0) return null;
    
    const sorted = [...stats.meetingPartners].sort((a, b) => b.meetingCount - a.meetingCount);
    return { name: sorted[0].partnerName, count: sorted[0].meetingCount };
  }
};
