import React, { useState, useMemo } from 'react';
import { Meeting, Language, TimeSlot, Role, User } from '../types';
import { CalendarGrid } from './CalendarGrid';
import { TimeSlotList } from './TimeSlotList';
import { Button } from './Button';
import { generateTimeSlots, getMeetingsForDate } from '../services/schedulerService';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: Date, slot: TimeSlot) => void;
  meeting: Meeting | null;
  existingMeetings: Meeting[];
  t: (key: string) => string;
  lang: Language;
  role: Role;
  host?: User;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  meeting,
  existingMeetings,
  t,
  lang,
  role,
  host
}) => {
  // Local state for the modal's internal calendar navigation
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());

  // Reset to today or meeting date when opening
  React.useEffect(() => {
    if (isOpen && meeting) {
      const meetingDate = new Date(meeting.date);
      // Use today if meeting date is in the past, otherwise use meeting date
      const initialDate = meetingDate < new Date() ? new Date() : meetingDate;
      setSelectedDate(initialDate);
      setCurrentViewDate(initialDate);
    }
  }, [isOpen, meeting]);

  // Derived state for slots
  const { timeSlots, dailyMeetings } = useMemo(() => {
    if (!meeting || !host) return { timeSlots: [], dailyMeetings: [] };

    // Filter out the current meeting from availability check so it doesn't block itself
    const otherMeetings = existingMeetings.filter(m => m.id !== meeting.id);
    
    const slots = generateTimeSlots(selectedDate, otherMeetings, host);
    const daily = getMeetingsForDate(selectedDate, otherMeetings, meeting.hostId);
    
    return { timeSlots: slots, dailyMeetings: daily };
  }, [selectedDate, existingMeetings, meeting, host]);

  if (!isOpen || !meeting) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pb-20 text-center sm:block sm:p-0">
        
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-charcoal/70 backdrop-blur-sm transition-opacity" 
          aria-hidden="true"
          onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className={`inline-block align-middle bg-white rounded-2xl text-left rtl:text-right overflow-hidden shadow-2xl transform transition-all w-full max-w-5xl p-8`}>
          
          <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-6">
             <div>
               <h3 className="text-2xl font-serif font-bold text-charcoal">{t('selectNewDate')}</h3>
               <p className="text-sm text-gray-500 mt-1">
                 {t('reschedulePrompt')} <span className="font-bold text-al-adaam">"{meeting.title}"</span>
               </p>
             </div>
             <button onClick={onClose} className="text-gray-400 hover:text-charcoal p-2 rounded-full hover:bg-gray-100 transition-colors">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[500px]">
            <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
               <CalendarGrid
                 currentDate={currentViewDate}
                 selectedDate={selectedDate}
                 meetings={existingMeetings} // Pass all to show dots
                 onSelectDate={setSelectedDate}
                 onNextMonth={() => setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1))}
                 onPrevMonth={() => setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1))}
                 lang={lang}
                 t={t}
               />
            </div>
            <div className="flex flex-col">
               <h4 className="text-sm font-bold uppercase tracking-widest text-dune mb-4">Available Times</h4>
               <div className="flex-1 overflow-y-auto pr-2">
                 <TimeSlotList
                   slots={timeSlots}
                   role={role}
                   onSelectSlot={(slot) => onConfirm(selectedDate, slot)}
                   meetingsForDate={dailyMeetings}
                   t={t}
                   lang={lang}
                 />
               </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};