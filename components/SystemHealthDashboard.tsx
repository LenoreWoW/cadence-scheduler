import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

interface HealthSnapshot {
  dbSizeBytes?: number;
  tableCounts?: Record<string, number>;
  lastReminderRunAt?: string | null;
  webhookSuccessCount?: number;
  webhookFailureCount?: number;
  calendarSyncErrorCount?: number;
  uptimeSeconds?: number;
  serverVersion?: string;
}

interface SystemHealthDashboardProps {
  lang?: 'en' | 'ar';
}

const formatBytes = (n: number | undefined): string => {
  if (!n || !Number.isFinite(n)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const formatRelative = (iso: string | null | undefined, lang: 'en' | 'ar'): string => {
  if (!iso) return lang === 'ar' ? 'لم يُشغَّل بعد' : 'Never';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return lang === 'ar' ? 'الآن' : 'just now';
  if (mins < 60) return lang === 'ar' ? `قبل ${mins} د` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return lang === 'ar' ? `قبل ${hrs} س` : `${hrs}h ago`;
  return new Date(iso).toLocaleString();
};

/**
 * SystemHealthDashboard
 *
 * Admin-only operational view. Fetches /api/admin/health and presents the
 * snapshot as readable cards.
 */
export const SystemHealthDashboard: React.FC<SystemHealthDashboardProps> = ({ lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [data, setData] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<HealthSnapshot>('/api/admin/health');
      setData(res);
    } catch (err: any) {
      setError(err?.body?.error || err?.message || (lang === 'ar' ? 'فشل التحميل' : 'Failed to load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const labels = {
    title: lang === 'ar' ? 'صحة النظام' : 'System Health',
    subtitle: lang === 'ar' ? 'مؤشرات تشغيلية في الوقت الحقيقي' : 'Real-time operational metrics',
    refresh: lang === 'ar' ? 'تحديث' : 'Refresh',
    dbSize: lang === 'ar' ? 'حجم قاعدة البيانات' : 'Database size',
    lastReminder: lang === 'ar' ? 'آخر تشغيل لجدولة التذكيرات' : 'Last reminder run',
    webhookSuccess: lang === 'ar' ? 'تسليم Webhook (نجاح)' : 'Webhook deliveries — success',
    webhookFailure: lang === 'ar' ? 'تسليم Webhook (فشل)' : 'Webhook deliveries — failure',
    calendarErrors: lang === 'ar' ? 'أخطاء مزامنة التقويم' : 'Calendar sync errors',
    serverVersion: lang === 'ar' ? 'إصدار الخادم' : 'Server version',
    tableCounts: lang === 'ar' ? 'أعداد الصفوف لكل جدول' : 'Rows per table',
    noData: lang === 'ar' ? 'لا توجد بيانات بعد' : 'No data yet',
  };

  const cards = data
    ? [
        { label: labels.dbSize, value: formatBytes(data.dbSizeBytes) },
        { label: labels.lastReminder, value: formatRelative(data.lastReminderRunAt, lang) },
        { label: labels.webhookSuccess, value: String(data.webhookSuccessCount ?? 0), tone: 'success' as const },
        { label: labels.webhookFailure, value: String(data.webhookFailureCount ?? 0), tone: (data.webhookFailureCount ?? 0) > 0 ? ('warn' as const) : undefined },
        { label: labels.calendarErrors, value: String(data.calendarSyncErrorCount ?? 0), tone: (data.calendarSyncErrorCount ?? 0) > 0 ? ('warn' as const) : undefined },
        { label: labels.serverVersion, value: data.serverVersion || '—' },
      ]
    : [];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 min-h-[500px]" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-display font-bold text-charcoal">{labels.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{labels.subtitle}</p>
        </div>
        <Button variant="secondary" onClick={fetchHealth} loading={loading}>
          {labels.refresh}
        </Button>
      </div>

      {error && (
        <div className="bg-salmon/5 border border-salmon/20 text-salmon text-sm rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-50 border border-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {cards.map((c) => (
              <div key={c.label} className="bg-gradient-to-br from-white to-gray-50 border border-gray-100 rounded-xl p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{c.label}</p>
                <p
                  className={`text-2xl font-display font-bold ${
                    c.tone === 'warn' ? 'text-salmon' : c.tone === 'success' ? 'text-palm' : 'text-charcoal'
                  }`}
                >
                  {c.value}
                </p>
              </div>
            ))}
          </div>

          {data.tableCounts && Object.keys(data.tableCounts).length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{labels.tableCounts}</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left rtl:text-right text-xs font-bold uppercase tracking-widest text-gray-500">
                        {lang === 'ar' ? 'الجدول' : 'Table'}
                      </th>
                      <th className="px-5 py-3 text-right rtl:text-left text-xs font-bold uppercase tracking-widest text-gray-500">
                        {lang === 'ar' ? 'العدد' : 'Rows'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(data.tableCounts).map(([name, count]) => (
                      <tr key={name} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5 font-mono text-xs text-charcoal">{name}</td>
                        <td className="px-5 py-2.5 text-right rtl:text-left font-mono text-xs text-gray-600">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-400 italic text-center py-12">{labels.noData}</p>
      )}
    </div>
  );
};

export default SystemHealthDashboard;
