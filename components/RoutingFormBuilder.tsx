import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

export type QuestionType = 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'email';

export interface RoutingQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required?: boolean;
  options?: string[];
}

export type RoutingOp = 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt';

export interface RoutingCondition {
  fieldId: string;
  op: RoutingOp;
  value: string;
}

export type RoutingActionType = 'route_to_user' | 'route_to_link';

export interface RoutingAction {
  type: RoutingActionType;
  target: string; // userId or bookingLinkId/slug
}

export interface RoutingRule {
  id: string;
  conditions: RoutingCondition[];
  action: RoutingAction;
}

export interface RoutingForm {
  id?: string;
  name: string;
  description?: string;
  fields: RoutingQuestion[];
  routingRules: RoutingRule[];
  bookingLinkId?: string | null;
}

interface HostOption {
  id: string;
  name: string;
}
interface LinkOption {
  id: string;
  slug: string;
  title?: string;
}

interface Props {
  isOpen?: boolean;
  form?: RoutingForm;
  bookingLinkId?: string;
  hostsList?: HostOption[];
  bookingLinksList?: LinkOption[];
  onSave?: (saved: RoutingForm) => void;
  onClose: () => void;
  lang?: 'en' | 'ar';
}

const newId = () => Math.random().toString(36).slice(2, 9);

/**
 * RoutingFormBuilder
 *
 * Admin builder for routing forms. Users design a form, then a list of rules
 * that route submitters to a host or booking link based on their answers.
 */
