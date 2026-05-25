/**
 * Calendar Sync Settings Component
 * 
 * Allows users to connect/disconnect Google Calendar and Microsoft Outlook
 * for 2-way sync functionality.
 */

import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Language } from '../types';

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

interface CalendarSyncSettingsProps {
  accessToken: string;
  t: (key: string) => string;
  lang: Language;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const CalendarSyncSettings: React.FC<CalendarSyncSettingsProps> = ({
  accessToken,
  t,
  lang
}) => {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRTL = lang === 'ar';

  // Fetch calendar status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/calendar/status`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch (err) {
        console.error('Failed to fetch calendar status:', err);
        setError('Failed to load calendar status');
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, [accessToken]);

  // Check for success/error in URL params (from OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const urlError = params.get('error');
    
    if (success === 'google_connected' || success === 'microsoft_connected') {
      // Refresh status after connection
      window.history.replaceState({}, '', window.location.pathname);
      setLoading(true);
      fetch(`${API_BASE}/calendar/status`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
        .then(res => res.json())
        .then(data => setStatus(data))
        .finally(() => setLoading(false));
    }
    
    if (urlError) {
      setError(`Connection failed: ${urlError.replace(/_/g, ' ')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [accessToken]);

  const handleConnect = async (provider: 'google' | 'microsoft') => {
    try {
      const response = await fetch(`${API_BASE}/calendar/${provider}/connect`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const { authUrl } = await response.json();
        window.location.href = authUrl;
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to start connection');
      }
    } catch (err) {
      setError('Failed to connect calendar');
    }
  };

  const handleDisconnect = async (provider: 'google' | 'microsoft') => {
    if (!confirm(`Are you sure you want to disconnect ${provider === 'google' ? 'Google Calendar' : 'Microsoft Outlook'}?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/calendar/${provider}/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        setStatus(prev => prev ? {
          ...prev,
          connections: prev.connections.filter(c => c.provider !== provider)
        } : null);
      }
    } catch (err) {
      setError('Failed to disconnect calendar');
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`${API_BASE}/calendar/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Refresh status
        const statusRes = await fetch(`${API_BASE}/calendar/status`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (statusRes.ok) {
          setStatus(await statusRes.json());
        }
      }
    } catch (err) {
      setError('Failed to sync calendars');
    } finally {
      setSyncing(false);
    }
  };

  const toggleSync = async (provider: 'google' | 'microsoft', enabled: boolean) => {
    try {
      await fetch(`${API_BASE}/calendar/${provider}/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ syncEnabled: enabled })
      });

      setStatus(prev => prev ? {
        ...prev,
        connections: prev.connections.map(c =>
          c.provider === provider ? { ...c, syncEnabled: enabled } : c
        )
      } : null);
    } catch (err) {
      setError('Failed to update sync settings');
    }
  };

  // Multi-calendar picker — users with multiple Google/MS calendars can choose
  // which one Cadence reads from and writes to.
  const [calendars, setCalendars] = useState<Record<'google' | 'microsoft', { id: string; summary?: string; name?: string; primary?: boolean }[]>>({ google: [], microsoft: [] });
  const [calendarsLoading, setCalendarsLoading] = useState<Record<'google' | 'microsoft', boolean>>({ google: false, microsoft: false });

  useEffect(() => {
    if (!status || !accessToken) return;
    (['google', 'microsoft'] as const).forEach(provider => {
      const conn = status.connections.find(c => c.provider === provider);
      if (!conn) return;
      setCalendarsLoading(prev => ({ ...prev, [provider]: true }));
      fetch(`${API_BASE}/calendar/calendars?provider=${provider}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then(r => r.ok ? r.json() : { calendars: [] })
        .then(d => setCalendars(prev => ({ ...prev, [provider]: d.calendars || [] })))
        .catch(() => setCalendars(prev => ({ ...prev, [provider]: [] })))
        .finally(() => setCalendarsLoading(prev => ({ ...prev, [provider]: false })));
    });
  }, [status, accessToken]);

  const handleCalendarChange = async (provider: 'google' | 'microsoft', calendarId: string) => {
    try {
      await fetch(`${API_BASE}/calendar/${provider}/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ calendarId }),
      });
      setStatus(prev => prev ? {
        ...prev,
        connections: prev.connections.map(c =>
          c.provider === provider ? { ...c, calendarId } : c
        ),
      } : null);
    } catch (err) {
      setError(isRTL ? 'فشل تحديث التقويم' : 'Failed to update calendar');
    }
  };

  const getConnectionForProvider = (provider: 'google' | 'microsoft') => {
    return status?.connections.find(c => c.provider === provider);
  };

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return isRTL ? 'لم تتم المزامنة بعد' : 'Never synced';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return isRTL ? 'الآن' : 'Just now';
    if (diffMins < 60) return isRTL ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return isRTL ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    return date.toLocaleDateString(isRTL ? 'ar-QA' : 'en-US');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8A1538]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">
            {isRTL ? 'مزامنة التقويم' : 'Calendar Sync'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isRTL 
              ? 'اربط تقويمك لمزامنة ثنائية الاتجاه مع الاجتماعات' 
              : 'Connect your calendar for 2-way sync with meetings'
            }
          </p>
        </div>
        
        {status?.connections.length ? (
          <Button
            onClick={handleManualSync}
            disabled={syncing}
            variant="ghost"
            className="flex items-center gap-2"
          >
            <svg 
              className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing 
              ? (isRTL ? 'جاري المزامنة...' : 'Syncing...') 
              : (isRTL ? 'مزامنة الآن' : 'Sync Now')
            }
          </Button>
        ) : null}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Google Calendar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Google Icon */}
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center">
              <svg className="w-7 h-7" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-white">
                Google Calendar
              </h4>
              {getConnectionForProvider('google') ? (
                <p className="text-sm text-palm">
                  {isRTL ? 'متصل' : 'Connected'} • {getConnectionForProvider('google')?.calendarName}
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  {status?.configured.google 
                    ? (isRTL ? 'غير متصل' : 'Not connected')
                    : (isRTL ? 'غير مهيأ' : 'Not configured')
                  }
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {getConnectionForProvider('google') ? (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getConnectionForProvider('google')?.syncEnabled || false}
                    onChange={(e) => toggleSync('google', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-[#8A1538]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-palm"></div>
                  <span className="text-xs text-slate-500">{isRTL ? 'مزامنة' : 'Sync'}</span>
                </label>
                <Button onClick={() => handleDisconnect('google')} variant="ghost" className="text-red-500 hover:text-red-700">
                  {isRTL ? 'قطع الاتصال' : 'Disconnect'}
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => handleConnect('google')}
                disabled={!status?.configured.google}
                variant="primary"
              >
                {isRTL ? 'ربط' : 'Connect'}
              </Button>
            )}
          </div>
        </div>
        
        {getConnectionForProvider('google') && (
          <>
            {calendars.google.length > 1 && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  {isRTL ? 'التقويم المحدد' : 'Selected calendar'}
                </label>
                <select
                  value={getConnectionForProvider('google')?.calendarId || ''}
                  onChange={(e) => handleCalendarChange('google', e.target.value)}
                  disabled={calendarsLoading.google}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-[#8A1538]"
                >
                  {calendars.google.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.summary || c.name || c.id}{c.primary ? (isRTL ? ' (أساسي)' : ' (primary)') : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
              <span>{isRTL ? 'آخر مزامنة:' : 'Last sync:'} {formatLastSync(getConnectionForProvider('google')?.lastSyncAt || null)}</span>
              <span>{isRTL ? 'متصل منذ:' : 'Connected:'} {new Date(getConnectionForProvider('google')?.connectedAt || '').toLocaleDateString()}</span>
            </div>
          </>
        )}
      </div>

      {/* Microsoft Outlook */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Microsoft Icon */}
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center">
              <svg className="w-7 h-7" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
            </div>
            
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-white">
                Microsoft Outlook
              </h4>
              {getConnectionForProvider('microsoft') ? (
                <p className="text-sm text-palm">
                  {isRTL ? 'متصل' : 'Connected'} • {getConnectionForProvider('microsoft')?.calendarName}
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  {status?.configured.microsoft 
                    ? (isRTL ? 'غير متصل' : 'Not connected')
                    : (isRTL ? 'غير مهيأ' : 'Not configured')
                  }
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {getConnectionForProvider('microsoft') ? (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getConnectionForProvider('microsoft')?.syncEnabled || false}
                    onChange={(e) => toggleSync('microsoft', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-[#8A1538]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-palm"></div>
                  <span className="text-xs text-slate-500">{isRTL ? 'مزامنة' : 'Sync'}</span>
                </label>
                <Button onClick={() => handleDisconnect('microsoft')} variant="ghost" className="text-red-500 hover:text-red-700">
                  {isRTL ? 'قطع الاتصال' : 'Disconnect'}
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => handleConnect('microsoft')}
                disabled={!status?.configured.microsoft}
                variant="primary"
              >
                {isRTL ? 'ربط' : 'Connect'}
              </Button>
            )}
          </div>
        </div>
        
        {getConnectionForProvider('microsoft') && (
          <>
            {calendars.microsoft.length > 1 && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  {isRTL ? 'التقويم المحدد' : 'Selected calendar'}
                </label>
                <select
                  value={getConnectionForProvider('microsoft')?.calendarId || ''}
                  onChange={(e) => handleCalendarChange('microsoft', e.target.value)}
                  disabled={calendarsLoading.microsoft}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-[#8A1538]"
                >
                  {calendars.microsoft.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.summary || c.name || c.id}{c.primary ? (isRTL ? ' (أساسي)' : ' (primary)') : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
              <span>{isRTL ? 'آخر مزامنة:' : 'Last sync:'} {formatLastSync(getConnectionForProvider('microsoft')?.lastSyncAt || null)}</span>
              <span>{isRTL ? 'متصل منذ:' : 'Connected:'} {new Date(getConnectionForProvider('microsoft')?.connectedAt || '').toLocaleDateString()}</span>
            </div>
          </>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h5 className="font-medium text-blue-800 dark:text-blue-200 text-sm mb-1">
              {isRTL ? 'كيف تعمل المزامنة' : 'How sync works'}
            </h5>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>• {isRTL ? 'الاجتماعات الموافق عليها تُضاف تلقائياً إلى تقويمك' : 'Approved meetings are automatically added to your calendar'}</li>
              <li>• {isRTL ? 'أحداث تقويمك تظهر كأوقات مشغولة في Cadence' : 'Your calendar events appear as busy times in Cadence'}</li>
              <li>• {isRTL ? 'المزامنة تتم كل 15 دقيقة تلقائياً' : 'Sync runs automatically every 15 minutes'}</li>
              <li>• {isRTL ? 'تغييرات الاجتماعات تُحدّث في كلا الاتجاهين' : 'Meeting changes update in both directions'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarSyncSettings;

