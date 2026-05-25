import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

interface HubSpotStatus {
  connected: boolean;
  accountEmail?: string | null;
  connectedAt?: string | null;
}

interface Props {
  lang?: 'en' | 'ar';
}

const API_BASE: string =
  (import.meta.env?.VITE_API_URL as string | undefined) || 'http://localhost:3001';

/**
 * CRMConnectionsPanel
 *
 * HubSpot connection management — connect via OAuth, disconnect, and trigger
 * a manual sync. Auto-sync of new bookings is handled server-side.
 */
export const CRMConnectionsPanel: React.FC<Props> = ({ lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [status, setStatus] = useState<HubSpotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<HubSpotStatus>('/api/crm/hubspot/status');
      setStatus(data || { connected: false });
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleConnect = () => {
    // Backend handles the OAuth redirect, then bounces back to the app.
    window.location.href = `${API_BASE}/api/crm/hubspot/connect`;
  };

  const handleDisconnect = async () => {
    setError(null);
    try {
      await apiJson('/api/crm/hubspot', { method: 'DELETE' });
      setStatus({ connected: false });
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Disconnect failed');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    setError(null);
    try {
      const res = await apiJson<{ ok?: boolean; synced?: number; message?: string }>(
        '/api/crm/hubspot/sync',
        { method: 'POST' },
      );
      setSyncMsg(
        res.message ||
          (typeof res.synced === 'number'
            ? lang === 'ar'
              ? `تمت مزامنة ${res.synced} اجتماع`
              : `Synced ${res.synced} meeting(s)`
            : lang === 'ar'
              ? 'تمت المزامنة'
              : 'Synced'),
      );
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'الاتصالات الخارجية' : 'CRM connections',
    subtitle: lang === 'ar' ? 'صل Cadence بنظام CRM الخاص بك.' : 'Connect Cadence to your CRM.',
    connect: lang === 'ar' ? 'ربط HubSpot' : 'Connect HubSpot',
    disconnect: lang === 'ar' ? 'إلغاء الربط' : 'Disconnect',
    sync: lang === 'ar' ? 'مزامنة الآن' : 'Sync now',
    connected: lang === 'ar' ? 'متصل' : 'Connected',
    notConnected: lang === 'ar' ? 'غير متصل' : 'Not connected',
    autoSync:
      lang === 'ar'
        ? 'المزامنة التلقائية مفعّلة — الحجوزات الجديدة تُرسَل إلى HubSpot تلقائياً.'
        : 'Auto-sync enabled — new bookings push to HubSpot automatically.',
  };

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">{labels.title}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{labels.subtitle}</p>
      </div>

      <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 font-bold text-sm">
              HS
            </div>
            <div>
              <p className="text-sm font-bold text-charcoal">HubSpot</p>
              {loading ? (
                <p className="text-[10px] text-gray-400">…</p>
              ) : status?.connected ? (
                <p className="text-[10px] text-palm font-bold">
                  {labels.connected}
                  {status.accountEmail ? ` · ${status.accountEmail}` : ''}
                </p>
              ) : (
                <p className="text-[10px] text-gray-400">{labels.notConnected}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {status?.connected ? (
              <>
                <Button variant="secondary" onClick={handleSync} loading={syncing}>
                  {labels.sync}
                </Button>
                <button
                  onClick={handleDisconnect}
                  className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider"
                >
                  {labels.disconnect}
                </button>
              </>
            ) : (
              <Button onClick={handleConnect}>{labels.connect}</Button>
            )}
          </div>
        </div>
        {status?.connected && (
          <p className="text-[11px] text-gray-500 mt-3 italic">{labels.autoSync}</p>
        )}
        {syncMsg && (
          <div className="mt-3 text-xs font-bold p-2 rounded bg-palm/5 text-palm">{syncMsg}</div>
        )}
        {error && (
          <div className="mt-3 text-xs font-bold p-2 rounded bg-salmon/5 text-salmon">{error}</div>
        )}
      </div>
    </div>
  );
};

export default CRMConnectionsPanel;
