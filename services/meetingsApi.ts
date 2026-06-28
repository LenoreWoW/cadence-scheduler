import { apiJson } from './api';
import { Meeting, MeetingStatus } from '../types';

// Server-backed meetings client. This is what makes the office share ONE schedule:
// every read/write goes through the API (the authenticated app previously kept
// meetings in per-browser localStorage, so requests never reached the host).
// The server already returns camelCase objects shaped like `Meeting`.

export interface CreateMeetingInput {
  title: string;
  date: string;            // YYYY-MM-DD
  time: string;            // slot label, e.g. "10:00"
  durationMinutes: number;
  attendeeName: string;
  attendeeEmail: string;
  additionalAttendees?: string;
  hostId: string;
  notes?: string;
  category?: string;
  meetingFormat?: 'online' | 'in-person';
  meetingLink?: string;
  meetingPlatform?: string;
  locationAddress?: string;
  locality?: 'internal' | 'external';
}

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

export const meetingsApi = {
  /** All meetings the current user may see (they host OR booked; admin sees all). */
  list: () => apiJson<Meeting[]>('/api/meetings', { method: 'GET' }),

  /** Pending requests awaiting the current user's approval (host + delegate aware). */
  pendingApproval: () => apiJson<Meeting[]>('/api/meetings/pending-approval', { method: 'GET' }),

  /** Create a booking request. Non-privileged callers get a pending request the host approves. */
  create: (input: CreateMeetingInput) =>
    apiJson<{ meeting?: Meeting } & Partial<Meeting>>('/api/meetings', jsonInit('POST', input)),

  /** Approve / reject / cancel. Confirmation is gated server-side (host/admin/delegate). */
  setStatus: (id: string, status: MeetingStatus) =>
    apiJson(`/api/meetings/${id}/status`, jsonInit('PATCH', { status })),

  /** Reschedule an existing meeting to a new date/time. */
  reschedule: (id: string, date: string, time: string) =>
    apiJson(`/api/meetings/${id}/reschedule`, jsonInit('PATCH', { date, time })),
};
