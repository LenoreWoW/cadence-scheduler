import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

export type WorkflowTrigger =
  | 'booking.created'
  | 'booking.cancelled'
  | 'booking.approved'
  | 'booking.rejected'
  | 'before_meeting'
  | 'after_meeting';

export type WorkflowOp = 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt';

export interface WorkflowCondition {
  field: string;
  op: WorkflowOp;
  value: string;
}

export type WorkflowActionType =
  | 'send_email'
  | 'send_webhook'
  | 'notify_host'
  | 'tag_attendee'
  | 'create_followup';

export interface WorkflowAction {
  id: string;
  type: WorkflowActionType;
  config: Record<string, any>;
}

export interface Workflow {
  id?: string;
  name: string;
  triggerType: WorkflowTrigger;
  triggerConfig?: { offsetMinutes?: number };
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  active: boolean;
  teamId?: string | null;
}

interface Props {
  workflow?: Workflow;
  scope?: 'user' | 'team';
  teamId?: string;
  onSave?: (saved: Workflow) => void;
  onClose: () => void;
  lang?: 'en' | 'ar';
}

const newId = () => Math.random().toString(36).slice(2, 9);

const CONDITION_FIELDS = [
  { id: 'meeting.duration', label: 'meeting.duration' },
  { id: 'meeting.format', label: 'meeting.format' },
  { id: 'attendee.email', label: 'attendee.email' },
  { id: 'host.name', label: 'host.name' },
];

/**
 * WorkflowBuilder
 *
 * Modal for designing a workflow: trigger, conditions, actions.
 */
