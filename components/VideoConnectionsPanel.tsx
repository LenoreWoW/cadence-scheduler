/**
 * VideoConnectionsPanel
 *
 * Inside ProfileSettingsModal → Integrations tab. Lists video providers and
 * lets the user attach a Daily.co API key (Zoom / Teams flow through env on
 * the backend, so they appear as informational tiles).
 *
 * Endpoints:
 *   GET    /api/video-connections
 *   POST   /api/video-connections    { provider, apiKey, domain? }
 *   DELETE /api/video-connections/:id
 */

import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiFetch, apiJson } from '../services/api';
import { Language } from '../types';

interface VideoConnection {
  id: string;
  provider: 'daily' | 'zoom' | 'teams' | 'whereby';
  domain?: string | null;
  maskedKey?: string | null;
  createdAt?: string;
}

interface VideoConnectionsResponse {
  connections: VideoConnection[];
  envProviders?: { zoom?: boolean; teams?: boolean };
}

interface Props {
  lang: Language;
}

export const VideoConnectionsPanel: React.FC<Props> = ({ lang }) => {
  const isRTL = lang === 'ar';

  const [connections, setConnections] = useState<VideoConnection[]>([]);
  const [envProviders, setEnvProviders] = useState<{ zoom?: boolean; teams?: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [domain, setDomain] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchConnections = async () => {
    setError(null);
    try {
      const res = await apiFetch('/api/video-connections');
      if (res.status === 404) {
        setUnavailable(true);
        setConnections([]);
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed (${res.status})`);
      }
      const data: VideoConnectionsResponse = await res.json();
      setConnections(data.connections || []);
      setEnvProviders(data.envProviders || {});
    } catch (err: any) {
      setError(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setError(isRTL ? 'مطلوب مفتاح API' : 'API key is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiJson('/api/video-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'daily',
          apiKey: apiKey.trim(),
          domain: domain.trim() || null,
        }),
      });
      setApiKey('');
      setDomain('');
      setShowForm(false);
      await fetchConnections();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Failed to connect');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(isRTL ? 'حذف هذا الاتصال؟' : 'Remove this connection?')) return;
    try {
      await apiFetch(`/api/video-connections/${id}`, { method: 'DELETE' });
      await fetchConnections();
    } catch {
      setError(isRTL ? 'فشل الحذف' : 'Failed to remove');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse h-20 bg-gray-100 rounded-xl" />
    );
  }

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">
          {isRTL ? 'موفرو الفيديو' : 'Video providers'}
        </h4>
        <p className="text-xs text-gray-500 mt-1">
          {isRTL
            ? 'وصل Daily.co لإنشاء روابط الاجتماعات تلقائياً. Zoom و Teams يستخدمان إعدادات الخادم.'
            : 'Connect Daily.co to auto-generate meeting links. Zoom & Teams use server-level env credentials.'}
        </p>
      </div>

      {unavailable ? (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500">
          {isRTL ? 'سيتوفر قريباً.' : 'Coming soon.'}
        </div>
      ) : (
        <>
          {/* Daily.co */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 font-bold">
                  D
                </div>
                <div>
                  <h5 className="text-sm font-bold text-charcoal">Daily.co</h5>
                  <p className="text-xs text-gray-500">
                    {connections.find((c) => c.provider === 'daily')
                      ? (isRTL ? 'متصل' : 'Connected')
                      : (isRTL ? 'غير متصل' : 'Not connected')}
                  </p>
                </div>
              </div>
              {!connections.find((c) => c.provider === 'daily') && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowForm((s) => !s);
                    setError(null);
                  }}
                >
                  {showForm ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? 'ربط' : 'Connect')}
                </Button>
              )}
            </div>

            {showForm && !connections.find((c) => c.provider === 'daily') && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                    {isRTL ? 'مفتاح API' : 'API key'}
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    autoComplete="off"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                    {isRTL ? 'النطاق (اختياري)' : 'Domain (optional)'}
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="yourteam.daily.co"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                  />
                </div>
                {error && (
                  <div className="text-salmon text-xs font-bold p-2 bg-salmon/5 border-l-2 border-salmon rounded-r">
                    {error}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button onClick={handleConnect} loading={submitting}>
                    {isRTL ? 'حفظ' : 'Save'}
                  </Button>
                </div>
              </div>
            )}

            {/* Connected rows */}
            {connections
              .filter((c) => c.provider === 'daily')
              .map((c) => (
                <div
                  key={c.id}
                  className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between"
                >
                  <div className="text-xs text-gray-600">
                    <span className="font-mono">{c.maskedKey || '••••••••'}</span>
                    {c.domain ? <span className="ml-2 text-gray-400">{c.domain}</span> : null}
                  </div>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider"
                  >
                    {isRTL ? 'حذف' : 'Remove'}
                  </button>
                </div>
              ))}
          </div>

          {/* Zoom & Teams (env-managed) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                  Z
                </div>
                <div>
                  <h5 className="text-sm font-bold text-charcoal">Zoom</h5>
                  <p className="text-xs text-gray-500">
                    {envProviders.zoom
                      ? (isRTL ? 'مُهيأ من الخادم' : 'Configured via env')
                      : (isRTL ? 'غير مُهيأ' : 'Not configured')}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                  T
                </div>
                <div>
                  <h5 className="text-sm font-bold text-charcoal">Microsoft Teams</h5>
                  <p className="text-xs text-gray-500">
                    {envProviders.teams
                      ? (isRTL ? 'مُهيأ من الخادم' : 'Configured via env')
                      : (isRTL ? 'غير مُهيأ' : 'Not configured')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoConnectionsPanel;
