
export type Role = 'admin' | 'manager' | 'subordinate' | 'guest';

export type Language = 'en' | 'ar';

export type MeetingCategory = 'strategy' | 'operation' | 'client' | 'general' | 'hr';

export type MeetingFormat = 'online' | 'in-person';

export type VideoPlatform = 'zoom' | 'teams' | 'google-meet' | 'webex' | 'custom';

export interface Team {
  id: string;
  name: string;
  color?: string;
  image?: string;
  leaderId?: string; // Manager who owns this team
  createdAt?: string;
  updatedAt?: string;
}

export interface DateRange {
  start: string;
  end: string;
  startTime?: string; // HH:MM "09:00"
  endTime?: string;   // HH:MM "13:00"
}

export interface UserAvailability {
  startHour: number; // 0-23
  endHour: number;   // 0-23
  slotDuration: number; // minutes (15, 30, 60)
  days: number[]; // 0=Sun, 1=Mon, etc.
  bufferMinutes?: number; // Gap between meetings
  minNoticeMinutes?: number; // Minimum notice before booking (e.g. 120 mins)
  timeOff?: (string | DateRange)[]; // ISO Strings or DateRanges
}

export interface UserMeetingSettings {
  preferredPlatform?: VideoPlatform;
  meetingLink?: string; // e.g., "https://zoom.us/j/123456789"
  customPlatformName?: string; // For 'custom' platform type
}

export interface User {
  id: string;
  username: string;
  role: Role;
  name: string;
  title?: string;
  avatar?: string;
  teamId?: string; // Link to a Team
  email?: string;
  availability?: UserAvailability;
  timezone?: string; // e.g., "Asia/Qatar"
  onboardingCompleted?: boolean;
  meetingSettings?: UserMeetingSettings; // Video conferencing preferences
}

export interface LogEntry {
  id: string;
  timestamp: string; // ISO string
  action: string;
  details: string;
  performedBy: string; // User name
  role: Role;
}

export interface TimeSlot {
  hour: number;
  minute: number;
  time: string; // e.g., "09:30" - convenience property matching label
  label: string; // e.g., "09:30"
  available: boolean;
  isAvailable: boolean; // Alias for available for compatibility
  period: 'morning' | 'afternoon' | 'evening';
}

export type MeetingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Meeting {
  id: string;
  title: string;
  date: string; // ISO Date String YYYY-MM-DD
  time: string; // "09:30"
  durationMinutes: number;
  attendeeName: string;
  attendeeEmail: string;
  additionalAttendees?: string;
  userId?: string; // ID of the user who created it
  hostId: string; // ID of the manager/host this meeting is with
  status: MeetingStatus;
  bookedBy: Role;
  notes?: string;
  category: MeetingCategory;
  meetingFormat: MeetingFormat; // online or in-person
  meetingLink?: string; // Video conferencing link (for online meetings)
  meetingPlatform?: VideoPlatform; // Platform type (for online meetings)
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

// --- Gamification Types ---
export type AchievementCategory = 'booking' | 'attendance' | 'social' | 'productivity' | 'explorer' | 'secret';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  category?: AchievementCategory;
  hidden?: boolean; // Secret achievements
  requiredCount?: number; // For progress-based achievements
  xp?: number; // Points awarded
}

export interface MeetingPartnerStats {
  partnerId: string;
  partnerName: string;
  meetingCount: number;
}

export interface UserStats {
  totalBookings: number;
  totalCancellations: number;
  meetingsAttended: number;
  lastLogin: string;
  loginStreak: number;
  longestStreak: number;
  unlockedAchievements: string[]; // Array of Achievement IDs
  totalTimeSpent: number; // Minutes in meetings
  firstLoginDate: string; // ISO date
  totalXP: number; // Experience points
  level: number; // Current level
  meetingPartners: MeetingPartnerStats[]; // Track who you meet with most
  weeklyMeetings: number; // Meetings this week
  monthlyMeetings: number; // Meetings this month
}