export const WorkflowBuilder: React.FC<Props> = ({
  workflow,
  scope = 'user',
  teamId,
  onSave,
  onClose,
  lang = 'en',
}) => {
  const isRTL = lang === 'ar';
  const [name, setName] = useState(workflow?.name || '');
  const [triggerType, setTriggerType] = useState<WorkflowTrigger>(
    workflow?.triggerType || 'booking.created',
  );
  const [offsetMinutes, setOffsetMinutes] = useState<number>(
    workflow?.triggerConfig?.offsetMinutes ?? 60,
  );
  const [conditions, setConditions] = useState<WorkflowCondition[]>(
    workflow?.conditions || [],
  );
  const [actions, setActions] = useState<WorkflowAction[]>(workflow?.actions || []);
  const [active, setActive] = useState<boolean>(workflow?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setTriggerType(workflow.triggerType);
      setOffsetMinutes(workflow.triggerConfig?.offsetMinutes ?? 60);
      setConditions(workflow.conditions || []);
      setActions(workflow.actions || []);
      setActive(workflow.active);
    }
  }, [workflow]);

  const needsOffset = triggerType === 'before_meeting' || triggerType === 'after_meeting';

  // ----- Conditions -----
  const addCondition = () => {
    setConditions((cs) => [
      ...cs,
      { field: CONDITION_FIELDS[0].id, op: 'equals', value: '' },
    ]);
  };
  const updateCondition = (idx: number, patch: Partial<WorkflowCondition>) => {
    setConditions((cs) => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
  const removeCondition = (idx: number) => {
    setConditions((cs) => cs.filter((_, i) => i !== idx));
  };

  // ----- Actions -----
  const addAction = (type: WorkflowActionType) => {
    let defaults: Record<string, any> = {};
    if (type === 'send_email') defaults = { to: 'attendee', subject: '', body: '' };
    if (type === 'send_webhook') defaults = { url: '', secret: '' };
    if (type === 'notify_host') defaults = { title: '', body: '' };
    if (type === 'tag_attendee') defaults = { tag: '' };
    if (type === 'create_followup') defaults = { delay_days: 7 };
    setActions((as) => [...as, { id: newId(), type, config: defaults }]);
  };
  const updateAction = (id: string, patch: Partial<WorkflowAction['config']>) => {
    setActions((as) =>
      as.map((a) => (a.id === id ? { ...a, config: { ...a.config, ...patch } } : a)),
    );
  };
  const removeAction = (id: string) => {
    setActions((as) => as.filter((a) => a.id !== id));
  };

  // ----- Save / Test -----
  const buildPayload = () => ({
    name: name.trim(),
    triggerType,
    triggerConfig: needsOffset ? { offsetMinutes } : null,
    conditions,
    actions,
    active,
    teamId: scope === 'team' ? teamId || null : null,
  });

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError(lang === 'ar' ? 'الاسم مطلوب' : 'Name is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      let saved: Workflow;
      if (workflow?.id) {
        saved = await apiJson<Workflow>(`/api/workflows/${workflow.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        saved = await apiJson<Workflow>('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      onSave?.(saved);
      onClose();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || (lang === 'ar' ? 'فشل الحفظ' : 'Save failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!workflow?.id) {
      setTestResult({
        ok: false,
        message: lang === 'ar' ? 'احفظ الحفل أولاً قبل الاختبار' : 'Save the workflow before testing',
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiJson<{ ok?: boolean; message?: string; results?: any[] }>(
        `/api/workflows/${workflow.id}/test`,
        { method: 'POST' },
      );
      setTestResult({
        ok: res.ok ?? true,
        message:
          res.message ||
          (res.results
            ? `${res.results.length} action(s) executed`
            : lang === 'ar'
              ? 'تم تشغيل الاختبار'
              : 'Test run complete'),
      });
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.body?.error || err?.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'منشئ سير العمل' : 'Workflow builder',
    name: lang === 'ar' ? 'الاسم' : 'Name',
    trigger: lang === 'ar' ? 'المُشغّل' : 'Trigger',
    offset: lang === 'ar' ? 'بعدد الدقائق' : 'Minutes offset',
    conditions: lang === 'ar' ? 'الشروط (اختياري)' : 'Conditions (optional)',
    addCondition: lang === 'ar' ? '+ شرط' : '+ Condition',
    actions: lang === 'ar' ? 'الإجراءات' : 'Actions',
    addAction: lang === 'ar' ? 'إضافة إجراء' : 'Add action',
    active: lang === 'ar' ? 'نشط' : 'Active',
    save: lang === 'ar' ? 'حفظ' : 'Save',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
    test: lang === 'ar' ? 'اختبار' : 'Test',
    remove: lang === 'ar' ? 'حذف' : 'Remove',
    bodyHint:
      lang === 'ar'
        ? 'يمكنك استخدام متغيرات مثل {{attendee.name}} و {{meeting.date}}.'
        : 'Use template variables like {{attendee.name}} or {{meeting.date}}.',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
          <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-2xl font-display font-bold text-charcoal">{labels.title}</h3>
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

          <div className="px-8 py-6 space-y-8 max-h-[70vh] overflow-y-auto">
            {/* Name + Active */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.name}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-3 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="rounded text-[#8A1538] focus:ring-[#8A1538]"
                  />
                  <span className="text-sm font-bold text-charcoal">{labels.active}</span>
                </label>
              </div>
            </section>

            {/* Trigger */}
            <section>
              <h4 className="text-sm font-bold text-charcoal mb-3">{labels.trigger}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as WorkflowTrigger)}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                >
                  <option value="booking.created">booking.created</option>
                  <option value="booking.cancelled">booking.cancelled</option>
                  <option value="booking.approved">booking.approved</option>
                  <option value="booking.rejected">booking.rejected</option>
                  <option value="before_meeting">before_meeting</option>
                  <option value="after_meeting">after_meeting</option>
                </select>
                {needsOffset && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={offsetMinutes}
                      onChange={(e) => setOffsetMinutes(Number(e.target.value) || 0)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                    />
                    <span className="text-xs text-gray-500 whitespace-nowrap">{labels.offset}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Conditions */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-charcoal">{labels.conditions}</h4>
                <Button type="button" variant="ghost" onClick={addCondition}>
                  {labels.addCondition}
                </Button>
              </div>
              {conditions.length === 0 ? (
                <p className="text-xs text-gray-400 italic">—</p>
              ) : (
                <div className="space-y-2">
                  {conditions.map((c, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <select
                        value={c.field}
                        onChange={(e) => updateCondition(i, { field: e.target.value })}
                        className="col-span-4 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                      >
                        {CONDITION_FIELDS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={c.op}
                        onChange={(e) => updateCondition(i, { op: e.target.value as WorkflowOp })}
                        className="col-span-3 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                      >
                        <option value="equals">equals</option>
                        <option value="not_equals">not equals</option>
                        <option value="contains">contains</option>
                        <option value="gt">{'>'}</option>
                        <option value="lt">{'<'}</option>
                      </select>
                      <input
                        type="text"
                        value={c.value}
                        onChange={(e) => updateCondition(i, { value: e.target.value })}
                        className="col-span-4 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                      />
                      <button
                        type="button"
                        onClick={() => removeCondition(i)}
                        className="col-span-1 text-xs text-salmon hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Actions */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-charcoal">{labels.actions}</h4>
                <div className="flex items-center gap-1">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addAction(e.target.value as WorkflowActionType);
                        e.target.value = '';
                      }
                    }}
                    value=""
                    className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                  >
                    <option value="">{labels.addAction}…</option>
                    <option value="send_email">send_email</option>
                    <option value="send_webhook">send_webhook</option>
                    <option value="notify_host">notify_host</option>
                    <option value="tag_attendee">tag_attendee</option>
                    <option value="create_followup">create_followup</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                {actions.map((a) => (
                  <div key={a.id} className="p-4 bg-gray-50 border border-gray-100 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-mono text-charcoal font-bold uppercase tracking-widest">{a.type}</p>
                      <button
                        type="button"
                        onClick={() => removeAction(a.id)}
                        className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider"
                      >
                        {labels.remove}
                      </button>
                    </div>
                    {a.type === 'send_email' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2">
                          <select
                            value={a.config.to || 'attendee'}
                            onChange={(e) => updateAction(a.id, { to: e.target.value })}
                            className="col-span-3 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                          >
                            <option value="attendee">attendee</option>
                            <option value="host">host</option>
                            <option value="custom">custom</option>
                          </select>
                          {a.config.to === 'custom' && (
                            <input
                              type="email"
                              placeholder="recipient@example.com"
                              value={a.config.customEmail || ''}
                              onChange={(e) => updateAction(a.id, { customEmail: e.target.value })}
                              className="col-span-9 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                              dir="ltr"
                            />
                          )}
                          <input
                            type="text"
                            placeholder="Subject"
                            value={a.config.subject || ''}
                            onChange={(e) => updateAction(a.id, { subject: e.target.value })}
                            className={`${a.config.to === 'custom' ? 'col-span-12' : 'col-span-9'} bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]`}
                          />
                        </div>
                        <textarea
                          rows={3}
                          placeholder="Body…"
                          value={a.config.body || ''}
                          onChange={(e) => updateAction(a.id, { body: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538] resize-none"
                        />
                        <p className="text-[10px] text-gray-400">{labels.bodyHint}</p>
                      </div>
                    )}
                    {a.type === 'send_webhook' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="url"
                          placeholder="https://example.com/hook"
                          value={a.config.url || ''}
                          onChange={(e) => updateAction(a.id, { url: e.target.value })}
                          className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538] font-mono"
                          dir="ltr"
                        />
                        <input
                          type="text"
                          placeholder="secret (optional)"
                          value={a.config.secret || ''}
                          onChange={(e) => updateAction(a.id, { secret: e.target.value })}
                          className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538] font-mono"
                          dir="ltr"
                        />
                      </div>
                    )}
                    {a.type === 'notify_host' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Title"
                          value={a.config.title || ''}
                          onChange={(e) => updateAction(a.id, { title: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                        />
                        <textarea
                          rows={2}
                          placeholder="Body…"
                          value={a.config.body || ''}
                          onChange={(e) => updateAction(a.id, { body: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538] resize-none"
                        />
                      </div>
                    )}
                    {a.type === 'tag_attendee' && (
                      <input
                        type="text"
                        placeholder="vip / qualified / …"
                        value={a.config.tag || ''}
                        onChange={(e) => updateAction(a.id, { tag: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                      />
                    )}
                    {a.type === 'create_followup' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={a.config.delay_days ?? 0}
                          onChange={(e) =>
                            updateAction(a.id, { delay_days: Number(e.target.value) || 0 })
                          }
                          className="w-24 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                        />
                        <span className="text-xs text-gray-500">
                          {lang === 'ar' ? 'يوم بعد الاجتماع' : 'days after meeting'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {actions.length === 0 && (
                  <p className="text-xs text-gray-400 italic">—</p>
                )}
              </div>
            </section>

            {testResult && (
              <div
                className={`text-xs font-bold p-3 rounded-r border-l-2 ${
                  testResult.ok
                    ? 'border-palm text-palm bg-palm/5'
                    : 'border-salmon text-salmon bg-salmon/5'
                }`}
              >
                {testResult.message}
              </div>
            )}
            {error && (
              <div className="text-salmon text-xs font-bold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r">
                {error}
              </div>
            )}
          </div>

          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-between gap-3">
            <Button variant="secondary" onClick={handleTest} loading={testing} disabled={!workflow?.id}>
              {labels.test}
            </Button>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={onClose}>
                {labels.cancel}
              </Button>
              <Button onClick={handleSave} loading={submitting}>
                {labels.save}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;
