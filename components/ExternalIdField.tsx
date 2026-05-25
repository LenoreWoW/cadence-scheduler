/**
 * ExternalIdField
 *
 * Allows configuring an `external_ref_template` for a booking link — a
 * tokenized string used to mint external reference IDs (e.g. for CRM sync).
 * Supported tokens: {{date}}, {{slug}}, {{counter}}, {{uuid}}.
 *
 * PUT /api/booking-links/:id   { externalRefTemplate }
 */

import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

interface BookingLinkLike {
  id: string;
  slug?: string;
  externalRefTemplate?: string | null;
  external_ref_template?: string | null;
}

interface Props {
  link: BookingLinkLike;
  onChange?: () => void;
  lang?: 'en' | 'ar';
}

const TOKENS = ['{{date}}', '{{slug}}', '{{counter}}', '{{uuid}}'];

export const ExternalIdField: React.FC<Props> = ({ link, onChange, lang = 'en' }) => {
  const isRTL = lang === 'ar';

  const initial = link.externalRefTemplate ?? link.external_ref_template ?? '';

  const [template, setTemplate] = useState<string>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  );

  useEffect(() => {
    setTemplate(link.externalRefTemplate ?? link.external_ref_template ?? '');
  }, [link.id, link.externalRefTemplate, link.external_ref_template]);

  const handleSave = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      await apiJson(`/api/booking-links/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalRefTemplate: template.trim() || null }),
      });
      setMessage({ kind: 'success', text: isRTL ? 'تم الحفظ' : 'Saved' });
      onChange?.();
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

  // Preview the template with sample substitutions.
  const previewSample = template
    .replaceAll('{{date}}', new Date().toISOString().slice(0, 10))
    .replaceAll('{{slug}}', link.slug || 'my-link')
    .replaceAll('{{counter}}', '00042')
    .replaceAll('{{uuid}}', '7d3a-f4');

  const insertToken = (token: string) => {
    setTemplate((prev) => (prev ? `${prev}${token}` : token));
  };

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h4 className="text-sm font-bold text-charcoal">
          {isRTL ? 'قالب المعرّف الخارجي' : 'External ID template'}
        </h4>
        <p className="text-xs text-gray-500 mt-1">
          {isRTL
            ? 'يُولّد معرف لكل حجز للمزامنة مع CRM. اتركه فارغًا لتعطيله.'
            : 'Generates an external ID per booking — handy for CRM sync. Leave empty to disable.'}
        </p>
      </div>

      <input
        type="text"
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        placeholder="CADENCE-{{date}}-{{counter}}"
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538] font-mono"
      />

      <div className="flex flex-wrap gap-2">
        {TOKENS.map((tok) => (
          <button
            key={tok}
            type="button"
            onClick={() => insertToken(tok)}
            className="text-[11px] font-mono px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            {tok}
          </button>
        ))}
      </div>

      {template && (
        <p className="text-xs text-gray-500">
          {isRTL ? 'معاينة:' : 'Preview:'}{' '}
          <span className="font-mono text-charcoal">{previewSample}</span>
        </p>
      )}

      <div className="flex items-center justify-between">
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
          {isRTL ? 'حفظ القالب' : 'Save template'}
        </Button>
      </div>
    </div>
  );
};

export default ExternalIdField;
