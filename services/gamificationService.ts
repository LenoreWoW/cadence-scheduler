
import { Achievement, UserStats } from '../types';
import { storageService } from './storageService';
import { ACHIEVEMENTS, achievementService } from './achievementService';

// Re-export Achievement type for convenience
export type { Achievement };

type Listener = () => void;
const listeners: Set<Listener> = new Set();

// Store current user ID for gamification tracking
let currentUserId: string | null = null;

export const gamificationService = {
  
  // Set the current user for tracking
  setCurrentUser: (userId: string | null) => {
    currentUserId = userId;
  },

  // Get all available achievements
  getAchievements: (): Achievement[] => {
    return ACHIEVEMENTS;
  },

  // Get user's unlocked achievements
  getUserAchievements: (): string[] => {
    if (!currentUserId) return [];
    
    const stats = storageService.getUserStats(currentUserId);
    return stats.unlockedAchievements;
  },

  // Track an action and return newly unlocked achievements
  trackAction: (action: 'login' | 'booking' | 'visit_team'): Achievement[] => {
    if (!currentUserId) return [];
    
    const newUnlocks = achievementService.trackAction(currentUserId, action);
    
    // Notify listeners if there are new unlocks
    if (newUnlocks.length > 0) {
      gamificationService.notifyListeners();
    }
    
    return newUnlocks;
  },

  // Get unlocked achievements as full Achievement objects
  getUnlockedAchievements: (): Achievement[] => {
    if (!currentUserId) return [];
    
    return achievementService.getUnlocked(currentUserId);
  },

  // Check if an achievement is unlocked
  isUnlocked: (achievementId: string): boolean => {
    const unlocked = gamificationService.getUserAchievements();
    return unlocked.includes(achievementId);
  },

  // Subscribe to achievement updates
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  // Notify all listeners
  notifyListeners: () => {
    listeners.forEach(listener => listener());
  }
};

