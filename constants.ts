import { Meeting, User, Team, MeetingCategory, VideoPlatform } from './types';

export const VIDEO_PLATFORM_CONFIG: Record<VideoPlatform, { label: string, icon: string, color: string }> = {
  'zoom': { label: 'Zoom', icon: '📹', color: '#2D8CFF' },
  'teams': { label: 'Microsoft Teams', icon: '🟣', color: '#6264A7' },
  'google-meet': { label: 'Google Meet', icon: '🟢', color: '#00897B' },
  'webex': { label: 'Webex', icon: '🔵', color: '#00BCEB' },
  'custom': { label: 'Custom', icon: '🔗', color: '#6B7280' }
};

export const APP_NAME = "Regent";

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const CATEGORY_CONFIG: Record<MeetingCategory, { label: string, color: string, bg: string }> = {
  strategy: { label: 'Strategy', color: '#8A1538', bg: '#fdf2f4' }, // Al Adaam
  operation: { label: 'Operations', color: '#0d4261', bg: '#e7eef2' }, // Skyline
  client: { label: 'Client', color: '#129b82', bg: '#e8f5f3' }, // Palm
  hr: { label: 'HR & Talent', color: '#dd7877', bg: '#fcf1f1' }, // Salmon
  general: { label: 'General', color: '#8067a4', bg: '#f3f0f7' } // Purple
};

// Map Teams to specific palette colors and images
export const INITIAL_TEAMS: Team[] = [
  { 
    id: 't1', 
    name: 'Executive', 
    color: '#8A1538', // Al Adaam
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1000'
  }, 
  { 
    id: 't2', 
    name: 'Finance', 
    color: '#129b82', // Palm
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=1000'
  }, 
  { 
    id: 't3', 
    name: 'Legal', 
    color: '#0d4261', // Skyline
    image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=1000'
  }, 
  { 
    id: 't4', 
    name: 'Creative', 
    color: '#e9c56b', // Yellow
    image: 'https://images.unsplash.com/photo-1502945015378-0e284ca1a543?auto=format&fit=crop&q=80&w=1000'
  } 
];

export const INITIAL_USERS: User[] = [
  { 
    id: '0', 
    username: 'admin', 
    role: 'admin', 
    name: 'System Admin', 
    title: 'Administrator',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400',
    teamId: 't1'
  },
  { 
    id: '1', 
    username: 'manager', 
    role: 'manager', 
    name: 'Abdul Rahman', 
    title: 'Senior Consultant',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400',
    teamId: 't1'
  },
  { 
    id: '4', 
    username: 'sarah', 
    role: 'manager', 
    name: 'Sarah Al-Mahmoud', 
    title: 'Financial Advisor',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
    teamId: 't2'
  },
  { 
    id: '5', 
    username: 'khalid', 
    role: 'manager', 
    name: 'Khalid Bin Zaid', 
    title: 'Legal Expert',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400',
    teamId: 't3'
  },
  { 
    id: '2', 
    username: 'sub', 
    role: 'subordinate', 
    name: 'Fatima (Assistant)',
    title: 'Executive Assistant',
    teamId: 't1',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400'
  },
  { 
    id: '3', 
    username: 'user1', 
    role: 'guest', 
    name: 'Ahmed (Client)',
    avatar: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&q=80&w=400'
  }
];

// Initial Mock Data
export const INITIAL_MEETINGS: Meeting[] = [
  {
    id: '1',
    title: 'Strategy Sync',
    date: new Date().toISOString().split('T')[0], // Today
    time: '10:00',
    durationMinutes: 30,
    attendeeName: 'Jane Doe',
    attendeeEmail: 'jane@example.com',
    status: 'approved',
    bookedBy: 'guest',
    notes: 'Discussing Q3 goals',
    hostId: '1',
    category: 'strategy',
    meetingFormat: 'online',
    meetingLink: 'https://zoom.us/j/123456789',
    meetingPlatform: 'zoom'
  },
  {
    id: '2',
    title: 'Team Weekly',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    time: '14:00',
    durationMinutes: 60,
    attendeeName: 'Development Team',
    attendeeEmail: 'dev@company.com',
    status: 'approved',
    bookedBy: 'manager',
    notes: 'Weekly standup',
    hostId: '1',
    category: 'operation',
    meetingFormat: 'in-person'
  },
  {
    id: '3',
    title: 'Investment Review',
    date: new Date().toISOString().split('T')[0], // Today
    time: '11:00',
    durationMinutes: 60,
    attendeeName: 'VIP Client',
    attendeeEmail: 'vip@client.com',
    status: 'pending', // Pending so Manager can see request
    bookedBy: 'guest',
    notes: 'Portfolio update',
    hostId: '1', // Moved to Manager 1 for visibility testing
    category: 'client',
    meetingFormat: 'online',
    meetingLink: 'https://teams.microsoft.com/l/meetup-join/123',
    meetingPlatform: 'teams'
  },
  {
    id: '4',
    title: 'Legal Consultation',
    date: new Date().toISOString().split('T')[0], // Today
    time: '15:00',
    durationMinutes: 45,
    attendeeName: 'New Client',
    attendeeEmail: 'client@new.com',
    status: 'pending',
    bookedBy: 'guest',
    notes: 'Initial consultation',
    hostId: '1', 
    category: 'general',
    meetingFormat: 'in-person'
  }
];

export const WORK_START_HOUR = 9; // 9 AM
export const WORK_END_HOUR = 17; // 5 PM
export const SLOT_DURATION = 30; // Minutes