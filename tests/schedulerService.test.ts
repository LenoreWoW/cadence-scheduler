/**
 * Scheduler Service Tests — covers the current schedulerService API:
 *   generateTimeSlots(date, meetings, host, durationOverride?) -> TimeSlot[] ({ label, available, ... })
 *   getMeetingsForDate(date: Date, meetings, hostId) -> Meeting[]
 *   createMeeting(existingMeetings, meetingData, role) -> Meeting[]
 *   checkMeetingConflict(...) -> boolean
 */

import { describe, it, expect } from 'vitest';
import {
  generateTimeSlots,
  checkMeetingConflict,
  createMeeting,
  getMeetingsForDate,
} from '../services/schedulerService';
import { Meeting, User } from '../types';

// A far-future date so the min-notice rule never marks slots unavailable.
// We derive the host's working days from this date so it is always a working day.
const FUTURE = new Date('2099-06-15T00:00:00');
const FUTURE_STR = FUTURE.toISOString().split('T')[0];

const hostFor = (overrides: Partial<NonNullable<User['availability']>> = {}): User => ({
  id: '1',
  username: 'testhost',
  name: 'Test Host',
  role: 'manager',
  title: 'Manager',
  availability: {
    days: [FUTURE.getDay()],
    startHour: 9,
    endHour: 17,
    slotDuration: 30,
    bufferMinutes: 0,
    minNoticeMinutes: 60,
    timeOff: [],
    ...overrides,
  },
});

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
    bookedBy: 'guest',
    category: 'general',
    meetingFormat: 'in-person',
  },
];

describe('schedulerService', () => {
  describe('generateTimeSlots', () => {
    it('generates labeled slots across the working day', () => {
      const slots = generateTimeSlots(FUTURE, [], hostFor());
      expect(slots.length).toBe(16); // 09:00–17:00 @ 30min, last start 16:30
      expect(slots[0].label).toBe('09:00');
      expect(slots[0].available).toBe(true);
      expect(slots[slots.length - 1].label).toBe('16:30');
    });

    it('marks a booked slot as unavailable', () => {
      const booked: Meeting[] = [{ ...mockMeetings[0], date: FUTURE_STR, time: '10:00' }];
      const slots = generateTimeSlots(FUTURE, booked, hostFor());
      const ten = slots.find((s) => s.label === '10:00');
      expect(ten?.available).toBe(false);
    });

    it('returns no slots on a non-working day', () => {
      const offDay = hostFor({ days: [(FUTURE.getDay() + 1) % 7] });
      expect(generateTimeSlots(FUTURE, [], offDay).length).toBe(0);
    });

    it('returns no slots on a full-day time-off date', () => {
      const onLeave = hostFor({ timeOff: [FUTURE_STR] });
      expect(generateTimeSlots(FUTURE, [], onLeave).length).toBe(0);
    });
  });

  describe('checkMeetingConflict', () => {
    it('detects overlapping meetings', () => {
      expect(checkMeetingConflict(mockMeetings, '2024-01-15', '10:00', 30, '1')).toBe(true);
    });

    it('allows non-overlapping meetings', () => {
      expect(checkMeetingConflict(mockMeetings, '2024-01-15', '11:00', 30, '1')).toBe(false);
    });

    it('considers buffer time', () => {
      expect(checkMeetingConflict(mockMeetings, '2024-01-15', '10:30', 30, '1', undefined, 15)).toBe(true);
    });

    it('excludes a specific meeting from the conflict check', () => {
      expect(checkMeetingConflict(mockMeetings, '2024-01-15', '10:00', 30, '1', 'm1')).toBe(false);
    });
  });

  describe('getMeetingsForDate', () => {
    it('returns meetings for a specific date + host', () => {
      const meetings = getMeetingsForDate(new Date('2024-01-15'), mockMeetings, '1');
      expect(meetings).toHaveLength(1);
      expect(meetings[0].id).toBe('m1');
    });

    it('returns an empty array for a date with no meetings', () => {
      expect(getMeetingsForDate(new Date('2024-01-16'), mockMeetings, '1')).toHaveLength(0);
    });
  });

  describe('createMeeting', () => {
    const data = {
      title: 'New Meeting',
      date: '2024-01-16',
      time: '14:00',
      durationMinutes: 45,
      attendeeName: 'Jane Doe',
      attendeeEmail: 'jane@example.com',
      hostId: '1',
      bookedBy: 'guest' as const,
      category: 'general' as const,
      meetingFormat: 'in-person' as const,
    };

    it('appends the meeting and leaves a guest booking pending', () => {
      const result = createMeeting([], data, 'guest');
      expect(result).toHaveLength(1);
      const m = result[0];
      expect(m.title).toBe('New Meeting');
      expect(m.durationMinutes).toBe(45);
      expect(m.status).toBe('pending');
      expect(m.id).toBeDefined();
    });

    it('auto-approves a meeting created by a manager', () => {
      const result = createMeeting([], data, 'manager');
      expect(result[0].status).toBe('approved');
    });

    it('preserves existing meetings', () => {
      const result = createMeeting(mockMeetings, data, 'guest');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('m1');
    });
  });
});
