
import { Meeting, TimeSlot, Role, MeetingStatus, User, DateRange } from '../types';
import { WORK_START_HOUR, WORK_END_HOUR, SLOT_DURATION } from '../constants';

// Helper to convert time string to minutes
const timeToMinutes = (time: string): number => {
  if (!time || typeof time !== 'string' || !time.includes(':')) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// BUSINESS LOGIC: Check working days AND specific blocked dates
const isWorkingDay = (date: Date, host?: User): boolean => {
  const dateStr = date.toISOString().split('T')[0];
  
  // 1. Check for specific Time Off / Blocked Dates
  if (host?.availability?.timeOff && Array.isArray(host.availability.timeOff)) {
     for (const item of host.availability.timeOff) {
        if (typeof item === 'string') {
           if (item === dateStr) return false; // Specifically blocked single date (Full day)
        } else if (typeof item === 'object' && item.start && item.end) {
           // Specifically blocked range
           if (dateStr >= item.start && dateStr <= item.end) {
              // If it has times, it's a PARTIAL block, so it IS still a working day (we filter slots later)
              if (item.startTime && item.endTime) {
                 return true; 
              }
              // If no times, it is a FULL day block
              return false; 
           }
        }
     }
  }

  // 2. Check Weekly Schedule
  const day = date.getDay();
  if (host?.availability?.days && Array.isArray(host.availability.days) && host.availability.days.length > 0) {
    return host.availability.days.includes(day);
  }

  // Default fallback (Fri/Sat off)
  return day !== 5 && day !== 6;
};

export const checkMeetingConflict = (
  existingMeetings: Meeting[],
  date: string,
  time: string,
  durationMinutes: number,
  hostId: string,
  excludeMeetingId?: string,
  bufferMinutes: number = 0
): boolean => {
  const newStart = timeToMinutes(time);
  const newEnd = newStart + durationMinutes + bufferMinutes; 

  return existingMeetings.some(m => {
    // Check basic filters
    if (m.hostId !== hostId) return false;
    if (m.date !== date) return false;
    if (m.status === 'cancelled' || m.status === 'rejected') return false;
    if (excludeMeetingId && m.id === excludeMeetingId) return false;

    const currentStart = timeToMinutes(m.time);
    const currentEnd = currentStart + m.durationMinutes + bufferMinutes; 

    // Check overlap: StartA < EndB && EndA > StartB
    return newStart < currentEnd && newEnd > currentStart;
  });
};

export const generateTimeSlots = (
  date: Date, 
  meetings: Meeting[],
  host: User,
  durationOverride?: number
): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  
  // Check if it's a working day for this host
  if (!isWorkingDay(date, host)) {
    return []; 
  }

  const dateStr = date.toISOString().split('T')[0];
  const now = new Date();
  const minNoticeMinutes = host.availability?.minNoticeMinutes || 120; // Default 2 hours notice
  
  // Use User configuration or fallbacks
  const startHour = host.availability?.startHour ?? WORK_START_HOUR;
  const endHour = host.availability?.endHour ?? WORK_END_HOUR;
  // Use the requested duration if provided, otherwise host default, otherwise constant default
  const checkDuration = durationOverride || host.availability?.slotDuration || SLOT_DURATION;
  // The step interval remains the host's slot duration (e.g. start every 30 mins)
  const stepDuration = host.availability?.slotDuration || SLOT_DURATION;
  const bufferMinutes = host.availability?.bufferMinutes ?? 0;

  let currentMinute = startHour * 60;
  const endMinute = endHour * 60;

  while (currentMinute + checkDuration <= endMinute) {
    const hour = Math.floor(currentMinute / 60);
    const minute = currentMinute % 60;
    
    // Format label HH:MM
    const label = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    // Determine Period
    let period: 'morning' | 'afternoon' | 'evening' = 'morning';
    if (hour >= 12 && hour < 17) period = 'afternoon';
    if (hour >= 17) period = 'evening';

    const slotStart = currentMinute;
    const slotEnd = currentMinute + checkDuration;

    // 1. Check if booked by Time Off (Partial Blocks)
    let isBlockedByTimeOff = false;
    if (host.availability?.timeOff) {
       for (const block of host.availability.timeOff) {
          if (typeof block === 'object' && block.start && block.end && block.startTime && block.endTime) {
             // Only check if current date falls within range
             if (dateStr >= block.start && dateStr <= block.end) {
                const blockStartMins = timeToMinutes(block.startTime);
                const blockEndMins = timeToMinutes(block.endTime);
                
                // Check Overlap: SlotStart < BlockEnd && SlotEnd > BlockStart
                if (slotStart < blockEndMins && slotEnd > blockStartMins) {
                   isBlockedByTimeOff = true;
                   break;
                }
             }
          }
       }
    }

    // 2. Check if booked (Approved OR Pending meetings block the slot)
    let isBooked = isBlockedByTimeOff || meetings.some(m => {
      // Must match host
      if (m.hostId !== host.id) return false;
      
      if (m.status === 'cancelled' || m.status === 'rejected') return false;
      if (m.date !== dateStr) return false;
      
      const [mHour, mMinute] = m.time.split(':').map(Number);
      const meetingStart = (mHour || 0) * 60 + (mMinute || 0);
      // Existing meeting blocks time until its end PLUS buffer
      const meetingEnd = meetingStart + m.durationMinutes + bufferMinutes;
      
      // Simple Overlap Logic
      const overlaps = (slotStart < meetingEnd) && (slotEnd > meetingStart);
      return overlaps;
    });

    // 3. Check Minimum Notice Period (Only applies if date is today/now)
    if (!isBooked) {
      const slotDate = new Date(date);
      slotDate.setHours(hour, minute, 0, 0);
      
      // If the slot is in the past OR within minimum notice period
      if (slotDate.getTime() < (now.getTime() + minNoticeMinutes * 60 * 1000)) {
        isBooked = true;
      }
    }

    slots.push({
      hour,
      minute,
      label,
      available: !isBooked,
      period
    });

    currentMinute += stepDuration; 
  }
  
  return slots;
};

