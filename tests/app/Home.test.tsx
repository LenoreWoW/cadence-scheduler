import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import React from 'react';
import { Home } from '../../app/routes/Home';
import { meetingsApi } from '../../services/meetingsApi';
import { renderWithProviders, adminUser, guestUser } from './providers';
import type { Meeting } from '../../types';

const base = {
  durationMinutes: 30, attendeeName: 'A', attendeeEmail: 'a@x.com', hostId: '1',
  bookedBy: 'guest' as const, category: 'general' as const, meetingFormat: 'in-person' as const,
};
const meetings: Meeting[] = [
  { ...base, id: '1', title: 'Intro', date: '2099-07-01', time: '10:00', status: 'approved' },
  { ...base, id: '2', title: 'Review', date: '2099-07-02', time: '11:00', status: 'pending' },
];

describe('Home', () => {
  beforeEach(() => {
    vi.spyOn(meetingsApi, 'list').mockResolvedValue(meetings);
    vi.spyOn(meetingsApi, 'pendingApproval').mockResolvedValue([meetings[1]]);
  });

  it('greets an approver and shows the review-requests CTA', async () => {
    renderWithProviders(<Home />, { user: adminUser });
    expect(screen.getByText(/Good day, System/)).toBeInTheDocument();
    expect(screen.getByText('Your schedule, under control.')).toBeInTheDocument();
    // Upcoming list resolves from the query.
    expect(await screen.findByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('greets a guest with the booking-focused hero', () => {
    renderWithProviders(<Home />, { user: guestUser });
    expect(screen.getByText(/Book time with the team, Ahmed/)).toBeInTheDocument();
  });
});
