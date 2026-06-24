import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MeetingList } from '../../components/MeetingList';
import { Meeting, User } from '../../types';

const user: User = { id: '1', username: 'm', role: 'manager', name: 'Boss', email: 'boss@acme.com' };
const base: Meeting = {
  id: 'a', title: 'Internal Sync', date: '2026-07-01', time: '10:00', durationMinutes: 30,
  attendeeName: 'Colleague', attendeeEmail: 'c@acme.com', hostId: '1', status: 'approved',
  bookedBy: 'manager', category: 'strategy', meetingFormat: 'in-person', locality: 'internal',
};
const ext: Meeting = { ...base, id: 'b', title: 'Client Pitch', locality: 'external', category: 'client' };
const t = (k: string) => k;

it('colors internal title with the internal CSS var and external with external', () => {
  render(
    <MeetingList meetings={[base, ext]} currentUser={user} onCancel={vi.fn()} onReschedule={vi.fn()}
      onApprove={vi.fn()} onReject={vi.fn()} t={t} lang="en" />
  );
  const internalTitle = screen.getByText('Internal Sync');
  const externalTitle = screen.getByText('Client Pitch');
  expect(internalTitle.getAttribute('style')).toContain('var(--meeting-internal)');
  expect(externalTitle.getAttribute('style')).toContain('var(--meeting-external)');
});
