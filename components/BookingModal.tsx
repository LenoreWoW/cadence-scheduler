import React, { useState, useEffect } from 'react';
import { Meeting, Role, TimeSlot, Language, User, MeetingCategory } from '../types';
import { Button } from './Button';
import { storageService } from '../services/storageService';
import { CATEGORY_CONFIG } from '../constants';
import { calendarIntegration } from '../services/calendarIntegration';
import { smartDefaults } from '../services/smartDefaults';
import { BookingSuccess3D } from './BookingSuccess3D';

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
  const [step, setStep] = useState(1);
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
    meetingLink: ''
  });

  useEffect(() => {
    if (isOpen && currentUser) {
      setStep(1);
      setBookOnBehalf(false);
      // Use initialDuration if passed, otherwise fall back to host default
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
        meetingLink: ''
      });
      setTitleSuggestions([]);
    }
  }, [isOpen, currentUser, host, role, initialDuration]);

  // Handle title change and suggestions
  const handleTitleChange = (value: string) => {
    setFormData(prev => ({ ...prev, title: value }));
    if (host) {
      const suggestions = smartDefaults.getTitleSuggestions(host.id, value);
      setTitleSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
      
      // Auto-detect category
      if (value.length > 3) {
        const suggestedCategory = smartDefaults.getSuggestedCategory(host.id, value);
        if (suggestedCategory && suggestedCategory !== 'general') {
             // Optional: auto-set or hint. For now let's just leave it manual unless it's very strong
        }
      }
    }
  };

  const selectSuggestion = (title: string) => {
    setFormData(prev => ({ ...prev, title }));
    setShowSuggestions(false);
  };

  // Update name fields when toggle changes
  useEffect(() => {
    if (isOpen && currentUser) {
      if (!bookOnBehalf) {
         setFormData(prev => ({
           ...prev,
           attendeeName: currentUser.name,
           attendeeEmail: currentUser.email || ''
         }));
      } else {
         setFormData(prev => ({
           ...prev,
           attendeeName: '',
           attendeeEmail: ''
         }));
      }
    }
  }, [bookOnBehalf, isOpen, currentUser]);

  if (!isOpen || !selectedSlot) return null;

  const dateStr = selectedDate.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const isInternal = role === 'manager' || role === 'subordinate' || role === 'admin';
  const isSelfBooking = currentUser?.id === host?.id;

  const handleNext = () => { if (formData.title) setStep(prev => prev + 1); };
  const handleBack = () => { setStep(prev => prev - 1); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(formData); setStep(4); };

  const steps = [
     { id: 1, label: t('meetingTitle') }, // Actually Details
     { id: 2, label: t('attendee') }, 
     { id: 3, label: "Review" }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* Slide-over Panel */}
      <div className={`absolute inset-y-0 ${lang === 'ar' ? 'left-0' : 'right-0'} max-w-lg w-full bg-white shadow-2xl flex flex-col transform transition-transform duration-500 ease-spring animate-slide-left`}>
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white z-20">
          <div>
             <h3 className="text-xl font-display font-semibold text-charcoal">
                {step === 4 ? t('meetingScheduled') : (isSelfBooking ? "Add to Calendar" : t('bookMeeting'))}
             </h3>
             {step < 4 && host && (
               <div className="flex items-center gap-2 mt-1">
                 <img src={host.avatar || `https://ui-avatars.com/api/?name=${host.name}`} className="w-5 h-5 rounded-full" alt="" />
                 <span className="text-xs text-gray-500">with <span className="font-bold text-dune">{host.name}</span></span>
               </div>
             )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-400 hover:text-charcoal">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Progress Bar */}
        {step < 4 && (
           <div className="px-8 pt-4 pb-2 bg-gray-50/50">
              <div className="flex items-center gap-2">
                 {steps.map((s, idx) => (
                    <React.Fragment key={s.id}>
                       <div className={`flex items-center gap-2 transition-colors duration-300 ${step >= s.id ? 'text-charcoal' : 'text-gray-300'}`}>
                          <div className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center border ${step >= s.id ? 'bg-charcoal text-white border-charcoal' : 'bg-white border-gray-300'}`}>
                             {step > s.id ? '✓' : s.id}
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wider">{s.label}</span>
                       </div>
                       {idx < steps.length - 1 && <div className="h-px w-8 bg-gray-200"></div>}
                    </React.Fragment>
                 ))}
              </div>
           </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {step === 1 && (
             <div className="space-y-6 animate-fade-in">
                {/* Context Card */}
                <div className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
                   <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('date')}</p>
                      <p className="text-sm font-medium text-charcoal">{dateStr}</p>
                   </div>
                   <div className="w-px h-8 bg-gray-200"></div>
                   <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('time')}</p>
                      <p className="text-sm font-medium text-charcoal">{selectedSlot.label}</p>
                   </div>
                </div>

                {/* Title Input */}
                <div className="group relative">
                  <input
                    type="text"
                    required
                    autoFocus
                    className="input block w-full border-b border-gray-300 bg-transparent py-2.5 px-0 text-lg font-medium text-charcoal focus:border-al-adaam focus:outline-none focus:ring-0 peer"
                    placeholder=" "
                    value={formData.title}
                    onChange={e => handleTitleChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onFocus={() => { if (formData.title) handleTitleChange(formData.title); }}
                  />
                  <label className="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-xs text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-al-adaam uppercase tracking-wider font-bold">
                     {t('meetingTitle')}
                  </label>
                  
                  {/* Suggestions Dropdown */}
                  {showSuggestions && titleSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-b-xl border border-t-0 border-gray-100 z-50 max-h-48 overflow-y-auto">
                      {titleSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm text-charcoal border-b border-gray-50 last:border-0 transition-colors"
                          onClick={() => selectSuggestion(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Category Selection */}
                <div>
                   <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">{t('meetingType')}</label>
                   <div className="grid grid-cols-2 gap-2">
                      {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                         <button
                           key={key}
                           onClick={() => setFormData({...formData, category: key as MeetingCategory})}
                           className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${formData.category === key ? 'border-al-adaam bg-al-adaam/5 ring-1 ring-al-adaam' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                         >
                            <div className="w-3 h-3 rounded-full" style={{ background: config.color }}></div>
                            <span className="text-xs font-bold text-charcoal">{config.label}</span>
                         </button>
                      ))}
                   </div>
                </div>

                {/* Meeting Format */}
                <div>
                   <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">Location</label>
                   <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                      <button
                        onClick={() => setFormData({ ...formData, meetingFormat: 'in-person' })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${formData.meetingFormat === 'in-person' ? 'bg-white text-charcoal shadow-sm' : 'text-gray-500 hover:text-charcoal'}`}
                      >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                         In Person
                      </button>
                      <button
                        onClick={() => setFormData({ ...formData, meetingFormat: 'online' })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${formData.meetingFormat === 'online' ? 'bg-white text-charcoal shadow-sm' : 'text-gray-500 hover:text-charcoal'}`}
                      >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                         Online
                      </button>
                   </div>

                   {formData.meetingFormat === 'online' && (
                      <div className="animate-fade-in-down">
                         <div className="group relative">
                           <input
                             type="text"
                             className="input block w-full border-b border-gray-300 bg-transparent py-2.5 px-0 text-sm text-charcoal focus:border-al-adaam focus:outline-none focus:ring-0 peer"
                             placeholder=" "
                             value={formData.meetingLink}
                             onChange={e => setFormData({...formData, meetingLink: e.target.value})}
                           />
                           <label className="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-xs text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-al-adaam uppercase tracking-wider font-bold">
                              Meeting Link (Zoom, Teams, etc.)
                           </label>
                         </div>
                      </div>
                   )}
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">{t('duration')}</label>
                  <div className="flex gap-2">
                     {[15, 30, 45, 60, 90].map(d => (
                       <button 
                         key={d}
                         onClick={() => setFormData({...formData, duration: d})}
                         disabled={!!initialDuration}
                         className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all 
                           ${formData.duration === d 
                             ? 'bg-charcoal text-white border-charcoal' 
                             : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}
                           ${!!initialDuration && formData.duration !== d ? 'opacity-50 cursor-not-allowed' : ''}
                         `}
                       >
                         {d} min
                       </button>
                     ))}
                  </div>
                  {!!initialDuration && (
                     <p className="text-[10px] text-gray-400 mt-2 italic">Duration selected in previous step.</p>
                  )}
                </div>

                {/* Recurrence Options */}
                <div className="pt-4 border-t border-gray-100">
                   <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">{t('recurrence')}</label>
                   <div className="flex gap-2 mb-3">
                      {['none', 'daily', 'weekly'].map(freq => (
                         <button
                           key={freq}
                           onClick={() => setFormData({ ...formData, frequency: freq, occurrences: freq === 'none' ? 1 : Math.max(2, formData.occurrences) })}
                           className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${formData.frequency === freq ? 'bg-charcoal text-white border-charcoal' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                         >
                            {t(`frequency${freq.charAt(0).toUpperCase() + freq.slice(1)}`)}
                         </button>
                      ))}
                   </div>
                   
                   {formData.frequency !== 'none' && (
                      <div className="animate-fade-in flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <span className="text-xs text-charcoal font-bold">{t('repeatFrequency')}</span>
                          <div className="flex items-center gap-2">
                             <input 
                               type="number" 
                               min="2" 
                               max="10" 
                               value={formData.occurrences}
                               onChange={e => setFormData({...formData, occurrences: Math.max(2, Math.min(10, parseInt(e.target.value) || 2))})}
                               className="w-16 p-1.5 text-center border border-gray-300 rounded-md text-sm font-bold focus:border-al-adaam outline-none"
                             />
                             <span className="text-xs text-gray-500">{t('times')}</span>
                          </div>
                      </div>
                   )}
                </div>
                
                {/* Notes */}
                <div className="group relative pt-2">
                   <textarea
                     rows={3}
                     className="input block w-full border-b border-gray-300 bg-transparent py-2.5 px-0 text-sm text-charcoal focus:border-al-adaam focus:outline-none focus:ring-0 peer resize-none"
                     placeholder=" "
                     value={formData.notes}
                     onChange={e => setFormData({...formData, notes: e.target.value})}
                   />
                   <label className="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-xs text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-al-adaam uppercase tracking-wider font-bold">
                      {t('notes')}
                   </label>
                </div>
             </div>
          )}

          {step === 2 && (
             <div className="space-y-8 animate-slide-left">
                {isInternal && !isSelfBooking && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                     <span className="text-sm font-medium text-charcoal">Booking for someone else?</span>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={bookOnBehalf} onChange={(e) => setBookOnBehalf(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-al-adaam/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-al-adaam"></div>
                     </label>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="relative group">
                    <input
                      type="text"
                      required
                      className="input block w-full border-b border-gray-300 bg-transparent py-2.5 px-0 text-base text-charcoal focus:border-al-adaam focus:outline-none focus:ring-0 peer disabled:text-gray-400"
                      value={formData.attendeeName}
                      onChange={e => setFormData({...formData, attendeeName: e.target.value})}
                      disabled={!bookOnBehalf && !isSelfBooking && !!currentUser}
                      placeholder=" "
                    />
                     <label className="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-xs text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-al-adaam uppercase tracking-wider font-bold">
                       {t('attendee')} Name
                    </label>
                  </div>
                  <div className="relative group">
                    <input
                      type="email"
                      required
                      className="input block w-full border-b border-gray-300 bg-transparent py-2.5 px-0 text-base text-charcoal focus:border-al-adaam focus:outline-none focus:ring-0 peer disabled:text-gray-400"
                      value={formData.attendeeEmail}
                      onChange={e => setFormData({...formData, attendeeEmail: e.target.value})}
                      disabled={!bookOnBehalf && !isSelfBooking && !!currentUser}
                      placeholder=" "
                    />
                    <label className="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-xs text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-al-adaam uppercase tracking-wider font-bold">
                       {t('email')}
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                   <h4 className="text-xs font-bold uppercase tracking-widest text-dune mb-4">{t('additionalAttendees')}</h4>
                   <textarea
                     rows={2}
                     className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:outline-none placeholder-gray-400 transition-colors"
                     placeholder="comma-separated emails (e.g. colleague@work.com)"
                     value={formData.additionalAttendees}
                     onChange={e => setFormData({...formData, additionalAttendees: e.target.value})}
                   />
                </div>
             </div>
          )}

          {step === 3 && (
             <div className="space-y-6 animate-slide-left">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-lg relative overflow-hidden group">
                   <div className="absolute top-0 left-0 w-1 h-full transition-all duration-300 group-hover:w-2" style={{ background: CATEGORY_CONFIG[formData.category].color }}></div>
                   
                   <div className="flex justify-between items-start mb-6 pl-4">
                      <div>
                         <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest text-white mb-2" style={{ backgroundColor: CATEGORY_CONFIG[formData.category].color }}>
                            {CATEGORY_CONFIG[formData.category].label}
                         </span>
                         <h4 className="text-2xl font-display font-medium text-charcoal">{formData.title}</h4>
                      </div>
                   </div>
                   
                   <div className="space-y-4 pl-4">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-dune">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                         </div>
                         <div>
                            <p className="text-sm font-bold text-charcoal">{dateStr}</p>
                            <p className="text-xs text-gray-500">{selectedSlot.label} ({formData.duration} min)</p>
                         </div>
                      </div>

                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-dune">
                            {formData.meetingFormat === 'online' ? (
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            ) : (
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            )}
                         </div>
                         <div>
                            <p className="text-sm font-bold text-charcoal">{formData.meetingFormat === 'online' ? 'Online Meeting' : 'In Person'}</p>
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">{formData.meetingFormat === 'online' ? (formData.meetingLink || 'No link provided') : 'Office'}</p>
                         </div>
                      </div>
                      
                      {formData.frequency !== 'none' && (
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-dune">
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </div>
                            <div>
                               <p className="text-sm font-bold text-charcoal">{t(`frequency${formData.frequency.charAt(0).toUpperCase() + formData.frequency.slice(1)}`)}</p>
                               <p className="text-xs text-gray-500">{formData.occurrences} {t('times')}</p>
                            </div>
                         </div>
                      )}
                      
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-dune">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                         </div>
                         <div>
                            <p className="text-sm font-bold text-charcoal">{host?.name}</p>
                            <p className="text-xs text-gray-500">Host</p>
                         </div>
                      </div>

                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-dune">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                         </div>
                         <div>
                            <p className="text-sm font-bold text-charcoal">{formData.attendeeName}</p>
                            <p className="text-xs text-gray-500">{formData.attendeeEmail}</p>
                         </div>
                      </div>
                   </div>

                   {formData.notes && (
                      <div className="mt-6 pt-4 border-t border-gray-100 pl-4">
                         <p className="text-xs font-bold uppercase tracking-widest text-dune mb-1">{t('notes')}</p>
                         <p className="text-sm text-gray-600 italic">"{formData.notes}"</p>
                      </div>
                   )}
                </div>
             </div>
          )}

          {step === 4 && (
            <div className="relative flex flex-col items-center text-center justify-center h-full animate-scale-in">
               <BookingSuccess3D />
               
               <div className="relative z-10 bg-white p-8 rounded-2xl border border-gray-100 shadow-xl max-w-sm w-full">
                  <div className="w-16 h-16 bg-palm rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-lg shadow-palm/30">
                     <svg className="w-8 h-8 animate-check-pop" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h2 className="text-2xl font-display font-semibold text-charcoal mb-2">{t('meetingScheduled')}</h2>
                  <p className="text-gray-500 text-sm mb-6">
                    A calendar invitation has been sent to <br/><span className="font-bold text-charcoal">{formData.attendeeEmail}</span>.
                  </p>
                  
                  <div className="space-y-3">
                     <Button variant="default" fullWidth icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5v-5z"/></svg>} onClick={() => window.open(calendarIntegration.getGoogleCalendarUrl({...formData, date: selectedDate.toISOString().split('T')[0], time: selectedSlot.label}, host || null), '_blank')}>
                       Google Calendar
                     </Button>
                     <Button variant="default" fullWidth icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>} onClick={() => calendarIntegration.downloadICS({...formData, date: selectedDate.toISOString().split('T')[0], time: selectedSlot.label}, host || null)}>
                       Download .ICS
                     </Button>
                  </div>
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <Button variant="primary" fullWidth onClick={onClose}>Done</Button>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {step < 4 && (
          <div className="p-6 border-t border-gray-100 bg-white flex justify-between items-center z-20">
             {step > 1 ? (
               <Button variant="ghost" onClick={handleBack}>Back</Button>
             ) : (
               <Button variant="ghost" onClick={onClose}>Cancel</Button>
             )}
             
             {step < 3 ? (
               <Button onClick={handleNext} disabled={!formData.title}>
                 Next Step
               </Button>
             ) : (
               <Button onClick={handleSubmit} variant="primary" className="shadow-lg shadow-al-adaam/20">
                 Confirm Booking
               </Button>
             )}
          </div>
        )}
      </div>
    </div>
  );
};
