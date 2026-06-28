import React, { useState, useEffect } from 'react';
import { Meeting, Role, TimeSlot, Language, User, MeetingCategory, MeetingLocality } from '../types';
import { Button } from './Button';
import { storageService } from '../services/storageService';
import { CATEGORY_CONFIG, LOCALITY_CONFIG } from '../constants';
import { deriveLocality } from '../services/localityService';
import { calendarIntegration } from '../services/calendarIntegration';
import { smartDefaults } from '../services/smartDefaults';
import { BookingSuccess3D } from './BookingSuccess3D';
import { LocationAddressField } from './LocationAddressField';

// Token-styled initials (replaces the ui-avatars.com placeholder).
const initialsOf = (name?: string) =>
  (name || '').trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '·';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  selectedDate: Date;
  selectedSlot: TimeSlot | null;
  role: Role;
  t: (key: string) => string;
  lang: Language;
  currentUser: User | null;
  host?: User | null;
  initialDuration?: number; // New prop
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen, onClose, onSubmit, selectedDate, selectedSlot, role, t, lang, currentUser, host, initialDuration
}) => {
  const [submitted, setSubmitted] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [bookOnBehalf, setBookOnBehalf] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    category: 'general' as MeetingCategory,
    attendeeName: '',
    attendeeEmail: '',
    additionalAttendees: '',
    notes: '',
    duration: 30,
    frequency: 'none',
    occurrences: 1,
    meetingFormat: 'in-person' as 'online' | 'in-person',
    meetingLink: '',
    locationAddress: '',
    locality: 'internal' as MeetingLocality
  });

  useEffect(() => {
    if (isOpen && currentUser) {
      setSubmitted(false);
      setShowMore(false);
      setBookOnBehalf(false);
      const defaultDuration = initialDuration || host?.availability?.slotDuration || 30;
      setFormData({
        title: '',
        category: role === 'guest' ? 'client' : 'general',
        attendeeName: currentUser.name || '',
        attendeeEmail: currentUser.email || '',
        additionalAttendees: '',
        notes: '',
        duration: defaultDuration,
        frequency: 'none',
        occurrences: 1,
        meetingFormat: 'in-person',
        meetingLink: '',
        locationAddress: '',
        locality: deriveLocality({ bookedBy: role, category: role === 'guest' ? 'client' : 'general', attendeeEmail: currentUser.email, hostEmail: host?.email })
      });
      setTitleSuggestions([]);
    }
  }, [isOpen, currentUser, host, role, initialDuration]);

  const handleTitleChange = (value: string) => {
    setFormData(prev => ({ ...prev, title: value }));
    if (host) {
      const suggestions = smartDefaults.getTitleSuggestions(host.id, value);
      setTitleSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    }
  };

  const selectSuggestion = (title: string) => {
    setFormData(prev => ({ ...prev, title }));
    setShowSuggestions(false);
  };

  // Keep attendee fields in sync with the on-behalf toggle.
  useEffect(() => {
    if (isOpen && currentUser) {
      if (!bookOnBehalf) {
         setFormData(prev => ({ ...prev, attendeeName: currentUser.name, attendeeEmail: currentUser.email || '' }));
      } else {
         setFormData(prev => ({ ...prev, attendeeName: '', attendeeEmail: '' }));
      }
    }
  }, [bookOnBehalf, isOpen, currentUser]);

  if (!isOpen || !selectedSlot) return null;

  const dateStr = selectedDate.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const isInternal = role === 'manager' || role === 'subordinate' || role === 'admin';
  const isSelfBooking = currentUser?.id === host?.id;
  const canSubmit = !!formData.title && !!formData.attendeeName && !!formData.attendeeEmail;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ ...formData, bookOnBehalf });
    setSubmitted(true);
  };

  const fieldLabel = "absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-xs text-gray-500 dark:text-gray-400 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-al-adaam uppercase tracking-wider font-bold";
  const fieldInput = "input block w-full border-b border-gray-300 dark:border-gray-600 bg-transparent py-2.5 px-0 text-charcoal dark:text-white focus:border-al-adaam focus:outline-none focus:ring-0 peer";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* Slide-over Panel */}
      <div className={`absolute inset-y-0 ${lang === 'ar' ? 'left-0' : 'right-0'} max-w-lg w-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col transform transition-transform duration-500 ease-spring animate-slide-left`}>

        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 z-20">
          <div>
             <h3 className="text-xl font-display font-semibold text-charcoal dark:text-white">
                {submitted ? t('meetingScheduled') : (isSelfBooking ? t('addToCalendar') : t('bookMeeting'))}
             </h3>
             {!submitted && host && (
               <div className="flex items-center gap-2 mt-1">
                 {host.avatar ? (
                   <img src={host.avatar} className="w-5 h-5 rounded-full object-cover" alt="" />
                 ) : (
                   <span className="w-5 h-5 rounded-full bg-al-adaam/10 text-al-adaam flex items-center justify-center text-[8px] font-semibold" aria-hidden="true">{initialsOf(host.name)}</span>
                 )}
                 <span className="text-xs text-gray-500 dark:text-gray-400">{t('with')} <span className="font-semibold text-dune">{host.name}</span></span>
               </div>
             )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-charcoal dark:hover:text-white">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {submitted ? (
          /* Success */
          <div className="flex-1 overflow-y-auto relative flex flex-col items-center text-center justify-center p-8 animate-scale-in">
             <BookingSuccess3D />
             <div className="relative z-10 bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl max-w-sm w-full">
                <div className="w-16 h-16 bg-palm rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-lg shadow-palm/30">
                   <svg className="w-8 h-8 animate-check-pop" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h2 className="text-2xl font-display font-semibold text-charcoal dark:text-white mb-2">{t('meetingScheduled')}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                  {t('invitationSent')} <span className="font-semibold text-charcoal dark:text-white">{formData.attendeeEmail}</span>.
                </p>
                <div className="space-y-3">
                   <Button variant="default" fullWidth icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5v-5z"/></svg>} onClick={() => window.open(calendarIntegration.getGoogleCalendarUrl({...formData, date: selectedDate.toISOString().split('T')[0], time: selectedSlot.label}, host || null), '_blank')}>
                     Google Calendar
                   </Button>
                   <Button variant="default" fullWidth icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>} onClick={() => calendarIntegration.downloadICS({...formData, date: selectedDate.toISOString().split('T')[0], time: selectedSlot.label}, host || null)}>
                     Download .ICS
                   </Button>
                </div>
                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                  <Button variant="primary" fullWidth onClick={onClose}>{t('done')}</Button>
                </div>
             </div>
          </div>
        ) : (
          <>
          {/* Single-form body */}
          <form id="booking-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
             {/* Context Card */}
             <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center shadow-sm">
                <div>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('date')}</p>
                   <p className="text-sm font-medium text-charcoal dark:text-white">{dateStr}</p>
                </div>
                <div className="w-px h-8 bg-gray-200 dark:bg-gray-600"></div>
                <div className="text-right">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('time')}</p>
                   <p className="text-sm font-medium text-charcoal dark:text-white">{selectedSlot.label}</p>
                </div>
             </div>

             {/* Title */}
             <div className="group relative">
               <input
                 type="text" required autoFocus
                 className={`${fieldInput} text-lg font-medium`}
                 placeholder=" "
                 value={formData.title}
                 onChange={e => handleTitleChange(e.target.value)}
                 onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                 onFocus={() => { if (formData.title) handleTitleChange(formData.title); }}
               />
               <label className={fieldLabel}>{t('meetingTitle')}</label>
               {showSuggestions && titleSuggestions.length > 0 && (
                 <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 shadow-xl rounded-b-xl border border-t-0 border-gray-100 dark:border-gray-700 z-50 max-h-48 overflow-y-auto">
                   {titleSuggestions.map((suggestion, idx) => (
                     <button key={idx} type="button" className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-charcoal dark:text-white border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors" onClick={() => selectSuggestion(suggestion)}>
                       {suggestion}
                     </button>
                   ))}
                 </div>
               )}
             </div>

             {/* Attendee (on-behalf + name/email) */}
             {isInternal && !isSelfBooking && (
               <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-charcoal dark:text-white">{t('bookingForSomeoneElse')}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                     <input type="checkbox" checked={bookOnBehalf} onChange={(e) => setBookOnBehalf(e.target.checked)} className="sr-only peer" />
                     <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-al-adaam/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-al-adaam"></div>
                  </label>
               </div>
             )}
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
               <div className="relative group">
                 <input type="text" required className={fieldInput} value={formData.attendeeName} onChange={e => setFormData({...formData, attendeeName: e.target.value})} disabled={!bookOnBehalf && !isSelfBooking && !!currentUser} placeholder=" " />
                 <label className={fieldLabel}>{t('attendeeName')}</label>
               </div>
               <div className="relative group">
                 <input type="email" required className={fieldInput} value={formData.attendeeEmail} onChange={e => setFormData({...formData, attendeeEmail: e.target.value})} disabled={!bookOnBehalf && !isSelfBooking && !!currentUser} placeholder=" " />
                 <label className={fieldLabel}>{t('email')}</label>
               </div>
             </div>

             {/* Duration */}
             <div>
               <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">{t('duration')}</label>
               <div className="flex flex-wrap gap-2">
                  {[15, 30, 45, 60, 90].map(d => (
                    <button key={d} type="button" onClick={() => setFormData({...formData, duration: d})} disabled={!!initialDuration}
                      className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${formData.duration === d ? 'bg-charcoal dark:bg-white text-white dark:text-charcoal border-charcoal dark:border-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300'} ${!!initialDuration && formData.duration !== d ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {d} {t('minShort')}
                    </button>
                  ))}
               </div>
             </div>

             {/* Progressive disclosure: advanced options */}
             <button type="button" onClick={() => setShowMore(v => !v)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-al-adaam hover:text-al-adaam-dark transition-colors">
                <svg className={`w-4 h-4 transition-transform ${showMore ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                {showMore ? t('fewerOptions') : t('moreOptions')}
             </button>

             {showMore && (
               <div className="space-y-6 animate-fade-in border-t border-gray-100 dark:border-gray-800 pt-6">
                  {/* Category */}
                  <div>
                     <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">{t('meetingType')}</label>
                     <div className="grid grid-cols-2 gap-2">
                        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                           <button key={key} type="button" onClick={() => setFormData({...formData, category: key as MeetingCategory})}
                             className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${formData.category === key ? 'border-al-adaam bg-al-adaam/5 ring-1 ring-al-adaam' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 bg-white dark:bg-gray-800'}`}>
                              <div className="w-3 h-3 rounded-full" style={{ background: config.color }}></div>
                              <span className="text-xs font-bold text-charcoal dark:text-white">{config.label}</span>
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* Format */}
                  <div>
                     <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">{t('location')}</label>
                     <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-4">
                        <button type="button" onClick={() => setFormData({ ...formData, meetingFormat: 'in-person' })} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${formData.meetingFormat === 'in-person' ? 'bg-white dark:bg-gray-700 text-charcoal dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-charcoal dark:hover:text-white'}`}>
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                           {t('inPerson')}
                        </button>
                        <button type="button" onClick={() => setFormData({ ...formData, meetingFormat: 'online' })} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${formData.meetingFormat === 'online' ? 'bg-white dark:bg-gray-700 text-charcoal dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-charcoal dark:hover:text-white'}`}>
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                           {t('online')}
                        </button>
                     </div>
                     {formData.meetingFormat === 'online' ? (
                        <div className="group relative animate-fade-in-down">
                          <input type="text" className={fieldInput + ' text-sm'} placeholder=" " value={formData.meetingLink} onChange={e => setFormData({...formData, meetingLink: e.target.value})} />
                          <label className={fieldLabel}>{t('meetingLink')}</label>
                        </div>
                     ) : (
                        <div className="animate-fade-in-down">
                          <LocationAddressField value={formData.locationAddress} onChange={(v) => setFormData({ ...formData, locationAddress: v })} lang={lang} />
                        </div>
                     )}
                  </div>

                  {/* Locality */}
                  <div>
                     <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">{t('localityLabel')}</label>
                     <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        {(['internal', 'external'] as MeetingLocality[]).map(loc => (
                           <button key={loc} type="button" onClick={() => setFormData({ ...formData, locality: loc })}
                             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${formData.locality === loc ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-charcoal dark:hover:text-white'}`}
                             style={formData.locality === loc ? { color: `var(${LOCALITY_CONFIG[loc].cssVar})` } : undefined}>
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: `var(${LOCALITY_CONFIG[loc].cssVar})` }}></span>
                              {t(LOCALITY_CONFIG[loc].labelKey)}
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* Recurrence */}
                  <div>
                     <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">{t('recurrence')}</label>
                     <div className="flex gap-2 mb-3">
                        {['none', 'daily', 'weekly'].map(freq => (
                           <button key={freq} type="button" onClick={() => setFormData({ ...formData, frequency: freq, occurrences: freq === 'none' ? 1 : Math.max(2, formData.occurrences) })}
                             className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${formData.frequency === freq ? 'bg-charcoal dark:bg-white text-white dark:text-charcoal border-charcoal dark:border-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                              {t(`frequency${freq.charAt(0).toUpperCase() + freq.slice(1)}`)}
                           </button>
                        ))}
                     </div>
                     {formData.frequency !== 'none' && (
                        <div className="animate-fade-in flex items-center gap-3 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                            <span className="text-xs text-charcoal dark:text-white font-bold">{t('repeatFrequency')}</span>
                            <input type="number" min="2" max="10" value={formData.occurrences} onChange={e => setFormData({...formData, occurrences: Math.max(2, Math.min(10, parseInt(e.target.value) || 2))})}
                              className="w-16 p-1.5 text-center border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm font-bold focus:border-al-adaam outline-none" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">{t('times')}</span>
                        </div>
                     )}
                  </div>

                  {/* Additional attendees */}
                  <div>
                     <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">{t('additionalAttendees')}</label>
                     <textarea rows={2} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:outline-none placeholder-gray-400 transition-colors"
                       placeholder="comma-separated emails" value={formData.additionalAttendees} onChange={e => setFormData({...formData, additionalAttendees: e.target.value})} />
                  </div>

                  {/* Notes */}
                  <div className="group relative pt-2">
                     <textarea rows={3} className={fieldInput + ' text-sm resize-none'} placeholder=" " value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                     <label className={fieldLabel}>{t('notes')}</label>
                  </div>
               </div>
             )}
          </form>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-between items-center z-20">
             <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
             <Button type="submit" form="booking-form" variant="primary" disabled={!canSubmit} className="shadow-sm">
               {t('confirmBooking')}
             </Button>
          </div>
          </>
        )}
      </div>
    </div>
  );
};