export const RoutingFormBuilder: React.FC<Props> = ({
  isOpen = true,
  form,
  bookingLinkId,
  hostsList = [],
  bookingLinksList = [],
  onSave,
  onClose,
  lang = 'en',
}) => {
  const isRTL = lang === 'ar';

  const [name, setName] = useState(form?.name || '');
  const [description, setDescription] = useState(form?.description || '');
  const [fields, setFields] = useState<RoutingQuestion[]>(form?.fields || []);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>(
    form?.routingRules || [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (form) {
      setName(form.name || '');
      setDescription(form.description || '');
      setFields(form.fields || []);
      setRoutingRules(form.routingRules || []);
    }
  }, [form]);

  if (!isOpen) return null;

  // ----- Fields -----
  const addField = () => {
    setFields((f) => [
      ...f,
      { id: newId(), label: '', type: 'text', required: false, options: [] },
    ]);
  };
  const updateField = (id: string, patch: Partial<RoutingQuestion>) => {
    setFields((f) => f.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };
  const removeField = (id: string) => {
    setFields((f) => f.filter((q) => q.id !== id));
    // Also strip references in rules
    setRoutingRules((rs) =>
      rs.map((r) => ({
        ...r,
        conditions: r.conditions.filter((c) => c.fieldId !== id),
      })),
    );
  };
  const moveField = (idx: number, dir: -1 | 1) => {
    setFields((f) => {
      const next = [...f];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return f;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  // ----- Rules -----
  const addRule = () => {
    setRoutingRules((rs) => [
      ...rs,
      {
        id: newId(),
        conditions: [],
        action: { type: 'route_to_user', target: hostsList[0]?.id || '' },
      },
    ]);
  };
  const removeRule = (id: string) => {
    setRoutingRules((rs) => rs.filter((r) => r.id !== id));
  };
  const moveRule = (idx: number, dir: -1 | 1) => {
    setRoutingRules((rs) => {
      const next = [...rs];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return rs;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };
  const updateRule = (id: string, patch: Partial<RoutingRule>) => {
    setRoutingRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const addCondition = (ruleId: string) => {
    setRoutingRules((rs) =>
      rs.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              conditions: [
                ...r.conditions,
                { fieldId: fields[0]?.id || '', op: 'equals', value: '' },
              ],
            }
          : r,
      ),
    );
  };
  const updateCondition = (
    ruleId: string,
    idx: number,
    patch: Partial<RoutingCondition>,
  ) => {
    setRoutingRules((rs) =>
      rs.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              conditions: r.conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
            }
          : r,
      ),
    );
  };
  const removeCondition = (ruleId: string, idx: number) => {
    setRoutingRules((rs) =>
      rs.map((r) =>
        r.id === ruleId
          ? { ...r, conditions: r.conditions.filter((_, i) => i !== idx) }
          : r,
      ),
    );
  };

  // ----- Submit -----
  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError(lang === 'ar' ? 'الاسم مطلوب' : 'Name is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        fields,
        routingRules,
        bookingLinkId: bookingLinkId ?? form?.bookingLinkId ?? null,
      };
      let saved: RoutingForm;
      if (form?.id) {
        saved = await apiJson<RoutingForm>(`/api/routing-forms/${form.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        saved = await apiJson<RoutingForm>('/api/routing-forms', {
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

  // ----- Labels -----
  const labels = {
    title: lang === 'ar' ? 'منشئ نموذج التوجيه' : 'Routing form builder',
    subtitle: lang === 'ar'
      ? 'صمم نموذجاً وقواعد توجيه بناءً على الإجابات.'
      : 'Design a form and routing rules based on the answers.',
    name: lang === 'ar' ? 'اسم النموذج' : 'Form name',
    description: lang === 'ar' ? 'وصف' : 'Description',
    fields: lang === 'ar' ? 'الحقول' : 'Fields',
    addField: lang === 'ar' ? '+ إضافة حقل' : '+ Add field',
    label: lang === 'ar' ? 'التسمية' : 'Label',
    type: lang === 'ar' ? 'النوع' : 'Type',
    required: lang === 'ar' ? 'مطلوب' : 'Required',
    options: lang === 'ar' ? 'خيارات (مفصولة بفاصلة)' : 'Options (comma-separated)',
    rules: lang === 'ar' ? 'قواعد التوجيه' : 'Routing rules',
    addRule: lang === 'ar' ? '+ إضافة قاعدة' : '+ Add rule',
    conditions: lang === 'ar' ? 'الشروط' : 'Conditions',
    addCondition: lang === 'ar' ? '+ شرط' : '+ Condition',
    action: lang === 'ar' ? 'الإجراء' : 'Action',
    routeToUser: lang === 'ar' ? 'توجيه إلى مستخدم' : 'Route to user',
    routeToLink: lang === 'ar' ? 'توجيه إلى رابط' : 'Route to link',
    fallback: lang === 'ar' ? '(القاعدة الاحتياطية)' : '(fallback rule)',
    save: lang === 'ar' ? 'حفظ' : 'Save',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
    remove: lang === 'ar' ? 'حذف' : 'Remove',
    moveUp: '↑',
    moveDown: '↓',
    noFields: lang === 'ar' ? 'لا توجد حقول بعد.' : 'No fields yet.',
    noRules: lang === 'ar' ? 'لا توجد قواعد بعد. اترك القاعدة بدون شروط لتكون احتياطية.' : 'No rules yet. Leave a rule with no conditions to make it the fallback.',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
          <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-display font-bold text-charcoal">{labels.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{labels.subtitle}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-charcoal p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label={labels.cancel}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-8 py-6 space-y-8 max-h-[70vh] overflow-y-auto">
            {/* Name / Description */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.name}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.description}</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                />
              </div>
            </section>

            {/* Fields */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-charcoal">{labels.fields}</h4>
                <Button type="button" variant="ghost" onClick={addField}>
                  {labels.addField}
                </Button>
              </div>

              {fields.length === 0 ? (
                <p className="text-xs text-gray-400 italic">{labels.noFields}</p>
              ) : (
                <div className="space-y-3">
                  {fields.map((q, idx) => (
                    <div key={q.id} className="p-4 bg-gray-50 border border-gray-100 rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => moveField(idx, -1)}
                            className="text-gray-400 hover:text-charcoal text-xs"
                            aria-label={labels.moveUp}
                          >
                            {labels.moveUp}
                          </button>
                          <button
                            type="button"
                            onClick={() => moveField(idx, 1)}
                            className="text-gray-400 hover:text-charcoal text-xs"
                            aria-label={labels.moveDown}
                          >
                            {labels.moveDown}
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder={labels.label}
                          value={q.label}
                          onChange={(e) => updateField(q.id, { label: e.target.value })}
                          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                        />
                        <select
                          value={q.type}
                          onChange={(e) => updateField(q.id, { type: e.target.value as QuestionType })}
                          className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                        >
                          <option value="text">Text</option>
                          <option value="textarea">Textarea</option>
                          <option value="select">Select</option>
                          <option value="radio">Radio</option>
                          <option value="checkbox">Checkbox</option>
                          <option value="email">Email</option>
                        </select>
                      </div>
                      {(q.type === 'select' || q.type === 'radio') && (
                        <input
                          type="text"
                          placeholder={labels.options}
                          value={(q.options || []).join(', ')}
                          onChange={(e) =>
                            updateField(q.id, {
                              options: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                        />
                      )}
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!q.required}
                            onChange={(e) => updateField(q.id, { required: e.target.checked })}
                            className="rounded text-[#8A1538] focus:ring-[#8A1538]"
                          />
                          <span className="text-gray-600">{labels.required}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeField(q.id)}
                          className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider"
                        >
                          {labels.remove}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Routing Rules */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-charcoal">{labels.rules}</h4>
                <Button type="button" variant="ghost" onClick={addRule}>
                  {labels.addRule}
                </Button>
              </div>

              {routingRules.length === 0 ? (
                <p className="text-xs text-gray-400 italic">{labels.noRules}</p>
              ) : (
                <div className="space-y-3">
                  {routingRules.map((r, idx) => {
                    const isFallback = r.conditions.length === 0 && idx === routingRules.length - 1;
                    return (
                      <div key={r.id} className="p-4 bg-white border border-gray-200 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-charcoal">
                            {lang === 'ar' ? 'قاعدة' : 'Rule'} #{idx + 1}
                            {isFallback && (
                              <span className="ml-2 text-[10px] font-mono uppercase text-[#8A1538]">{labels.fallback}</span>
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => moveRule(idx, -1)} className="text-gray-400 hover:text-charcoal text-xs">{labels.moveUp}</button>
                            <button type="button" onClick={() => moveRule(idx, 1)} className="text-gray-400 hover:text-charcoal text-xs">{labels.moveDown}</button>
                            <button
                              type="button"
                              onClick={() => removeRule(r.id)}
                              className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider"
                            >
                              {labels.remove}
                            </button>
                          </div>
                        </div>

                        {/* Conditions */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-mono uppercase text-gray-500">{labels.conditions}</p>
                            <button
                              type="button"
                              onClick={() => addCondition(r.id)}
                              className="text-xs text-[#8A1538] hover:underline font-bold"
                            >
                              {labels.addCondition}
                            </button>
                          </div>
                          {r.conditions.map((c, ci) => (
                            <div key={ci} className="grid grid-cols-12 gap-2 items-center">
                              <select
                                value={c.fieldId}
                                onChange={(e) => updateCondition(r.id, ci, { fieldId: e.target.value })}
                                className="col-span-4 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                              >
                                <option value="">—</option>
                                {fields.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.label || f.id}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={c.op}
                                onChange={(e) => updateCondition(r.id, ci, { op: e.target.value as RoutingOp })}
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
                                onChange={(e) => updateCondition(r.id, ci, { value: e.target.value })}
                                className="col-span-4 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                              />
                              <button
                                type="button"
                                onClick={() => removeCondition(r.id, ci)}
                                className="col-span-1 text-xs text-salmon hover:text-red-700"
                                aria-label={labels.remove}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Action */}
                        <div className="grid grid-cols-12 gap-2 pt-2 border-t border-gray-100">
                          <p className="col-span-12 text-[10px] font-mono uppercase text-gray-500">{labels.action}</p>
                          <select
                            value={r.action.type}
                            onChange={(e) =>
                              updateRule(r.id, {
                                action: { type: e.target.value as RoutingActionType, target: '' },
                              })
                            }
                            className="col-span-4 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                          >
                            <option value="route_to_user">{labels.routeToUser}</option>
                            <option value="route_to_link">{labels.routeToLink}</option>
                          </select>
                          {r.action.type === 'route_to_user' ? (
                            <select
                              value={r.action.target}
                              onChange={(e) =>
                                updateRule(r.id, { action: { ...r.action, target: e.target.value } })
                              }
                              className="col-span-8 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                            >
                              <option value="">—</option>
                              {hostsList.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={r.action.target}
                              onChange={(e) =>
                                updateRule(r.id, { action: { ...r.action, target: e.target.value } })
                              }
                              className="col-span-8 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#8A1538]"
                            >
                              <option value="">—</option>
                              {bookingLinksList.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.title || l.slug}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {error && (
              <div className="text-salmon text-xs font-bold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r">
                {error}
              </div>
            )}
          </div>

          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
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
  );
};

export default RoutingFormBuilder;
