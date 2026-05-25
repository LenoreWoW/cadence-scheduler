import React, { useState } from 'react';
import { Button } from './Button';
import { RestrictionScheduleEditor } from './RestrictionScheduleEditor';
import { BookingLinkBranding } from './BookingLinkBranding';
import { FrequencyLimitsEditor } from './FrequencyLimitsEditor';
import { AnalyticsPixelsEditor } from './AnalyticsPixelsEditor';
import { CommonSchedulesPicker } from './CommonSchedulesPicker';
import { RoutingFormBuilder } from './RoutingFormBuilder';

export interface AvailabilityOverride {
  startHour: number;
  endHour: number;
  slotDuration: number;
  days: number[];
  timeOff: string[];
}

export interface QuestionDef {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  options?: string[];
  required?: boolean;
}

export interface BookingLinkAdvancedConfig {
  availabilityOverride?: AvailabilityOverride | null;
  bookableWindowDays?: number | null;
  slotCapacity?: number | null;
  approvalRequired?: boolean;
  questions?: QuestionDef[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initial: BookingLinkAdvancedConfig;
  onSave: (config: BookingLinkAdvancedConfig) => Promise<void> | void;
  lang?: 'en' | 'ar';
  /** Full booking link record — when provided, enables per-link sub-panels (branding, pixels, frequency, etc). */
  link?: any;
  /** Called after a sub-panel mutates the link server-side, so the parent can refetch. */
  onRefresh?: () => void;
}

const DAYS = [
  { id: 0, en: 'Sun', ar: 'أحد' },
  { id: 1, en: 'Mon', ar: 'إثن' },
  { id: 2, en: 'Tue', ar: 'ثلا' },
  { id: 3, en: 'Wed', ar: 'أرب' },
  { id: 4, en: 'Thu', ar: 'خمي' },
  { id: 5, en: 'Fri', ar: 'جمع' },
  { id: 6, en: 'Sat', ar: 'سبت' },
];

/**
 * BookingLinkAdvancedSettings
 *
 * Modal-style editor for a single booking link's advanced configuration:
 * availability override, bookable window, slot capacity, approval flag,
 * and a custom-questions editor.
 */
export const BookingLinkAdvancedSettings: React.FC<Props> = ({ isOpen, onClose, initial, onSave, lang = 'en', link, onRefresh }) => {
  const isRTL = lang === 'ar';

  const [override, setOverride] = useState<AvailabilityOverride>(
    initial.availabilityOverride || { startHour: 9, endHour: 17, slotDuration: 30, days: [1, 2, 3, 4, 5], timeOff: [] },
  );
  const [hasOverride, setHasOverride] = useState(!!initial.availabilityOverride);
  const [bookableWindowDays, setBookableWindowDays] = useState<number>(initial.bookableWindowDays ?? 60);
  const [slotCapacity, setSlotCapacity] = useState<number>(initial.slotCapacity ?? 1);
  const [approvalRequired, setApprovalRequired] = useState<boolean>(!!initial.approvalRequired);
  const [questions, setQuestions] = useState<QuestionDef[]>(initial.questions || []);
  const [submitting, setSubmitting] = useState(false);
  const [newTimeOff, setNewTimeOff] = useState('');
  const [showRoutingBuilder, setShowRoutingBuilder] = useState(false);

  if (!isOpen) return null;

  const toggleDay = (id: number) => {
    setOverride((o) => ({ ...o, days: o.days.includes(id) ? o.days.filter((d) => d !== id) : [...o.days, id].sort() }));
  };

  const addQuestion = () => {
    setQuestions((q) => [
      ...q,
      { id: Math.random().toString(36).slice(2, 9), label: '', type: 'text', options: [] },
    ]);
  };

  const updateQuestion = (id: string, patch: Partial<QuestionDef>) => {
    setQuestions((q) => q.map((qn) => (qn.id === id ? { ...qn, ...patch } : qn)));
  };

  const removeQuestion = (id: string) => {
    setQuestions((q) => q.filter((qn) => qn.id !== id));
  };

  const addTimeOff = () => {
    if (!newTimeOff) return;
    setOverride((o) => ({ ...o, timeOff: [...o.timeOff, newTimeOff] }));
    setNewTimeOff('');
  };

  const removeTimeOff = (date: string) => {
    setOverride((o) => ({ ...o, timeOff: o.timeOff.filter((d) => d !== date) }));
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await onSave({
        availabilityOverride: hasOverride ? override : null,
        bookableWindowDays,
        slotCapacity,
        approvalRequired,
        questions,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'إعدادات متقدمة' : 'Advanced settings',
    availabilityOverride: lang === 'ar' ? 'تجاوز التوفر الافتراضي' : 'Override default availability',
    start: lang === 'ar' ? 'البداية' : 'Start',
    end: lang === 'ar' ? 'النهاية' : 'End',
    slot: lang === 'ar' ? 'مدة الفترة' : 'Slot duration',
    days: lang === 'ar' ? 'الأيام' : 'Days',
    timeOff: lang === 'ar' ? 'إجازات (تواريخ محظورة)' : 'Time off (blocked dates)',
    addDate: lang === 'ar' ? 'إضافة' : 'Add',
    bookableWindow: lang === 'ar' ? 'نافذة الحجز (أيام)' : 'Bookable window (days)',
    slotCapacity: lang === 'ar' ? 'سعة الفترة الواحدة' : 'Slot capacity',
    approval: lang === 'ar' ? 'الموافقة مطلوبة قبل التأكيد' : 'Require approval before confirming',
    questions: lang === 'ar' ? 'أسئلة مخصصة' : 'Custom questions',
    addQuestion: lang === 'ar' ? '+ إضافة سؤال' : '+ Add question',
    label: lang === 'ar' ? 'النص' : 'Label',
    type: lang === 'ar' ? 'النوع' : 'Type',
    options: lang === 'ar' ? 'خيارات (مفصولة بفاصلة)' : 'Options (comma-separated)',
    required: lang === 'ar' ? 'مطلوب' : 'Required',
    save: lang === 'ar' ? 'حفظ' : 'Save',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
    remove: lang === 'ar' ? 'حذف' : 'Remove',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
          <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-2xl font-display font-bold text-charcoal">{labels.title}</h3>
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
            {/* Availability override */}
            <section>
              <label className="flex items-center gap-3 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasOverride}
                  onChange={(e) => setHasOverride(e.target.checked)}
                  className="rounded text-[#8A1538] focus:ring-[#8A1538]"
                />
                <span className="text-sm font-bold text-charcoal">{labels.availabilityOverride}</span>
              </label>
              {hasOverride && (
                <div className="space-y-4 pl-6 rtl:pr-6 rtl:pl-0 border-l-2 border-[#8A1538]/20 rtl:border-r-2 rtl:border-l-0">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.start}</label>
                      <select
                        value={override.startHour}
                        onChange={(e) => setOverride({ ...override, startHour: Number(e.target.value) })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                      >
                        {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                          <option key={h} value={h}>{h}:00</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.end}</label>
                      <select
                        value={override.endHour}
                        onChange={(e) => setOverride({ ...override, endHour: Number(e.target.value) })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                      >
                        {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                          <option key={h} value={h}>{h}:00</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{labels.slot}</label>
                      <select
                        value={override.slotDuration}
                        onChange={(e) => setOverride({ ...override, slotDuration: Number(e.target.value) })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                      >
                        {[15, 30, 45, 60, 90].map((m) => (
                          <option key={m} value={m}>{m} min</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.days}</label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDay(d.id)}
                          className={`w-10 h-10 rounded-lg text-xs font-bold border transition-all ${
                            override.days.includes(d.id)
                              ? 'bg-[#8A1538] text-white border-[#8A1538]'
                              : 'bg-white text-gray-400 border-gray-200'
                          }`}
                        >
                          {lang === 'ar' ? d.ar : d.en}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.timeOff}</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="date"
                        value={newTimeOff}
                        onChange={(e) => setNewTimeOff(e.target.value)}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                      />
                      <Button type="button" variant="secondary" onClick={addTimeOff}>
                        {labels.addDate}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {override.timeOff.map((d) => (
                        <span key={d} className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded bg-gray-100 text-gray-700">
                          {d}
                          <button onClick={() => removeTimeOff(d)} className="text-gray-400 hover:text-salmon">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.bookableWindow}</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={bookableWindowDays}
                  onChange={(e) => setBookableWindowDays(Number(e.target.value) || 1)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.slotCapacity}</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={slotCapacity}
                  onChange={(e) => setSlotCapacity(Number(e.target.value) || 1)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                />
              </div>
            </section>

            <section>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={approvalRequired}
                  onChange={(e) => setApprovalRequired(e.target.checked)}
                  className="rounded text-[#8A1538] focus:ring-[#8A1538]"
                />
                <span className="text-sm font-bold text-charcoal">{labels.approval}</span>
              </label>
            </section>

            {link?.id && (
              <>
                <section className="pt-6 border-t border-gray-100">
                  <RestrictionScheduleEditor linkId={link.id} lang={lang} />
                </section>

                <section className="pt-6 border-t border-gray-100">
                  <BookingLinkBranding link={link} onChange={onRefresh} lang={lang} />
                </section>

                <section className="pt-6 border-t border-gray-100">
                  <FrequencyLimitsEditor link={link} onChange={onRefresh} lang={lang} />
                </section>

                <section className="pt-6 border-t border-gray-100">
                  <AnalyticsPixelsEditor linkId={link.id} lang={lang} />
                </section>

                <section className="pt-6 border-t border-gray-100">
                  <CommonSchedulesPicker link={link} onChange={onRefresh} lang={lang} />
                </section>

                <section className="pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-charcoal">
                        {lang === 'ar' ? 'نموذج التوجيه' : 'Routing form'}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {lang === 'ar'
                          ? 'وجه الزوار بناءً على إجاباتهم.'
                          : 'Route visitors based on their answers.'}
                      </p>
                    </div>
                    <Button type="button" variant="secondary" onClick={() => setShowRoutingBuilder(true)}>
                      {lang === 'ar' ? 'إعداد' : 'Configure'}
                    </Button>
                  </div>
                </section>
              </>
            )}

            <section>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-charcoal">{labels.questions}</h4>
                <Button type="button" variant="ghost" onClick={addQuestion}>
                  {labels.addQuestion}
                </Button>
              </div>
              {questions.length === 0 ? (
                <p className="text-xs text-gray-400 italic">{lang === 'ar' ? 'لا توجد أسئلة بعد.' : 'No questions yet.'}</p>
              ) : (
                <div className="space-y-3">
                  {questions.map((q) => (
                    <div key={q.id} className="p-4 bg-gray-50 border border-gray-100 rounded-lg space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder={labels.label}
                          value={q.label}
                          onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                          className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                        />
                        <select
                          value={q.type}
                          onChange={(e) => updateQuestion(q.id, { type: e.target.value as QuestionDef['type'] })}
                          className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8A1538]"
                        >
                          <option value="text">Text</option>
                          <option value="textarea">Textarea</option>
                          <option value="select">Select</option>
                          <option value="checkbox">Checkbox</option>
                        </select>
                      </div>
                      {q.type === 'select' && (
                        <input
                          type="text"
                          placeholder={labels.options}
                          value={(q.options || []).join(', ')}
                          onChange={(e) =>
                            updateQuestion(q.id, {
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
                            onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                            className="rounded text-[#8A1538] focus:ring-[#8A1538]"
                          />
                          <span className="text-gray-600">{labels.required}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeQuestion(q.id)}
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

      {showRoutingBuilder && link?.id && (
        <RoutingFormBuilder
          bookingLinkId={link.id}
          lang={lang}
          onClose={() => setShowRoutingBuilder(false)}
          onSave={() => {
            setShowRoutingBuilder(false);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
};

export default BookingLinkAdvancedSettings;
