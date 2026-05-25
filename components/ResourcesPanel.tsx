import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { apiJson } from '../services/api';

interface Resource {
  id: string;
  name: string;
  type: 'room' | 'equipment' | 'other';
  capacity?: number | null;
  location?: string | null;
  ownerTeamId?: string | null;
}

interface ResourceBooking {
  id: string;
  resourceId: string;
  date: string;
  startTime: string;
  endTime: string;
  bookedByName?: string | null;
  title?: string | null;
}

interface ResourcesPanelProps {
  lang?: 'en' | 'ar';
  teamId?: string;
}

const TYPE_OPTIONS: Array<{ value: Resource['type']; en: string; ar: string }> = [
  { value: 'room', en: 'Room', ar: 'غرفة' },
  { value: 'equipment', en: 'Equipment', ar: 'معدات' },
  { value: 'other', en: 'Other', ar: 'أخرى' },
];

export const ResourcesPanel: React.FC<ResourcesPanelProps> = ({ lang = 'en', teamId }) => {
  const isRTL = lang === 'ar';
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ name: string; type: Resource['type']; capacity: string; location: string; ownerTeamId: string }>({
    name: '',
    type: 'room',
    capacity: '',
    location: '',
    ownerTeamId: teamId || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Resource | null>(null);
  const [bookings, setBookings] = useState<ResourceBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<Resource[]>('/api/resources');
      setResources(Array.isArray(data) ? data : []);
    } catch {
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadBookings = async (resourceId: string) => {
    setBookingsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await apiJson<ResourceBooking[]>(`/api/resources/${resourceId}/bookings?date=${today}`);
      setBookings(Array.isArray(data) ? data : []);
    } catch {
      setBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiJson('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          capacity: form.capacity ? Number(form.capacity) : null,
          location: form.location.trim() || null,
          ownerTeamId: form.ownerTeamId || null,
        }),
      });
      setForm({ name: '', type: 'room', capacity: '', location: '', ownerTeamId: teamId || '' });
      setShowForm(false);
      load();
    } catch {
      /* swallow */
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelect = (r: Resource) => {
    setSelected(r);
    loadBookings(r.id);
  };

  const typeLabel = (t: Resource['type']) => {
    const opt = TYPE_OPTIONS.find((o) => o.value === t);
    return opt ? (lang === 'ar' ? opt.ar : opt.en) : t;
  };

  const labels = {
    title: lang === 'ar' ? 'الموارد' : 'Resources',
    subtitle: lang === 'ar' ? 'الغرف والمعدات' : 'Rooms and equipment',
    add: lang === 'ar' ? '+ مورد جديد' : '+ New resource',
    name: lang === 'ar' ? 'الاسم' : 'Name',
    type: lang === 'ar' ? 'النوع' : 'Type',
    capacity: lang === 'ar' ? 'السعة' : 'Capacity',
    location: lang === 'ar' ? 'الموقع' : 'Location',
    save: lang === 'ar' ? 'حفظ' : 'Save',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
    empty: lang === 'ar' ? 'لا توجد موارد بعد.' : 'No resources yet.',
    todayBookings: lang === 'ar' ? 'حجوزات اليوم' : 'Today’s bookings',
    noBookings: lang === 'ar' ? 'لا توجد حجوزات لهذا المورد اليوم.' : 'No bookings for this resource today.',
    close: lang === 'ar' ? 'إغلاق' : 'Close',
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-charcoal">{labels.title}</h3>
          <p className="text-xs text-gray-500">{labels.subtitle}</p>
        </div>
        <Button onClick={() => setShowForm(true)}>{labels.add}</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-8">{labels.empty}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {resources.map((r) => (
            <button
              key={r.id}
              onClick={() => handleSelect(r)}
              className="text-left rtl:text-right p-4 bg-gradient-to-br from-white to-gray-50 border border-gray-100 rounded-xl shadow-sm hover:border-[#8A1538]/30 hover:shadow-md transition-all"
            >
              <p className="text-sm font-bold text-charcoal mb-1">{r.name}</p>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-charcoal">{typeLabel(r.type)}</span>
                {r.capacity && <span>· {r.capacity}</span>}
                {r.location && <span>· {r.location}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h3 className="text-xl font-display font-bold text-charcoal mb-6">{labels.add}</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.name}</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.type}</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as Resource['type'] })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {lang === 'ar' ? o.ar : o.en}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.capacity}</label>
                  <input
                    type="number"
                    min="0"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{labels.location}</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  {labels.cancel}
                </Button>
                <Button type="submit" loading={submitting}>
                  {labels.save}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail / today's bookings */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
            <h3 className="text-xl font-display font-bold text-charcoal">{selected.name}</h3>
            <p className="text-xs text-gray-500 mb-6 font-mono uppercase tracking-wider">
              {typeLabel(selected.type)}
              {selected.location && ` · ${selected.location}`}
            </p>

            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{labels.todayBookings}</h4>
            {bookingsLoading ? (
              <div className="h-24 bg-gray-50 rounded-lg animate-pulse" />
            ) : bookings.length === 0 ? (
              <p className="text-sm text-gray-400 italic">{labels.noBookings}</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {bookings.map((b) => (
                  <div key={b.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-sm font-bold text-charcoal">{b.title || lang === 'ar' ? 'محجوز' : 'Booked'}</p>
                    <p className="text-xs text-gray-500 font-mono">
                      {b.startTime} – {b.endTime}
                      {b.bookedByName && ` · ${b.bookedByName}`}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                {labels.close}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourcesPanel;
