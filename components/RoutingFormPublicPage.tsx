import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import type { RoutingForm, RoutingQuestion } from './RoutingFormBuilder';

interface Props {
  formId: string;
  lang?: 'en' | 'ar';
}

const API_BASE: string =
  (import.meta.env?.VITE_API_URL as string | undefined) || 'http://localhost:3001';

/**
 * RoutingFormPublicPage
 *
 * Public-facing routing form. Loads a form by id, renders the configured
 * fields, then on submit routes the user to whichever booking URL the server
 * resolved from the answers.
 */
export const RoutingFormPublicPage: React.FC<Props> = ({ formId, lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<RoutingForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/routing-forms/public/${formId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Form not found');
        }
        const data = (await res.json()) as RoutingForm;
        if (!cancelled) setForm(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load form');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formId]);

  const setAnswer = (fieldId: string, val: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: val }));
  };

  const validate = (): string | null => {
    if (!form) return null;
    for (const q of form.fields) {
      if (!q.required) continue;
      const v = answers[q.id];
      if (q.type === 'checkbox') {
        if (!Array.isArray(v) || v.length === 0) {
          return lang === 'ar' ? `الحقل "${q.label}" مطلوب` : `"${q.label}" is required`;
        }
      } else {
        if (!v || (typeof v === 'string' && !v.trim())) {
          return lang === 'ar' ? `الحقل "${q.label}" مطلوب` : `"${q.label}" is required`;
        }
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/routing-forms/public/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Submit failed');
      }
      const data = (await res.json()) as { bookingUrl?: string; routingSubmissionId?: string };
      if (data.bookingUrl) {
        const url = new URL(
          data.bookingUrl,
          typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
        );
        if (data.routingSubmissionId) {
          url.searchParams.set('routingSubmissionId', data.routingSubmissionId);
        }
        window.location.href = url.toString();
      } else {
        setError(lang === 'ar' ? 'لا يوجد توجيه مطابق' : 'No matching route');
      }
    } catch (err: any) {
      setError(err.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const labels = {
    submit: lang === 'ar' ? 'إرسال' : 'Submit',
    loading: lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…',
    notFound: lang === 'ar' ? 'النموذج غير موجود' : 'Form not found',
    branding: 'Powered by Cadence',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="animate-pulse text-slate-400 text-sm">{labels.loading}</div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-slate-800 mb-2">{labels.notFound}</h1>
          {error && <p className="text-sm text-salmon">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">{form.name}</h1>
          {form.description && (
            <p className="text-sm text-slate-500 mb-6">{form.description}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {form.fields.map((q) => (
              <FieldRenderer
                key={q.id}
                question={q}
                value={answers[q.id]}
                onChange={(v) => setAnswer(q.id, v)}
              />
            ))}

            {error && (
              <div className="text-salmon text-xs font-bold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth loading={submitting}>
              {labels.submit}
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">{labels.branding}</p>
      </div>
    </div>
  );
};

const FieldRenderer: React.FC<{
  question: RoutingQuestion;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
}> = ({ question, value, onChange }) => {
  const labelEl = (
    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
      {question.label}
      {question.required && <span className="text-[#8A1538] ml-1">*</span>}
    </label>
  );

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#8A1538] focus:ring-2 focus:ring-[#8A1538]/20 outline-none transition-all';

  if (question.type === 'textarea') {
    return (
      <div>
        {labelEl}
        <textarea
          rows={3}
          required={question.required}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} resize-none`}
        />
      </div>
    );
  }
  if (question.type === 'select') {
    return (
      <div>
        {labelEl}
        <select
          required={question.required}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        >
          <option value="">—</option>
          {(question.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (question.type === 'radio') {
    return (
      <div>
        {labelEl}
        <div className="space-y-2">
          {(question.options || []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="text-[#8A1538] focus:ring-[#8A1538]"
              />
              <span className="text-sm text-slate-700">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
  if (question.type === 'checkbox') {
    const arr = Array.isArray(value) ? value : [];
    const opts = question.options || [];
    if (opts.length === 0) {
      // single boolean checkbox
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked ? 'true' : '')}
            className="rounded text-[#8A1538] focus:ring-[#8A1538]"
          />
          <span className="text-sm text-slate-700">
            {question.label}
            {question.required && <span className="text-[#8A1538] ml-1">*</span>}
          </span>
        </label>
      );
    }
    return (
      <div>
        {labelEl}
        <div className="space-y-2">
          {opts.map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={arr.includes(opt)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...arr, opt]
                    : arr.filter((x) => x !== opt);
                  onChange(next);
                }}
                className="rounded text-[#8A1538] focus:ring-[#8A1538]"
              />
              <span className="text-sm text-slate-700">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
  // text, email
  return (
    <div>
      {labelEl}
      <input
        type={question.type === 'email' ? 'email' : 'text'}
        required={question.required}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </div>
  );
};

export default RoutingFormPublicPage;
