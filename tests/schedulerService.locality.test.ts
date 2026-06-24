import { describe, it, expect } from 'vitest';
import { createMeeting, rescheduleMeeting } from '../services/schedulerService';
import { Meeting } from '../types';

const data = {
  title: 'T', date: '2026-07-01', time: '10:00', durationMinutes: 30,
  attendeeName: 'A', attendeeEmail: 'a@x.com', hostId: '1', bookedBy: 'subordinate' as const,
  category: 'general' as const, meetingFormat: 'in-person' as const, locality: 'internal' as const,
};

describe('createMeeting preserves locality', () => {
  it('keeps the locality passed in the data', () => {
    const [m] = createMeeting([], { ...data, locality: 'external' }, 'manager');
    expect(m.locality).toBe('external');
  });
});

describe('rescheduleMeeting preserves a tentative on-behalf meeting', () => {
  const tentative: Meeting = { ...data, id: 'm1', status: 'pending', onBehalf: true };
  const normal: Meeting = { ...data, id: 'm2', status: 'approved' };
  it('keeps pending for an on-behalf tentative', () => {
    const out = rescheduleMeeting([tentative], 'm1', '2026-07-02', '11:00');
    expect(out[0].status).toBe('pending');
    expect(out[0].date).toBe('2026-07-02');
  });
  it('still approves a normal reschedule', () => {
    const out = rescheduleMeeting([normal], 'm2', '2026-07-02', '11:00');
    expect(out[0].status).toBe('approved');
  });
});