export const getMeetingsForDate = (date: Date, meetings: Meeting[], hostId: string): Meeting[] => {
  const dateStr = date.toISOString().split('T')[0];
  return meetings
    .filter(m => m.hostId === hostId && m.date === dateStr && m.status !== 'cancelled' && m.status !== 'rejected')
    .sort((a, b) => a.time.localeCompare(b.time));
};

export const createMeeting = (
  existingMeetings: Meeting[],
  meetingData: Omit<Meeting, 'id' | 'status'>,
  userRole: Role
): Meeting[] => {
  // Managers are auto-approved, Guests are Pending
  const initialStatus: MeetingStatus = (userRole === 'manager' || userRole === 'subordinate') 
    ? 'approved' 
    : 'pending';

  const newMeeting: Meeting = {
    ...meetingData,
    id: Math.random().toString(36).substr(2, 9),
    status: initialStatus
  };
  return [...existingMeetings, newMeeting];
};

export const createRecurringMeetings = (
  existingMeetings: Meeting[],
  meetingData: Omit<Meeting, 'id' | 'status'>,
  userRole: Role,
  frequency: 'none' | 'daily' | 'weekly',
  count: number
): Meeting[] => {
  const initialStatus: MeetingStatus = (userRole === 'manager' || userRole === 'subordinate') 
    ? 'approved' 
    : 'pending';

  const newMeetings: Meeting[] = [];
  const baseDate = new Date(meetingData.date);

  for (let i = 0; i < count; i++) {
    const nextDate = new Date(baseDate);
    
    if (frequency === 'daily') {
      nextDate.setDate(baseDate.getDate() + i);
    } else if (frequency === 'weekly') {
      nextDate.setDate(baseDate.getDate() + (i * 7));
    }
    
    // We strictly assume checkMeetingConflict was called before this
    const newMeeting: Meeting = {
      ...meetingData,
      date: nextDate.toISOString().split('T')[0],
      id: Math.random().toString(36).substr(2, 9),
      status: initialStatus
    };
    newMeetings.push(newMeeting);
  }

  return [...existingMeetings, ...newMeetings];
};

export const updateMeetingStatus = (
  meetings: Meeting[],
  meetingId: string,
  status: MeetingStatus
): Meeting[] => {
  return meetings.map(m => 
    m.id === meetingId ? { ...m, status } : m
  );
};

export const cancelMeeting = (
  meetings: Meeting[],
  meetingId: string
): Meeting[] => {
  return updateMeetingStatus(meetings, meetingId, 'cancelled');
};

export const rescheduleMeeting = (
  meetings: Meeting[],
  meetingId: string,
  newDate: string,
  newTime: string
): Meeting[] => {
  return meetings.map(m => 
    m.id === meetingId ? { ...m, date: newDate, time: newTime, status: 'approved' } : m 
  );
};

// ============================================
// QUICK BOOK - FIND NEXT AVAILABLE SLOT
// ============================================

export interface QuickBookResult {
  date: Date;
  slot: TimeSlot;
  daysSearched: number;
}

/**
 * Find the next available time slot for a host
 * Searches from today forward up to maxDays
 */
export const findNextAvailableSlot = (
  host: User,
  existingMeetings: Meeting[],
  preferredDuration: number = 30,
  maxDays: number = 14
): QuickBookResult | null => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + dayOffset);
    
    // Generate slots for this date
    const slots = generateTimeSlots(checkDate, existingMeetings, host, preferredDuration);
    
    // Find first available slot
    const availableSlot = slots.find(s => s.available);
    
    if (availableSlot) {
      return {
        date: checkDate,
        slot: availableSlot,
        daysSearched: dayOffset + 1
      };
    }
  }
  
  // No available slot found within maxDays
  return null;
};

/**
 * Find the next N available slots across multiple days
 */
export const findNextAvailableSlots = (
  host: User,
  existingMeetings: Meeting[],
  count: number = 5,
  preferredDuration: number = 30,
  maxDays: number = 14
): QuickBookResult[] => {
  const results: QuickBookResult[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let dayOffset = 0; dayOffset < maxDays && results.length < count; dayOffset++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + dayOffset);
    
    // Generate slots for this date
    const slots = generateTimeSlots(checkDate, existingMeetings, host, preferredDuration);
    
    // Add all available slots until we hit count
    for (const slot of slots) {
      if (slot.available && results.length < count) {
        results.push({
          date: new Date(checkDate),
          slot,
          daysSearched: dayOffset + 1
        });
      }
    }
  }
  
  return results;
};

/**
 * Get a quick summary of availability for a host
 */
export const getAvailabilitySummary = (
  host: User,
  existingMeetings: Meeting[],
  daysToCheck: number = 7
): { date: Date; availableCount: number; totalCount: number }[] => {
  const summary: { date: Date; availableCount: number; totalCount: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let dayOffset = 0; dayOffset < daysToCheck; dayOffset++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + dayOffset);
    
    const slots = generateTimeSlots(checkDate, existingMeetings, host);
    const availableCount = slots.filter(s => s.available).length;
    
    summary.push({
      date: new Date(checkDate),
      availableCount,
      totalCount: slots.length
    });
  }
  
  return summary;
};
