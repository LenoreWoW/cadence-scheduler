
import { Meeting, LogEntry, User, Team, UserStats } from '../types';
import { INITIAL_MEETINGS, INITIAL_USERS, INITIAL_TEAMS } from '../constants';

const KEYS = {
  VERSION: 'adaam_version',
  MEETINGS: 'adaam_meetings_v3',
  LOGS: 'adaam_logs_v3',
  USERS: 'adaam_users_v3',
  TEAMS: 'adaam_teams_v3',
  STATS: 'adaam_stats_v1'
};

const CURRENT_VERSION = '1.0.3'; // Increment this to force reset on deployment - for testers

const DEFAULT_STATS: UserStats = {
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
};

export const storageService = {
  init: () => {
    // Check for reset parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === 'true') {
      console.log('Force reset requested via URL parameter');
      Object.values(KEYS).forEach(key => localStorage.removeItem(key));
      localStorage.removeItem('al_adaam_tour_state');
      localStorage.removeItem('regent_onboarding_completed');
      localStorage.removeItem('al_adaam_smart_defaults');
      // Remove reset param from URL without reload
      urlParams.delete('reset');
      const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
      window.history.replaceState({}, '', newUrl);
    }

    // Version Check
    const storedVersion = localStorage.getItem(KEYS.VERSION);
    if (storedVersion !== CURRENT_VERSION) {
       console.log(`Migrating from ${storedVersion} to ${CURRENT_VERSION}`);
       // For this demo, we might want to preserve data or reset. 
       // Let's preserve but ensure keys exist. 
       localStorage.setItem(KEYS.VERSION, CURRENT_VERSION);
    }

    if (!localStorage.getItem(KEYS.MEETINGS)) {
      localStorage.setItem(KEYS.MEETINGS, JSON.stringify(INITIAL_MEETINGS));
    }
    if (!localStorage.getItem(KEYS.LOGS)) {
      localStorage.setItem(KEYS.LOGS, JSON.stringify([]));
    }
    if (!localStorage.getItem(KEYS.USERS)) {
      localStorage.setItem(KEYS.USERS, JSON.stringify(INITIAL_USERS));
    }
    if (!localStorage.getItem(KEYS.TEAMS)) {
      localStorage.setItem(KEYS.TEAMS, JSON.stringify(INITIAL_TEAMS));
    }
    if (!localStorage.getItem(KEYS.STATS)) {
       localStorage.setItem(KEYS.STATS, JSON.stringify({}));
    }
  },

  // Meetings
  getMeetings: (): Meeting[] => {
    const data = localStorage.getItem(KEYS.MEETINGS);
    return data ? JSON.parse(data) : [];
  },

  saveMeetings: (meetings: Meeting[]) => {
    localStorage.setItem(KEYS.MEETINGS, JSON.stringify(meetings));
  },

  // Users
  getUsers: (): User[] => {
    const data = localStorage.getItem(KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },

  saveUsers: (users: User[]) => {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  },

  addUser: (user: User) => {
    const users = storageService.getUsers();
    users.push(user);
    storageService.saveUsers(users);
  },

  // Teams
  getTeams: (): Team[] => {
    const data = localStorage.getItem(KEYS.TEAMS);
    return data ? JSON.parse(data) : [];
  },

  saveTeams: (teams: Team[]) => {
    localStorage.setItem(KEYS.TEAMS, JSON.stringify(teams));
  },

  // Logs
  getLogs: (): LogEntry[] => {
    const data = localStorage.getItem(KEYS.LOGS);
    return data ? JSON.parse(data) : [];
  },

  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const logs = storageService.getLogs();
    const newLog: LogEntry = {
      ...entry,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString()
    };
    // Keep last 100 logs
    const updatedLogs = [newLog, ...logs].slice(0, 100);
    localStorage.setItem(KEYS.LOGS, JSON.stringify(updatedLogs));
    return newLog;
  },

  // Stats
  getUserStats: (userId: string): UserStats => {
     const allStats = JSON.parse(localStorage.getItem(KEYS.STATS) || '{}');
     return allStats[userId] || { ...DEFAULT_STATS };
  },

  saveUserStats: (userId: string, stats: UserStats) => {
     const allStats = JSON.parse(localStorage.getItem(KEYS.STATS) || '{}');
     allStats[userId] = stats;
     localStorage.setItem(KEYS.STATS, JSON.stringify(allStats));
  },

  // Full reset for testers
  resetAll: () => {
    // Clear all app data
    Object.values(KEYS).forEach(key => localStorage.removeItem(key));
    // Clear tour and onboarding state
    localStorage.removeItem('al_adaam_tour_state');
    localStorage.removeItem('regent_onboarding_completed');
    localStorage.removeItem('al_adaam_smart_defaults');
    localStorage.removeItem('al_adaam_theme');
    localStorage.removeItem('al_adaam_audio_enabled');
    console.log('All data reset for fresh experience');
    // Reinitialize with defaults
    storageService.init();
  }
};
