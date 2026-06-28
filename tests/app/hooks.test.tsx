import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMeetings } from '../../app/lib/hooks';
import { meetingsApi } from '../../services/meetingsApi';

// Verifies the new UI's data layer is wired to the server API (not localStorage).
describe('app data hooks', () => {
  it('useMeetings returns the server meetings via meetingsApi', async () => {
    const fake = [
      { id: '1', title: 'Intro', date: '2026-07-01', time: '10:00', status: 'approved' },
    ] as any;
    vi.spyOn(meetingsApi, 'list').mockResolvedValue(fake);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useMeetings(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(fake));
    expect(meetingsApi.list).toHaveBeenCalledTimes(1);
  });
});
