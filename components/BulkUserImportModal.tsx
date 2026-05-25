import React, { useMemo, useState } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

interface BulkUserImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported?: () => void;
  lang?: 'en' | 'ar';
}

interface ParsedRow {
  raw: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  teamId?: string;
  error?: string;
}

interface ImportResult {
  row: number;
  ok: boolean;
  message?: string;
  username?: string;
}

const REQUIRED_HEADERS = ['name', 'username', 'email', 'role'];

const parseCsv = (text: string): ParsedRow[] => {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
  const idx: Record<string, number> = {};
  for (const h of REQUIRED_HEADERS) idx[h] = headers.indexOf(h);
  idx.teamid = headers.indexOf('teamid');

  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const row: ParsedRow = { raw: line };
    row.name = idx.name >= 0 ? cols[idx.name] : '';
    row.username = idx.username >= 0 ? cols[idx.username] : '';
    row.email = idx.email >= 0 ? cols[idx.email] : '';
    row.role = idx.role >= 0 ? cols[idx.role] : '';
    row.teamId = idx.teamid >= 0 ? cols[idx.teamid] : undefined;

    const missing: string[] = [];
    for (const h of REQUIRED_HEADERS) {
      if (idx[h] < 0 || !cols[idx[h]]) missing.push(h);
    }
    if (missing.length) row.error = `Missing: ${missing.join(', ')}`;
    return row;
  });
};

/**
 * BulkUserImportModal
 *
 * Admin bulk-import. The user pastes CSV, we preview parsed rows, then POST
 * the array to /api/admin/users/bulk-import and show per-row results.
 */
export const BulkUserImportModal: React.FC<BulkUserImportModalProps> = ({ isOpen, onClose, onImported, lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [csv, setCsv] = useState('name,username,email,role,teamId\n');
  const [results, setResults] = useState<ImportResult[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => parseCsv(csv), [csv]);

  if (!isOpen) return null;

  const validRows = rows.filter((r) => !r.error);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiJson<ImportResult[]>('/api/admin/users/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: validRows.map((r) => ({
            name: r.name,
            username: r.username,
            email: r.email,
            role: r.role,
            teamId: r.teamId,
          })),
        }),
      });
      setResults(Array.isArray(res) ? res : []);
      onImported?.();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || (lang === 'ar' ? 'فشل الاستيراد' : 'Import failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'استيراد مستخدمين بالجملة' : 'Bulk import users',
    subtitle: lang === 'ar' ? 'الصق CSV مع الرؤوس: name,username,email,role,teamId' : 'Paste CSV with headers: name,username,email,role,teamId',
    preview: lang === 'ar' ? 'معاينة' : 'Preview',
    import: lang === 'ar' ? 'استيراد' : 'Import',
    cancel: lang === 'ar' ? 'إلغاء' : 'Close',
    valid: lang === 'ar' ? 'صحيح' : 'Valid',
    invalid: lang === 'ar' ? 'خطأ' : 'Error',
    results: lang === 'ar' ? 'النتائج' : 'Results',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
          <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-display font-bold text-charcoal">{labels.title}</h3>
              <p className="text-xs text-gray-500 mt-1 font-mono">{labels.subtitle}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-charcoal p-2 rounded-full hover:bg-gray-100"
              aria-label={labels.cancel}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-8 py-6 max-h-[70vh] overflow-y-auto">
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={6}
              className="w-full bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono outline-none focus:ring-2 focus:ring-[#8A1538]"
              dir="ltr"
            />

            <div className="mt-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                {labels.preview} ({rows.length})
              </h4>
              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left rtl:text-right font-bold text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-3 py-2 text-left rtl:text-right font-bold text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-3 py-2 text-left rtl:text-right font-bold text-gray-500 uppercase tracking-wider">Username</th>
                      <th className="px-3 py-2 text-left rtl:text-right font-bold text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-3 py-2 text-left rtl:text-right font-bold text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-3 py-2 text-left rtl:text-right font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-gray-400 italic">
                          {lang === 'ar' ? 'لا توجد صفوف.' : 'No rows.'}
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, i) => (
                        <tr key={i} className={r.error ? 'bg-salmon/5' : ''}>
                          <td className="px-3 py-2 font-mono text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 text-charcoal">{r.name || '—'}</td>
                          <td className="px-3 py-2 text-charcoal font-mono">{r.username || '—'}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono">{r.email || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{r.role || '—'}</td>
                          <td className="px-3 py-2">
                            {r.error ? (
                              <span className="text-salmon font-bold text-[10px]">{r.error}</span>
                            ) : (
                              <span className="text-palm font-bold text-[10px]">{labels.valid}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {results.length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{labels.results}</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {results.map((r, i) => (
                    <div
                      key={i}
                      className={`text-xs font-mono px-3 py-1.5 rounded ${
                        r.ok ? 'bg-palm/5 text-palm' : 'bg-salmon/5 text-salmon'
                      }`}
                    >
                      #{r.row} {r.username || ''} — {r.ok ? '✓' : '✗'} {r.message || ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 text-salmon text-xs font-bold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r">
                {error}
              </div>
            )}
          </div>

          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              {labels.cancel}
            </Button>
            <Button onClick={handleSubmit} disabled={validRows.length === 0} loading={submitting}>
              {labels.import} ({validRows.length})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkUserImportModal;
