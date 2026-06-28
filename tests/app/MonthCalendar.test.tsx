import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { I18nProvider } from '../../app/lib/i18n';
import { MonthCalendar } from '../../app/ui/MonthCalendar';
import type { Meeting } from '../../types';

// Today (local) as YYYY-MM-DD — the calendar opens on the current month.
const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const meeting = (id: string, title: string, time: string): Meeting => ({
  id, title, date: today, time, durationMinutes: 30,
  attendeeName: 'A', attendeeEmail: 'a@x.com', hostId: '1', status: 'approved',
  bookedBy: 'guest', category: 'general', meetingFormat: 'in-person',
});

const renderCal = (meetings: Meeting[], onSelect = vi.fn()) => {
  render(<I18nProvider><MonthCalendar meetings={meetings} onSelect={onSelect} /></I18nProvider>);
  return onSelect;
};

describe('MonthCalendar', () => {
  it('renders weekday headers', () => {
    renderCal([]);
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d) =>
      expect(screen.getByText(d)).toBeInTheDocument(),
    );
  });

  it('shows a meeting chip on its day and fires onSelect when clicked', () => {
    const onSelect = renderCal([meeting('1', 'Standup', '09:00')]);
    const chip = screen.getByText(/Standup/);
    fireEvent.click(chip);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe('1');
  });

  it('collapses overflow to "+N more" past 3 meetings on a day', () => {
    renderCal([
      meeting('1', 'One', '09:00'),
      meeting('2', 'Two', '10:00'),
      meeting('3', 'Three', '11:00'),
      meeting('4', 'Four', '12:00'),
      meeting('5', 'Five', '13:00'),
    ]);
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('hides cancelled/rejected meetings', () => {
    renderCal([{ ...meeting('1', 'Hidden', '09:00'), status: 'cancelled' }]);
    expect(screen.queryByText(/Hidden/)).not.toBeInTheDocument();
  });
});
