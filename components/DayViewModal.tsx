

import React, { useState } from 'react';
import { Meeting, TimeSlot, Role, User, Language } from '../types';
import { MeetingList } from './MeetingList';
import { TimeSlotList } from './TimeSlotList';
import { Button } from './Button';

interface DayViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  meetings: Meeting[];
  slots: TimeSlot[];
  role: Role;
  onSelectSlot: (slot: TimeSlot) => void;
  currentUser: User;
  onCancel: (id: string) => void;
  onReschedule: (meeting: Meeting) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRemind?: (id: string) => void;
  t: (key: string) => string;
  lang: Language;
}

const TIMEZONES = [
  { value: 'Asia/Qatar', label: 'Qatar Time (GMT+3)' },
  { value: 'Europe/London', label: 'London (GMT+0/+1)' },
  { value: 'America/New_York', label: 'New York (EST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
];

export const DayViewModal: React.FC<DayViewModalProps> = ({
  isOpen, onClose, date, meetings, slots, role, onSelectSlot, currentUser,
  onCancel, onReschedule, onApprove, onReject, onRemind, t, lang
}) => {
  const [selectedZone, setSelectedZone] = useState('Asia/Qatar');

  if (!isOpen) return null;
  const dateStr = date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="fixed inset-0 z-40 overflow-hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className={`absolute inset-y-0 ${lang === 'ar' ? 'left-0' : 'right-0'} max-w-2xl w-full bg-white shadow-2xl flex flex-col transform transition-transform duration-500 ease-editorial animate-slide-left`}>
         <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-white">
            <div>
              <h2 className="text-3xl font-serif font-bold text-charcoal">{dateStr}</h2>
              <p className="text-sm text-gray-500 font-mono uppercase tracking-widest mt-1">Daily Agenda & Booking</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors group">
              <svg className="w-6 h-6 text-dune group-hover:text-al-adaam" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
         </div>
         
         <div className="flex-1 overflow-y-auto p-6 space-y-10">
            {/* Existing Meetings Agenda */}
            <section>
               <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-2 rounded-full bg-al-adaam"></div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-dune">
                    {t('upcoming')} <span className="text-charcoal opacity-50 ml-1">({meetings.length})</span>
                  </h3>
               </div>
               
               {meetings.length > 0 ? (
                 <div className="bg-off-white/50 rounded-xl">
                    <MeetingList 
                      meetings={meetings}
                      currentUser={currentUser}
                      onCancel={onCancel}
                      onReschedule={onReschedule}
                      onApprove={onApprove}
                      onReject={onReject}
                      onRemind={onRemind}
                      t={t}
                      lang={lang}
                    />
                 </div>
               ) : (
                  <p className="text-xs text-gray-400 italic">No meetings scheduled for today.</p>
               )}
            </section>

            {/* Available Slots */}
            <section>
               <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-palm"></div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-dune">
                      {t('selectTime')}
                    </h3>
                 </div>
                 
                 {/* Timezone Selector - Visual Only for Demo */}
                 <div className="relative">
                    <select 
                      value={selectedZone}
                      onChange={(e) => setSelectedZone(e.target.value)}
                      className="appearance-none bg-gray-50 border border-gray-200 text-xs font-bold text-charcoal rounded-full py-1.5 pl-4 pr-8 focus:outline-none focus:border-al-adaam cursor-pointer"
                    >
                      {TIMEZONES.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                 </div>
               </div>
               <div className="bg-white rounded-xl">
                  <TimeSlotList 
                    slots={slots}
                    role={role}
                    onSelectSlot={(slot) => { onSelectSlot(slot); }}
                    meetingsForDate={meetings}
                    t={t}
                    lang={lang}
                  />
               </div>
            </section>
         </div>
         
         <div className="p-6 border-t border-gray-100 bg-gray-50">
            <Button variant="secondary" fullWidth onClick={onClose}>Close Day View</Button>
         </div>
      </div>
    </div>
  );
};