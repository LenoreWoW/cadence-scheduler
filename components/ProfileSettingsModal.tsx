
import React, { useState, useEffect } from 'react';
import { User, Language, DateRange, VideoPlatform } from '../types';
import { Button } from './Button';
import { audioService } from '../services/audioService';
import { CalendarGrid } from './CalendarGrid';
import { tourService } from '../services/tourService';
import { VIDEO_PLATFORM_CONFIG } from '../constants';
import { BookingLinksManager } from './BookingLinksManager';
import { CalendarSyncSettings } from './CalendarSyncSettings';
import { useReducedMotionState } from '../hooks/useReducedMotion';
import { WebhooksPanel } from './WebhooksPanel';
import { AccountSettingsPage } from './AccountSettingsPage';
import { OOOEditor } from './OOOEditor';
import { DateOverridesEditor } from './DateOverridesEditor';
import { TravelSchedulesEditor } from './TravelSchedulesEditor';
import { CRMConnectionsPanel } from './CRMConnectionsPanel';
import { WorkflowsPanel } from './WorkflowsPanel';
import { BlocklistManager } from './BlocklistManager';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (availability: any) => void;
  currentUser: User;
  t: (key: string) => string;
  lang: Language;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen, onClose, onSave, currentUser, t, lang
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'availability' | 'timeoff' | 'meeting' | 'booking' | 'calendar' | 'preferences' | 'integrations' | 'security'>('profile');
  const [integrationsSubTab, setIntegrationsSubTab] = useState<'webhooks' | 'tokens'>('webhooks');
  
  // Form State
  const [formData, setFormData] = useState({
    name: currentUser.name,
    title: currentUser.title || '',
    avatar: currentUser.avatar || '',
    startHour: currentUser.availability?.startHour ?? 9,
    endHour: currentUser.availability?.endHour ?? 17,
    slotDuration: currentUser.availability?.slotDuration ?? 30,
    bufferMinutes: currentUser.availability?.bufferMinutes ?? 0,
    minNoticeMinutes: currentUser.availability?.minNoticeMinutes ?? 120,
    days: currentUser.availability?.days ?? [0, 1, 2, 3, 4],
    timeOff: currentUser.availability?.timeOff ?? [],
    // Meeting settings
    preferredPlatform: currentUser.meetingSettings?.preferredPlatform || '' as VideoPlatform | '',
    meetingLink: currentUser.meetingSettings?.meetingLink || '',
    customPlatformName: currentUser.meetingSettings?.customPlatformName || ''
  });

  // Range Selection State
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  
  // Hourly Block State
  const [blockStartTime, setBlockStartTime] = useState('');
  const [blockEndTime, setBlockEndTime] = useState('');

  // Prefs State
  const [soundEnabled, setSoundEnabled] = useState(audioService.enabled);
  const { prefersReduced, override: reducedMotionOverride, setOverride: setReducedMotionOverride } = useReducedMotionState();

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: currentUser.name,
        title: currentUser.title || '',
        avatar: currentUser.avatar || '',
        startHour: currentUser.availability?.startHour ?? 9,
        endHour: currentUser.availability?.endHour ?? 17,
        slotDuration: currentUser.availability?.slotDuration ?? 30,
        bufferMinutes: currentUser.availability?.bufferMinutes ?? 0,
        minNoticeMinutes: currentUser.availability?.minNoticeMinutes ?? 120,
        days: currentUser.availability?.days ?? [0, 1, 2, 3, 4],
        timeOff: currentUser.availability?.timeOff ?? [],
        // Meeting settings
        preferredPlatform: currentUser.meetingSettings?.preferredPlatform || '',
        meetingLink: currentUser.meetingSettings?.meetingLink || '',
        customPlatformName: currentUser.meetingSettings?.customPlatformName || ''
      });
      setSoundEnabled(audioService.enabled);
      setRangeStart(null);
      setRangeEnd(null);
      setBlockStartTime('');
      setBlockEndTime('');
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      startHour: formData.startHour,
      endHour: formData.endHour,
      slotDuration: formData.slotDuration,
      bufferMinutes: formData.bufferMinutes,
      minNoticeMinutes: formData.minNoticeMinutes,
      days: formData.days,
      timeOff: formData.timeOff,
      // Meeting settings
      meetingSettings: {
        preferredPlatform: formData.preferredPlatform || null,
        meetingLink: formData.meetingLink || null,
        customPlatformName: formData.customPlatformName || null
      }
    });
    // Toggle sound global
    if (soundEnabled !== audioService.enabled) audioService.toggle();
    onClose();
  };

  const daysOfWeek = [
    { id: 0, label: 'Sun' }, { id: 1, label: 'Mon' }, { id: 2, label: 'Tue' },
    { id: 3, label: 'Wed' }, { id: 4, label: 'Thu' }, { id: 5, label: 'Fri' }, { id: 6, label: 'Sat' },
  ];

  const toggleDay = (id: number) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(id) ? prev.days.filter(d => d !== id) : [...prev.days, id]
    }));
  };

  const handleDateSelect = (date: Date) => {
     if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(date);
        setRangeEnd(null);
        // Reset times when starting new selection
        setBlockStartTime('');
        setBlockEndTime('');
     } else {
        // We have a start, no end
        if (date < rangeStart) {
           setRangeStart(date);
        } else {
           setRangeEnd(date);
        }
     }
  };

  const handleAddRange = () => {
     if (rangeStart) {
        const startStr = rangeStart.toISOString().split('T')[0];
        const endStr = rangeEnd ? rangeEnd.toISOString().split('T')[0] : startStr;
        
        let newRange: DateRange = { start: startStr, end: endStr };
        
        // Add specific times if provided and if it's a single day or ranges support it
        // We allow times even on ranges (e.g. daily block from 9-12 for a week)
        // OR treating it as continuous. For this UI, let's treat it as:
        // If times provided, it blocks that time on the dates.
        if (blockStartTime && blockEndTime) {
           newRange.startTime = blockStartTime;
           newRange.endTime = blockEndTime;
        }
        
        // Check duplicates (simple check)
        const exists = formData.timeOff.some(t => {
           if (typeof t === 'string') return t === startStr;
           return t.start === startStr && t.end === endStr && t.startTime === newRange.startTime;
        });

        if (!exists) {
           setFormData(prev => ({ ...prev, timeOff: [...prev.timeOff, newRange] }));
           setRangeStart(null);
           setRangeEnd(null);
           setBlockStartTime('');
           setBlockEndTime('');
        }
     }
  };

  const handleRemoveTimeOff = (index: number) => {
     setFormData(prev => ({
        ...prev,
        timeOff: prev.timeOff.filter((_, i) => i !== index)
     }));
  };

  // Visual Hour Bar calculation
  const totalHours = 24;
  const startPercent = (formData.startHour / totalHours) * 100;
  const widthPercent = ((formData.endHour - formData.startHour) / totalHours) * 100;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-middle bg-white rounded-2xl text-left rtl:text-right overflow-hidden shadow-2xl transform transition-all w-full max-w-4xl h-[650px] flex flex-col md:flex-row">
          
          {/* Sidebar Nav */}
          <div className="w-full md:w-64 bg-gray-50 border-r border-gray-100 flex flex-col p-4 gap-2">
             <div className="mb-6 px-4 pt-4">
                <h3 className="text-xl font-serif font-bold text-charcoal">Settings</h3>
                <p className="text-xs text-gray-500 mt-1">Manage account & schedule</p>
             </div>
             
             {[
               { id: 'profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
               { id: 'availability', label: 'Availability', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
               { id: 'timeoff', label: 'Time Off', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
               { id: 'meeting', label: 'Online Meetings', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
               { id: 'booking', label: 'Booking Links', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', dataTour: 'booking-links' },
               { id: 'calendar', label: 'Calendar Sync', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
               { id: 'integrations', label: 'Integrations', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
               { id: 'security', label: 'Security & Data', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
               { id: 'preferences', label: 'Preferences', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
             ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  data-tour={(item as any).dataTour}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-white text-al-adaam shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-charcoal'}`}
                >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                   {item.label}
                </button>
             ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 p-8 overflow-y-auto">
             <form onSubmit={handleSubmit} className="space-y-8 max-w-lg">
                
                {activeTab === 'profile' && (
                   <div className="animate-fade-in space-y-6">
                      <div className="flex items-center gap-6">
                         <div className="relative group cursor-pointer">
                            <img src={formData.avatar || `https://ui-avatars.com/api/?name=${formData.name}`} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" alt="" />
                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="text-white text-xs font-bold uppercase">Edit</span>
                            </div>
                         </div>
                         <div>
                            <h4 className="text-lg font-bold text-charcoal">{formData.name}</h4>
                            <p className="text-sm text-gray-500">{currentUser.role}</p>
                         </div>
                      </div>
                      
                      <div className="space-y-4">
                         <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">Display Name</label>
                            <input 
                              type="text" 
                              value={formData.name} 
                              onChange={e => setFormData({...formData, name: e.target.value})}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none"
                            />
                         </div>
                         <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">Job Title</label>
                            <input 
                              type="text" 
                              value={formData.title} 
                              onChange={e => setFormData({...formData, title: e.target.value})}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none"
                            />
                         </div>
                         <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">Avatar URL</label>
                            <input 
                              type="text" 
                              value={formData.avatar} 
                              onChange={e => setFormData({...formData, avatar: e.target.value})}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none"
                            />
                         </div>
                      </div>
                   </div>
                )}

                {activeTab === 'availability' && (
                   <div className="animate-fade-in space-y-8">
                      {/* Weekly Schedule */}
                      <div>
                         <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">Weekly Schedule</label>
                         <div className="flex flex-wrap gap-2">
                            {daysOfWeek.map(day => (
                               <button
                                 key={day.id}
                                 type="button"
                                 onClick={() => toggleDay(day.id)}
                                 className={`w-10 h-10 rounded-lg text-xs font-bold transition-all border ${formData.days.includes(day.id) ? 'bg-al-adaam text-white border-al-adaam shadow-md' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}
                               >
                                  {day.label}
                               </button>
                            ))}
                         </div>
                      </div>

                      {/* Working Hours Visual */}
                      <div>
                         <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">Working Hours ({formData.startHour}:00 - {formData.endHour}:00)</label>
                         <div className="h-12 bg-gray-100 rounded-lg relative overflow-hidden mb-4">
                            {/* Hour Markers */}
                            <div className="absolute inset-0 flex justify-between px-2 items-end pb-1">
                               {[0, 6, 12, 18, 24].map(h => (
                                  <span key={h} className="text-[9px] text-gray-400 font-mono">
                                     {h === 0 || h === 24 ? '12am' : h === 12 ? '12pm' : h > 12 ? (h-12)+'pm' : h+'am'}
                                  </span>
                               ))}
                            </div>
                            {/* Active Bar */}
                            <div 
                               className="absolute top-2 bottom-6 bg-al-adaam/20 border-l border-r border-al-adaam rounded-sm backdrop-blur-sm transition-all duration-300"
                               style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                            ></div>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="text-[10px] uppercase text-gray-400 font-bold">Start</label>
                               <select 
                                 value={formData.startHour}
                                 onChange={e => setFormData({...formData, startHour: Number(e.target.value)})}
                                 className="w-full mt-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-al-adaam outline-none"
                               >
                                  {Array.from({length: 24}, (_, i) => i).map(h => <option key={h} value={h}>{h}:00</option>)}
                               </select>
                            </div>
                            <div>
                               <label className="text-[10px] uppercase text-gray-400 font-bold">End</label>
                               <select 
                                 value={formData.endHour}
                                 onChange={e => setFormData({...formData, endHour: Number(e.target.value)})}
                                 className="w-full mt-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-al-adaam outline-none"
                               >
                                  {Array.from({length: 24}, (_, i) => i).map(h => <option key={h} value={h}>{h}:00</option>)}
                               </select>
                            </div>
                         </div>
                      </div>

                      {/* Configs */}
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                         <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">Slot Duration</label>
                            <select
                              value={formData.slotDuration}
                              onChange={e => setFormData({...formData, slotDuration: Number(e.target.value)})}
                              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-al-adaam outline-none"
                            >
                               {[15, 30, 45, 60, 90].map(m => <option key={m} value={m}>{m} min</option>)}
                            </select>
                         </div>
                         <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">Buffer Time</label>
                            <select
                              value={formData.bufferMinutes}
                              onChange={e => setFormData({...formData, bufferMinutes: Number(e.target.value)})}
                              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-al-adaam outline-none"
                            >
                               {[0, 5, 10, 15, 30].map(m => <option key={m} value={m}>{m} min</option>)}
                            </select>
                         </div>
                      </div>

                      <div className="pt-6 border-t border-gray-100">
                         <DateOverridesEditor lang={lang} />
                      </div>
                      <div className="pt-6 border-t border-gray-100">
                         <TravelSchedulesEditor lang={lang} />
                      </div>
                   </div>
                )}

                {activeTab === 'timeoff' && (
                   <div className="animate-fade-in space-y-6">
                      <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 text-orange-800 text-sm flex gap-3 items-start">
                         <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                         <p>Select dates to block. You can block full days or specific hours.</p>
                      </div>

                      <div className="flex flex-col md:flex-row gap-6">
                         {/* Integrated Range Calendar */}
                         <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm h-[320px]">
                            <CalendarGrid 
                               currentDate={currentCalendarDate}
                               selectedDate={new Date()} // Not used in range mode
                               meetings={[]} // Hide dots for this view
                               onSelectDate={handleDateSelect}
                               onNextMonth={() => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1))}
                               onPrevMonth={() => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1))}
                               lang={lang}
                               t={t}
                               isRangeMode={true}
                               rangeStart={rangeStart}
                               rangeEnd={rangeEnd}
                            />
                         </div>
                         
                         <div className="w-full md:w-48 flex flex-col gap-4">
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                               <p className="text-[10px] font-bold uppercase tracking-widest text-dune mb-1">Start</p>
                               <p className="text-sm font-medium">{rangeStart ? rangeStart.toLocaleDateString() : '-'}</p>
                               <div className="h-px bg-gray-200 my-2"></div>
                               <p className="text-[10px] font-bold uppercase tracking-widest text-dune mb-1">End</p>
                               <p className="text-sm font-medium">{rangeEnd ? rangeEnd.toLocaleDateString() : (rangeStart ? rangeStart.toLocaleDateString() : '-')}</p>
                            </div>
                            
                            {/* Hourly Blocking Inputs */}
                            <div className="space-y-2">
                               <div>
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-dune">From (Optional)</label>
                                  <input 
                                    type="time" 
                                    value={blockStartTime} 
                                    onChange={(e) => setBlockStartTime(e.target.value)} 
                                    className="w-full mt-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs"
                                    disabled={!rangeStart}
                                  />
                               </div>
                               <div>
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-dune">To (Optional)</label>
                                  <input 
                                    type="time" 
                                    value={blockEndTime} 
                                    onChange={(e) => setBlockEndTime(e.target.value)} 
                                    className="w-full mt-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs"
                                    disabled={!rangeStart}
                                  />
                               </div>
                            </div>

                            <Button type="button" variant="secondary" onClick={handleAddRange} disabled={!rangeStart}>
                               Add Block
                            </Button>
                         </div>
                      </div>

                      <div className="space-y-2 max-h-40 overflow-y-auto">
                         {formData.timeOff.length === 0 && <p className="text-gray-400 text-sm italic text-center py-4">No blocked dates.</p>}
                         {formData.timeOff.map((item, index) => {
                            let label = '';
                            let sublabel = '';

                            if (typeof item === 'string') {
                               label = item;
                               sublabel = 'All Day';
                            } else {
                               label = item.start === item.end ? item.start : `${item.start} — ${item.end}`;
                               if (item.startTime && item.endTime) {
                                  sublabel = `${item.startTime} - ${item.endTime}`;
                               } else {
                                  sublabel = 'All Day';
                               }
                            }
                            return (
                               <div key={index} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                                  <div className="flex flex-col">
                                     <span className="text-sm font-mono text-charcoal">{label}</span>
                                     <span className="text-xs text-gray-400">{sublabel}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTimeOff(index)}
                                    className="text-gray-400 hover:text-salmon p-1"
                                  >
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                               </div>
                            );
                         })}
                      </div>

                      <div className="pt-6 border-t border-gray-100">
                         <OOOEditor lang={lang} />
                      </div>
                   </div>
                )}

                {activeTab === 'meeting' && (
                   <div className="animate-fade-in space-y-6">
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-blue-800 text-sm flex gap-3 items-start">
                         <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                         <p>Set your preferred video conferencing platform. This link will be automatically included when online meetings are booked with you.</p>
                      </div>

                      {/* Platform Selection */}
                      <div>
                         <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">Preferred Platform</label>
                         <div className="grid grid-cols-2 gap-2">
                            {(Object.entries(VIDEO_PLATFORM_CONFIG) as [VideoPlatform, typeof VIDEO_PLATFORM_CONFIG[VideoPlatform]][]).map(([key, config]) => (
                               <button
                                 key={key}
                                 type="button"
                                 onClick={() => setFormData({...formData, preferredPlatform: key})}
                                 className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${formData.preferredPlatform === key ? 'border-al-adaam bg-al-adaam/5 ring-1 ring-al-adaam shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                               >
                                  <span className="text-xl">{config.icon}</span>
                                  <span className="text-sm font-bold text-charcoal">{config.label}</span>
                               </button>
                            ))}
                         </div>
                      </div>

                      {/* Custom Platform Name (for 'custom' type) */}
                      {formData.preferredPlatform === 'custom' && (
                         <div className="animate-fade-in">
                            <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">Platform Name</label>
                            <input 
                              type="text" 
                              value={formData.customPlatformName} 
                              onChange={e => setFormData({...formData, customPlatformName: e.target.value})}
                              placeholder="e.g., Jitsi, Whereby, etc."
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none"
                            />
                         </div>
                      )}

                      {/* Meeting Link */}
                      <div>
                         <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">
                            Your Meeting Link <span className="text-al-adaam">*</span>
                         </label>
                         <input 
                           type="url" 
                           value={formData.meetingLink} 
                           onChange={e => setFormData({...formData, meetingLink: e.target.value})}
                           placeholder={
                              formData.preferredPlatform === 'zoom' ? 'https://zoom.us/j/your-meeting-id' :
                              formData.preferredPlatform === 'teams' ? 'https://teams.microsoft.com/l/meetup-join/...' :
                              formData.preferredPlatform === 'google-meet' ? 'https://meet.google.com/xxx-xxxx-xxx' :
                              formData.preferredPlatform === 'webex' ? 'https://webex.com/meet/your-room' :
                              'https://your-meeting-link.com'
                           }
                           className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none"
                         />
                         <p className="text-[10px] text-gray-400 mt-2">
                            This is your personal meeting room link that will be shared with attendees when they book an online meeting with you.
                         </p>
                      </div>

                      {/* Preview */}
                      {formData.meetingLink && formData.preferredPlatform && (
                         <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 animate-fade-in">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-dune mb-3">Preview</h4>
                            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
                               <span className="text-2xl">{VIDEO_PLATFORM_CONFIG[formData.preferredPlatform as VideoPlatform]?.icon || '🔗'}</span>
                               <div>
                                  <p className="text-sm font-bold text-charcoal">
                                     {formData.preferredPlatform === 'custom' && formData.customPlatformName 
                                        ? formData.customPlatformName 
                                        : VIDEO_PLATFORM_CONFIG[formData.preferredPlatform as VideoPlatform]?.label || 'Meeting'}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate max-w-xs">{formData.meetingLink}</p>
                               </div>
                            </div>
                         </div>
                      )}
                   </div>
                )}

                {activeTab === 'booking' && (
                   <div className="animate-fade-in">
                      <BookingLinksManager
                        userId={currentUser.id}
                        t={t}
                        lang={lang}
                        accessToken={localStorage.getItem('accessToken') || ''}
                      />
                   </div>
                )}

                {activeTab === 'calendar' && (
                   <div className="animate-fade-in">
                      <CalendarSyncSettings
                        accessToken={localStorage.getItem('accessToken') || ''}
                        t={t}
                        lang={lang}
                      />
                   </div>
                )}

                {activeTab === 'integrations' && (
                   <div className="animate-fade-in space-y-8">
                      <CRMConnectionsPanel lang={lang} />

                      <div className="pt-6 border-t border-gray-100">
                         <WorkflowsPanel lang={lang} scope="user" />
                      </div>

                      <div className="pt-6 border-t border-gray-100 space-y-6">
                         <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 w-fit">
                            {(['webhooks', 'tokens'] as const).map(opt => (
                               <button
                                 key={opt}
                                 type="button"
                                 onClick={() => setIntegrationsSubTab(opt)}
                                 className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${integrationsSubTab === opt ? 'bg-white text-charcoal shadow-sm' : 'text-gray-500 hover:text-charcoal'}`}
                               >
                                  {opt === 'webhooks' ? 'Webhooks' : 'API Tokens'}
                               </button>
                            ))}
                         </div>
                         {integrationsSubTab === 'webhooks' ? (
                            <WebhooksPanel lang={lang} />
                         ) : (
                            <AccountSettingsPage userEmail={currentUser.email} lang={lang} section="tokens" />
                         )}
                      </div>
                   </div>
                )}

                {activeTab === 'security' && (
                   <div className="animate-fade-in space-y-8">
                      <AccountSettingsPage userEmail={currentUser.email} lang={lang} section="all" />
                      <div className="pt-6 border-t border-gray-100">
                         <BlocklistManager lang={lang} />
                      </div>
                   </div>
                )}

                {activeTab === 'preferences' && (
                   <div className="animate-fade-in space-y-6">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                         <div>
                            <h4 className="text-sm font-bold text-charcoal">Sound Effects</h4>
                            <p className="text-xs text-gray-500">Play sounds for actions like booking and clicking</p>
                         </div>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-al-adaam"></div>
                         </label>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                         <div>
                            <h4 className="text-sm font-bold text-charcoal">Reduced Motion</h4>
                            <p className="text-xs text-gray-500">
                              Minimize animations throughout the app
                              {reducedMotionOverride === null && (
                                <span className="ml-1 text-gray-400">(following system: {prefersReduced ? 'on' : 'off'})</span>
                              )}
                            </p>
                         </div>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={prefersReduced}
                              onChange={e => setReducedMotionOverride(e.target.checked)}
                              aria-label="Reduced motion"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-al-adaam"></div>
                         </label>
                      </div>
                      {reducedMotionOverride !== null && (
                        <div className="flex justify-end -mt-3">
                          <button
                            type="button"
                            onClick={() => setReducedMotionOverride(null)}
                            className="text-xs text-gray-500 hover:text-al-adaam underline"
                          >
                            Reset to system preference
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                         <div>
                            <h4 className="text-sm font-bold text-charcoal">Interactive Tour</h4>
                            <p className="text-xs text-gray-500">Restart the welcome tutorial</p>
                         </div>
                         <Button 
                           variant="secondary" 
                           onClick={() => {
                             tourService.resetTour('welcome');
                             tourService.startTour('welcome');
                             onClose();
                           }}
                           className="!py-2 !px-4 !text-xs"
                         >
                           Restart Tour
                         </Button>
                      </div>
                   </div>
                )}

                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                   <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                   <Button type="submit" className="shadow-lg shadow-al-adaam/20">Save Changes</Button>
                </div>
             </form>
          </div>
        </div>
      </div>
    </div>
  );
};
