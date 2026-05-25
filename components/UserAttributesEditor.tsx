/**
 * UserAttributesEditor
 *
 * Free-form key/value attributes editor for users. Used in two places:
 *  - scope="me"        → ProfileSettingsModal (Profile tab)
 *  - scope="user"      → TeamManagement Users tab (admin/manager editing
 *                        another user)
 *
 * Endpoints:
 *   GET /api/users/me/attributes
 *   PUT /api/users/me/attributes              { attributes: { key: value, ... } }
 *   GET /api/users/:id/attributes
 *   PUT /api/users/:id/attributes             { attributes: { key: value, ... } }
 */

import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiFetch, apiJson } from '../services/api';
import { Language } from '../types';

interface Props {
  /** "me" = current user, otherwise the target userId. */
  scope: 'me' | string;
  lang: Language;
}

interface AttrEntry {
  id: string;
  key: string;
  value: string;
}

const newId = () => Math.random().toString(36).slice(2, 9);

function endpointFor(scope: string): string {
  if (scope === 'me') return '/api/users/me/attributes';
  return `/api/users/${encodeURIComponent(scope)}/attributes`;
}

export const UserAttributesEditor: React.FC<Props> = ({ scope, lang }) => {
  const isRTL = lang === 'ar';

  const [entries, setEntries] = useState<AttrEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setEntries([]);
      try {
        const res = await apiFetch(endpointFor(scope));
        if (res.status === 404) {
          if (!cancelled) setUnavailable(true);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        const raw = data?.attributes || data || {};
        const list: AttrEntry[] = Object.entries(raw).map(([k, v]) => ({
          id: newId(),
          key: k,
          value: typeof v === 'string' ? v : JSON.stringify(v),
        }));
        if (!cancelled) setEntries(list);
      } catch {
        /* swallow */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const addRow = () => {
    setEntries((es) => [...es, { id: newId(), key: '', value: '' }]);
  };

  const updateRow = (id: string, patch: Partial<AttrEntry>) => {
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeRow = (id: string) => {
    setEntries((es) => es.filter((e) => e.id !== id));
  };

  const handleSave = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const attributes: Record<string, string> = {};
      for (const e of entries) {
        const k = e.key.trim();
        if (!k) continue;
        attributes[k] = e.value;
      }
      await apiJson(endpointFor(scope), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributes }),
      });
      setMessage({ kind: 'success', text: isRTL ? 'تم الحفظ' : 'Saved' });
    } catch (err: any) {
      setMessage({
        kind: 'error',
        text:
          err?.body?.error ||
          err?.message ||
          (isRTL ? 'فشل الحفظ' : 'Failed to save'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-24 bg-gray-100 rounded-xl" />;
  }

  if (unavailable) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500">
        {isRTL ? 'سمات المستخدم غير متاحة بعد.' : 'User attributes coming soon.'}
      </div>
    );
  }

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-charcoal">
            {isRTL ? 'السمات' : 'Attributes'}
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            {isRTL
              ? 'أزواج مفتاح/قيمة لاستخدامها في التوجيه (مثل: territory: NA).'
              : 'Key/value pairs you can use for routing (e.g. territory: NA).'}
          </p>
        </div>
        <Button variant="ghost" onClick={addRow}>
          {isRTL ? '+ إضافة سمة' : '+ Add attribute'}
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-gray-400 italic">
          {isRTL ? 'لا توجد سمات بعد.' : 'No attributes yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="grid grid-cols-12 gap-2 items-center">
              <input
                type="text"
                placeholder={isRTL ? 'المفتاح' : 'key'}
                value={e.key}
                onChange={(ev) => updateRow(e.id, { key: ev.target.value })}
                className="col-span-4 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538] font-mono"
              />
              <input
                type="text"
                placeholder={isRTL ? 'القيمة' : 'value'}
                value={e.value}
                onChange={(ev) => updateRow(e.id, { value: ev.target.value })}
                className="col-span-7 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
              />
              <button
                type="button"
                onClick={() => removeRow(e.id)}
                className="col-span-1 text-salmon hover:text-red-700 text-lg"
                aria-label={isRTL ? 'حذف' : 'Remove'}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        {message && (
          <span
            className={`text-xs font-bold ${
              message.kind === 'success' ? 'text-palm' : 'text-salmon'
            }`}
          >
            {message.text}
          </span>
        )}
        <Button onClick={handleSave} loading={submitting} variant="secondary" className="ml-auto">
          {isRTL ? 'حفظ' : 'Save attributes'}
        </Button>
      </div>
    </div>
  );
};

export default UserAttributesEditor;
