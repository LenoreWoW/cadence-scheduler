/**
 * Calendar Sync Hook
 * 
 * Provides functions for:
 * - Checking calendar sync status
 * - Fetching external busy times for scheduling
 * - Manual sync trigger
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface CalendarConnection {
  provider: 'google' | 'microsoft';
  calendarId: string;
  calendarName: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  connectedAt: string;
}

interface CalendarStatus {
  configured: {
    google: boolean;
    microsoft: boolean;
  };
  connections: CalendarConnection[];
}

interface BusyTime {
  start: string;
  end: string;
  source: 'external';
}

interface UseCalendarSyncReturn {
  status: CalendarStatus | null;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  fetchBusyTimes: (hostId: string, date: string) => Promise<BusyTime[]>;
  triggerSync: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCalendarSync(accessToken: string | null): UseCalendarSyncReturn {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/calendar/status`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setError(null);
      } else {
        setError('Failed to fetch calendar status');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const fetchBusyTimes = useCallback(async (hostId: string, date: string): Promise<BusyTime[]> => {
    try {
      // Fetch host's meetings which now includes external busy times
      const response = await fetch(`${API_BASE}/meetings/host/${hostId}?date=${date}`);
      
      if (!response.ok) return [];
      
      const data = await response.json();
      
      // The API now returns { meetings, externalBusyTimes }
      return data.externalBusyTimes || [];
    } catch (err) {
      console.error('Failed to fetch busy times:', err);
      return [];
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_BASE}/calendar/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Failed to sync:', err);
    }
  }, [accessToken, fetchStatus]);

  const isConnected = status?.connections && status.connections.length > 0;

  return {
    status,
    loading,
    error,
    isConnected: !!isConnected,
    fetchBusyTimes,
    triggerSync,
    refresh: fetchStatus
  };
}

export default useCalendarSync;

