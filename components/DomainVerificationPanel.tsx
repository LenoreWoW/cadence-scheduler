/**
 * DomainVerificationPanel
 *
 * Inside ProfileSettingsModal → Security & Data tab. Lets the user add a
 * domain, get a TXT record, copy it, and verify ownership.
 *
 * Endpoints:
 *   GET    /api/domains
 *   POST   /api/domains              { domain }
 *   POST   /api/domains/:id/verify
 *   DELETE /api/domains/:id
 */

import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiFetch, apiJson } from '../services/api';
import { Language } from '../types';

interface DomainRecord {
  id: string;
  domain: string;
  status: 'pending' | 'verified' | 'failed';
  txtName?: string | null;
  txtValue: string;
  createdAt?: string;
  verifiedAt?: string | null;
}

interface Props {
  lang: Language;
}

export const DomainVerificationPanel: React.FC<Props> = ({ lang }) => {
  const isRTL = lang === 'ar';

  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newDomain, setNewDomain] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchDomains = async () => {
    setError(null);
    try {
      const res = await apiFetch('/api/domains');
      if (res.status === 404) {
        setUnavailable(true);
        return;
      }
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setDomains(Array.isArray(data) ? data : data.domains || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const handleAdd = async () => {
    const value = newDomain.trim();
    if (!value) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiJson('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: value }),
      });
      setNewDomain('');
      await fetchDomains();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Failed to add');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    setError(null);
    try {
      const updated = await apiJson<DomainRecord>(`/api/domains/${id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      setDomains((prev) => prev.map((d) => (d.id === id ? { ...d, ...updated } : d)));
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Verification failed');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(isRTL ? 'حذف هذا المجال؟' : 'Remove this domain?')) return;
    try {
      await apiFetch(`/api/domains/${id}`, { method: 'DELETE' });
      setDomains((prev) => prev.filter((d) => d.id !== id));
    } catch (err: any) {
      setError(err?.message || 'Failed to remove');
    }
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (loading) {
    return <div className="animate-pulse h-32 bg-gray-100 rounded-xl" />;
  }

  if (unavailable) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500">
        {isRTL ? 'التحقق من المجال غير متاح بعد.' : 'Domain verification coming soon.'}
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">
          {isRTL ? 'التحقق من المجال' : 'Domain verification'}
        </h4>
        <p className="text-xs text-gray-500 mt-1">
          {isRTL
            ? 'أضف مجالك للسماح بالإرسال من بريدك المخصص، أو لتفعيل عمليات الاكتشاف على مستوى المجال.'
            : 'Add your domain to send from your own address or unlock domain-level features.'}
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="example.com"
          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538] font-mono"
        />
        <Button onClick={handleAdd} loading={submitting} variant="secondary">
          {isRTL ? 'إضافة' : 'Add domain'}
        </Button>
      </div>

      {error && (
        <div className="text-salmon text-xs font-bold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r">
          {error}
        </div>
      )}

      {domains.length === 0 ? (
        <p className="text-xs text-gray-400 italic">
          {isRTL ? 'لا توجد مجالات.' : 'No domains yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {domains.map((d) => (
            <div key={d.id} className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-charcoal">{d.domain}</span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      d.status === 'verified'
                        ? 'bg-palm/10 text-palm'
                        : d.status === 'failed'
                          ? 'bg-salmon/10 text-salmon'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {d.status === 'verified'
                      ? (isRTL ? 'مُحقَّق' : 'Verified')
                      : d.status === 'failed'
                        ? (isRTL ? 'فشل' : 'Failed')
                        : (isRTL ? 'قيد الانتظار' : 'Pending')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {d.status !== 'verified' && (
                    <Button
                      onClick={() => handleVerify(d.id)}
                      loading={verifyingId === d.id}
                      variant="secondary"
                    >
                      {isRTL ? 'تحقق' : 'Verify'}
                    </Button>
                  )}
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider"
                  >
                    {isRTL ? 'حذف' : 'Remove'}
                  </button>
                </div>
              </div>

              {d.status !== 'verified' && (
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-2">
                  <p className="text-[11px] uppercase tracking-widest text-gray-500 font-bold">
                    {isRTL
                      ? 'أضف هذا السجل من نوع TXT في DNS'
                      : 'Add this TXT record to your DNS'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">
                      {d.txtName || `_cadence.${d.domain}`}
                    </span>
                    <code className="block bg-white border border-gray-200 rounded-md px-2 py-1.5 text-xs font-mono text-charcoal overflow-x-auto">
                      {d.txtValue}
                    </code>
                    <button
                      onClick={() => copy(d.id, d.txtValue)}
                      className="text-xs font-bold px-2 py-1.5 rounded-md bg-white border border-gray-200 hover:bg-gray-50 text-charcoal uppercase tracking-wider"
                    >
                      {copiedId === d.id
                        ? (isRTL ? 'تم' : 'Copied')
                        : (isRTL ? 'نسخ' : 'Copy')}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {isRTL
                      ? 'قد يستغرق انتشار DNS بضع دقائق.'
                      : 'DNS propagation can take a few minutes.'}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DomainVerificationPanel;
