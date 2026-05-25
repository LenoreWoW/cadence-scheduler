import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Language } from '../types';
import { ConfirmationModal } from './ConfirmationModal';

interface BookingLink {
  id: string;
  slug: string;
  token: string;
  title: string;
  description?: string;
  durationOptions: number[];
  defaultDuration: number;
  isActive: boolean;
  expiresAt?: string;
  maxBookingsPerDay?: number;
  bufferBefore: number;
  bufferAfter: number;
  customMessage?: string;
  createdAt: string;
}

interface BookingLinksManagerProps {
  userId: string;
  t: (key: string) => string;
  lang: Language;
  accessToken: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const BookingLinksManager: React.FC<BookingLinksManagerProps> = ({
  userId,
  t,
  lang,
  accessToken
}) => {
  const isRTL = lang === 'ar';

  const [links, setLinks] = useState<BookingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingLink, setEditingLink] = useState<BookingLink | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: 'Book a Meeting',
    description: '',
    durationOptions: [15, 30, 45, 60],
    defaultDuration: 30,
    customMessage: '',
    maxBookingsPerDay: 0,
    bufferBefore: 0,
    bufferAfter: 0
  });

  // Fetch links
  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const response = await fetch(`${API_BASE}/booking-links/my-links`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (response.ok) {
          const data = await response.json();
          setLinks(data);
        }
      } catch (err) {
        console.error('Failed to fetch booking links:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLinks();
  }, [accessToken]);

  // Create new link
  const handleCreate = async () => {
    setCreating(true);
    try {
      const response = await fetch(`${API_BASE}/booking-links`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          durationOptions: formData.durationOptions,
          defaultDuration: formData.defaultDuration,
          customMessage: formData.customMessage || null,
          maxBookingsPerDay: formData.maxBookingsPerDay || null,
          bufferBefore: formData.bufferBefore,
          bufferAfter: formData.bufferAfter
        })
      });

      if (response.ok) {
        const newLink = await response.json();
        setLinks([newLink, ...links]);
        setShowCreateForm(false);
        setFormData({
          title: 'Book a Meeting',
          description: '',
          durationOptions: [15, 30, 45, 60],
          defaultDuration: 30,
          customMessage: '',
          maxBookingsPerDay: 0,
          bufferBefore: 0,
          bufferAfter: 0
        });
      }
    } catch (err) {
      console.error('Failed to create booking link:', err);
    } finally {
      setCreating(false);
    }
  };

  // Toggle link active status
  const toggleActive = async (link: BookingLink) => {
    try {
      const response = await fetch(`${API_BASE}/booking-links/${link.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !link.isActive })
      });

      if (response.ok) {
        setLinks(links.map(l => 
          l.id === link.id ? { ...l, isActive: !l.isActive } : l
        ));
      }
    } catch (err) {
      console.error('Failed to toggle link:', err);
    }
  };

  // Delete link (called after user confirms via ConfirmationModal)
  const performDelete = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/booking-links/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.ok) {
        setLinks(links.filter(l => l.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete link:', err);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const requestDeleteLink = (id: string) => {
    setPendingDeleteId(id);
  };

  // Copy link to clipboard
  const copyLink = async (link: BookingLink) => {
    const url = `${window.location.origin}/book/${link.slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Get full booking URL
  const getBookingUrl = (slug: string) => {
    return `${window.location.origin}/book/${slug}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8A1538]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">
            {lang === 'ar' ? 'روابط الحجز' : 'Booking Links'}
          </h3>
          <p className="text-sm text-slate-500">
            {lang === 'ar' 
              ? 'شارك رابطًا يتيح للآخرين حجز موعد معك' 
              : 'Share a link that lets others book time with you'
            }
          </p>
        </div>
        {!showCreateForm && (
          <Button 
            onClick={() => setShowCreateForm(true)}
            variant="primary"
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {lang === 'ar' ? 'إنشاء رابط' : 'Create Link'}
          </Button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 animate-fade-in">
          <h4 className="font-bold text-slate-800 mb-4">
            {lang === 'ar' ? 'إنشاء رابط حجز جديد' : 'Create New Booking Link'}
          </h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                {lang === 'ar' ? 'عنوان الصفحة' : 'Page Title'}
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-[#8A1538] focus:ring-2 focus:ring-[#8A1538]/20 outline-none"
                placeholder="Book a Meeting"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                {lang === 'ar' ? 'الوصف' : 'Description'} (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-[#8A1538] focus:ring-2 focus:ring-[#8A1538]/20 outline-none resize-none"
                placeholder={lang === 'ar' ? 'وصف قصير لصفحة الحجز...' : 'A short description for your booking page...'}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                {lang === 'ar' ? 'خيارات المدة' : 'Duration Options'}
              </label>
              <div className="flex flex-wrap gap-2">
                {[15, 30, 45, 60, 90].map(duration => (
                  <button
                    key={duration}
                    onClick={() => {
                      const newOptions = formData.durationOptions.includes(duration)
                        ? formData.durationOptions.filter(d => d !== duration)
                        : [...formData.durationOptions, duration].sort((a, b) => a - b);
                      setFormData({ ...formData, durationOptions: newOptions });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      formData.durationOptions.includes(duration)
                        ? 'bg-[#8A1538] text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {duration} min
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                {lang === 'ar' ? 'المدة الافتراضية' : 'Default Duration'}
              </label>
              <select
                value={formData.defaultDuration}
                onChange={e => setFormData({ ...formData, defaultDuration: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-[#8A1538] focus:ring-2 focus:ring-[#8A1538]/20 outline-none"
              >
                {formData.durationOptions.map(d => (
                  <option key={d} value={d}>{d} minutes</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                {lang === 'ar' ? 'رسالة مخصصة' : 'Custom Message'} (Optional)
              </label>
              <textarea
                value={formData.customMessage}
                onChange={e => setFormData({ ...formData, customMessage: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-[#8A1538] focus:ring-2 focus:ring-[#8A1538]/20 outline-none resize-none"
                placeholder={lang === 'ar' ? 'رسالة تظهر للزوار...' : 'A message shown to visitors...'}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  {lang === 'ar' ? 'الحد الأقصى للحجوزات/اليوم' : 'Max Bookings/Day'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.maxBookingsPerDay || ''}
                  onChange={e => setFormData({ ...formData, maxBookingsPerDay: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-[#8A1538] focus:ring-2 focus:ring-[#8A1538]/20 outline-none"
                  placeholder="0 = unlimited"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  {lang === 'ar' ? 'فاصل زمني بعد الاجتماع' : 'Buffer After (min)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.bufferAfter}
                  onChange={e => setFormData({ ...formData, bufferAfter: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-[#8A1538] focus:ring-2 focus:ring-[#8A1538]/20 outline-none"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button onClick={() => setShowCreateForm(false)} variant="ghost">
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleCreate} 
              variant="primary"
              disabled={creating || !formData.title || formData.durationOptions.length === 0}
            >
              {creating ? (lang === 'ar' ? 'جاري الإنشاء...' : 'Creating...') : (lang === 'ar' ? 'إنشاء الرابط' : 'Create Link')}
            </Button>
          </div>
        </div>
      )}

      {/* Links List */}
      {links.length === 0 && !showCreateForm ? (
        <div className="bg-slate-50 rounded-xl p-8 text-center border border-slate-200">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h4 className="font-bold text-slate-800 mb-2">
            {lang === 'ar' ? 'لا توجد روابط حجز' : 'No Booking Links Yet'}
          </h4>
          <p className="text-sm text-slate-500 mb-4">
            {lang === 'ar' 
              ? 'أنشئ رابطًا لتسمح للآخرين بحجز مواعيد معك' 
              : 'Create a link to let others schedule meetings with you'
            }
          </p>
          <Button onClick={() => setShowCreateForm(true)} variant="primary">
            {lang === 'ar' ? 'إنشاء أول رابط' : 'Create Your First Link'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {links.map(link => (
            <div 
              key={link.id} 
              className={`bg-white rounded-xl border p-5 transition-all ${
                link.isActive ? 'border-slate-200 shadow-sm' : 'border-slate-100 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-slate-800 truncate">{link.title}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      link.isActive 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {link.isActive ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'معطل' : 'Inactive')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <code className="text-sm text-slate-500 bg-slate-50 px-2 py-1 rounded truncate max-w-xs">
                      /book/{link.slug}
                    </code>
                    <button
                      onClick={() => copyLink(link)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                      title={lang === 'ar' ? 'نسخ الرابط' : 'Copy link'}
                      aria-label={lang === 'ar' ? 'نسخ رابط الحجز' : 'Copy booking link'}
                    >
                      {copiedId === link.id ? (
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {link.durationOptions.join(', ')} min
                    </span>
                    {link.maxBookingsPerDay && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Max {link.maxBookingsPerDay}/day
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={getBookingUrl(link.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                    title={lang === 'ar' ? 'معاينة' : 'Preview'}
                    aria-label={lang === 'ar' ? 'معاينة صفحة الحجز' : 'Preview booking page'}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <button
                    onClick={() => toggleActive(link)}
                    className={`p-2 rounded-lg transition-colors ${
                      link.isActive
                        ? 'hover:bg-amber-50 text-amber-500'
                        : 'hover:bg-emerald-50 text-emerald-500'
                    }`}
                    title={link.isActive ? (lang === 'ar' ? 'تعطيل' : 'Disable') : (lang === 'ar' ? 'تفعيل' : 'Enable')}
                    aria-label={link.isActive ? (lang === 'ar' ? 'تعطيل رابط الحجز' : 'Disable booking link') : (lang === 'ar' ? 'تفعيل رابط الحجز' : 'Enable booking link')}
                  >
                    {link.isActive ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => requestDeleteLink(link.id)}
                    className="p-2 rounded-lg hover:bg-red-50 transition-colors text-slate-400 hover:text-red-500"
                    title={lang === 'ar' ? 'حذف' : 'Delete'}
                    aria-label={lang === 'ar' ? 'حذف رابط الحجز' : 'Delete booking link'}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingLinksManager;

