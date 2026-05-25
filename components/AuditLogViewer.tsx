import React, { useCallback, useEffect, useState } from 'react';
import { Button } from './Button';
import { apiJson, apiFetch } from '../services/api';

interface AuditLogRow {
  id: string;
  timestamp: string;
  action: string;
  userId?: string | null;
  userName?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  status?: 'success' | 'failure' | 'info' | null;
}

interface AuditLogResponse {
  rows: AuditLogRow[];
  total: number;
}

interface AuditLogViewerProps {
  lang?: 'en' | 'ar';
}

const STATUS_PILLS: { value: string; label: string; tone: string }[] = [
  { value: '', label: 'All', tone: 'gray' },
  { value: 'success', label: 'Success', tone: 'palm' },
  { value: 'failure', label: 'Failure', tone: 'salmon' },
  { value: 'info', label: 'Info', tone: 'skyline' },
];

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ lang = 'en' }) => {
  const isRTL = lang === 'ar';

  const [statusFilter, setStatusFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('action', statusFilter);
    if (userIdFilter) params.set('userId', userIdFilter);
    if (searchText) params.set('search', searchText);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    return params.toString();
  }, [statusFilter, userIdFilter, searchText, fromDate, toDate, page, pageSize]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<AuditLogResponse>(`/api/audit?${buildQuery()}`);
      setRows(res.rows || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async () => {
    try {
      const res = await apiFetch(`/api/audit/export.csv?${buildQuery()}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      /* swallow — could surface a toast in the future */
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const labels = {
    title: lang === 'ar' ? 'سجل المراجعة' : 'Audit Log',
    subtitle: lang === 'ar' ? 'كل إجراء يحدث في النظام' : 'Every action that happens in the system',
    search: lang === 'ar' ? 'بحث...' : 'Search...',
    from: lang === 'ar' ? 'من' : 'From',
    to: lang === 'ar' ? 'إلى' : 'To',
    userId: lang === 'ar' ? 'معرّف المستخدم' : 'User ID',
    export: lang === 'ar' ? 'تصدير CSV' : 'Export CSV',
    apply: lang === 'ar' ? 'تطبيق' : 'Apply',
    none: lang === 'ar' ? 'لا توجد إدخالات' : 'No entries match these filters.',
    prev: lang === 'ar' ? 'السابق' : 'Prev',
    next: lang === 'ar' ? 'التالي' : 'Next',
    page: lang === 'ar' ? 'صفحة' : 'Page',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 min-h-[500px]" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-display font-bold text-charcoal">{labels.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{labels.subtitle}</p>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          {labels.export}
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_PILLS.map((p) => (
            <button
              key={p.value}
              onClick={() => {
                setStatusFilter(p.value);
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                statusFilter === p.value
                  ? 'bg-[#8A1538] text-white border-[#8A1538]'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder={labels.search}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
          />
          <input
            type="text"
            placeholder={labels.userId}
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none font-mono"
          />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label={labels.from}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label={labels.to}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
          />
        </div>
        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={() => {
              setPage(1);
              fetchLogs();
            }}
          >
            {labels.apply}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-salmon/5 border border-salmon/20 text-salmon text-sm rounded-lg p-4 mb-6">{error}</div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left rtl:text-right text-xs font-bold uppercase tracking-widest text-gray-500">
                {lang === 'ar' ? 'الوقت' : 'Timestamp'}
              </th>
              <th className="px-4 py-3 text-left rtl:text-right text-xs font-bold uppercase tracking-widest text-gray-500">
                {lang === 'ar' ? 'الإجراء' : 'Action'}
              </th>
              <th className="px-4 py-3 text-left rtl:text-right text-xs font-bold uppercase tracking-widest text-gray-500">
                {lang === 'ar' ? 'المستخدم' : 'User'}
              </th>
              <th className="px-4 py-3 text-left rtl:text-right text-xs font-bold uppercase tracking-widest text-gray-500">
                {lang === 'ar' ? 'التفاصيل' : 'Details'}
              </th>
              <th className="px-4 py-3 text-left rtl:text-right text-xs font-bold uppercase tracking-widest text-gray-500">IP</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm italic">
                  <div className="w-6 h-6 mx-auto border-2 border-gray-200 border-t-[#8A1538] rounded-full animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm italic">
                  {labels.none}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">
                    {new Date(row.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-charcoal text-[10px] font-bold uppercase tracking-wide">
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-charcoal">
                    {row.userName || row.userId || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-md truncate" title={row.details || ''}>
                    {row.details || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-400">{row.ipAddress || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-gray-500 font-mono">
            {labels.page} {page} / {totalPages} · {total} {lang === 'ar' ? 'إدخال' : 'entries'}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-md border border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-500 hover:border-[#8A1538] hover:text-[#8A1538] disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-500 transition-colors"
            >
              {labels.prev}
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-md border border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-500 hover:border-[#8A1538] hover:text-[#8A1538] disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-500 transition-colors"
            >
              {labels.next}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogViewer;
