/**
 * Scheduler Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateTimeSlots,
  checkMeetingConflict,
  createMeeting,
  getMeetingsForDate
} from '../services/schedulerService';
import { Meeting, User, TimeSlot } from '../types';

describe('schedulerService', () => {
  const mockHost: User = {
    id: '1',
    username: 'testhost',
    name: 'Test Host',
    role: 'manager',
    title: 'Manager',
    availability: {
      days: [0, 1, 2, 3, 4], // Sun-Thu
      startHour: 9,
      endHour: 17,
      slotDuration: 30,
      bufferMinutes: 0,
      minNoticeMinutes: 60,
      timeOff: []
    }
  };

  const mockMeetings: Meeting[] = [
    {
      id: 'm1',
      title: 'Existing Meeting',
      date: '2024-01-15',
      time: '10:00',
      durationMinutes: 30,
      attendeeName: 'John Doe',
      attendeeEmail: 'john@example.com',
      hostId: '1',
      status: 'approved',
      bookedBy: 'guest'
    }
  ];

  describe('generateTimeSlots', () => {
    it('should generate time slots for a working day', () => {
      const date = new Date('2024-01-15'); // Monday
      const slots = generateTimeSlots(date, [], mockHost);
      
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].time).toBe('09:00');
    });

    it('should mark booked slots as unavailable', () => {
      const date = new Date('2024-01-15');
      const slots = generateTimeSlots(date, mockMeetings, mockHost);
      
      const tenAmSlot = slots.find(s => s.time === '10:00');
      expect(tenAmSlot?.isAvailable).toBe(false);
    });

    it('should return empty slots for non-working days', () => {
      const friday = new Date('2024-01-19'); // Friday (not in working days)
      const slots = generateTimeSlots(friday, [], mockHost);
      
      expect(slots.length).toBe(0);
    });

    it('should respect time off dates', () => {
      const hostWithTimeOff: User = {
        ...mockHost,
        availability: {
          ...mockHost.availability!,
          timeOff: [{ date: '2024-01-15', allDay: true }]
        }
      };
      
      const date = new Date('2024-01-15');
      const slots = generateTimeSlots(date, [], hostWithTimeOff);
      
      expect(slots.length).toBe(0);
    });
  });

  describe('checkMeetingConflict', () => {
    it('should detect overlapping meetings', () => {
      const hasConflict = checkMeetingConflict(
        mockMeetings,
        '2024-01-15',
        '10:00',
        30,
        '1'
      );
      
      expect(hasConflict).toBe(true);
    });

    it('should allow non-overlapping meetings', () => {
      const hasConflict = checkMeetingConflict(
        mockMeetings,
        '2024-01-15',
        '11:00',
        30,
        '1'
      );
      
      expect(hasConflict).toBe(false);
    });

    it('should consider buffer time', () => {
      const hasConflict = checkMeetingConflict(
        mockMeetings,
        '2024-01-15',
        '10:30',
        30,
        '1',
        undefined,
        15 // 15 min buffer
      );
      
      // 10:30 is within 15 min of 10:00's end (10:30)
      expect(hasConflict).toBe(true);
    });

    it('should exclude specific meeting from conflict check', () => {
      const hasConflict = checkMeetingConflict(
        mockMeetings,
        '2024-01-15',
        '10:00',
        30,
        '1',
        'm1' // Exclude the existing meeting
      );
      
      expect(hasConflict).toBe(false);
    });
  });

  describe('getMeetingsForDate', () => {
    it('should return meetings for a specific date', () => {
      const meetings = getMeetingsForDate(mockMeetings, '2024-01-15');
      expect(meetings).toHaveLength(1);
      expect(meetings[0].id).toBe('m1');
    });

    it('should return empty array for date with no meetings', () => {
      const meetings = getMeetingsForDate(mockMeetings, '2024-01-16');
      expect(meetings).toHaveLength(0);
    });
  });

  describe('createMeeting', () => {
    it('should create a meeting with correct properties', () => {
      const meeting = createMeeting(
        'New Meeting',
        '2024-01-16',
        '14:00',
        45,
        'Jane Doe',
        'jane@example.com',
        '1',
        'guest',
        'Some notes',
        'strategy'
      );
      
      expect(meeting.title).toBe('New Meeting');
      expect(meeting.date).toBe('2024-01-16');
      expect(meeting.time).toBe('14:00');
      expect(meeting.durationMinutes).toBe(45);
      expect(meeting.attendeeName).toBe('Jane Doe');
      expect(meeting.attendeeEmail).toBe('jane@example.com');
      expect(meeting.hostId).toBe('1');
      expect(meeting.status).toBe('pending');
      expect(meeting.bookedBy).toBe('guest');
      expect(meeting.notes).toBe('Some notes');
      expect(meeting.category).toBe('strategy');
      expect(meeting.id).toBeDefined();
    });

    it('should use default category when not provided', () => {
      const meeting = createMeeting(
        'Meeting',
        '2024-01-16',
        '14:00',
        30,
        'Test',
        'test@example.com',
        '1',
        'guest'
      );
      
      expect(meeting.category).toBe('general');
    });
  });
});

