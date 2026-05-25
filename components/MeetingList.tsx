import React, { useState } from 'react';
import { Meeting, Role, User, Language } from '../types';
import { Button } from './Button';
import { ConfirmationModal } from './ConfirmationModal';
import { MeetingDetailsModal } from './MeetingDetailsModal';
import { CATEGORY_CONFIG } from '../constants';

interface MeetingListProps {
  meetings: Meeting[];
  currentUser: User;
  onCancel: (id: string) => void;
  onReschedule: (meeting: Meeting) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRemind?: (id: string) => void; 
  t: (key: string) => string;
  lang: Language;
  hosts?: User[];
  title?: string;
  selectedId?: string | null; // Added
}

export const MeetingList: React.FC<MeetingListProps> = ({ 
  meetings, 
  currentUser,
  onCancel,
  onReschedule,
  onApprove,
  onReject,
  onRemind,
  t,
  lang,
  hosts,
  title,
  selectedId
}) => {
  const [meetingToCancel, setMeetingToCancel] = useState<string | null>(null);
  const [meetingToReject, setMeetingToReject] = useState<string | null>(null);
  const [viewMeeting, setViewMeeting] = useState<Meeting | null>(null);

  const sortedMeetings = [...meetings].sort((a, b) => {
       const dateA = new Date(`${a.date}T${a.time}`);
       const dateB = new Date(`${b.date}T${b.time}`);
       return dateA.getTime() - dateB.getTime();
  });

  const handleConfirmCancel = () => {
    if (meetingToCancel) {
      onCancel(meetingToCancel);
      setMeetingToCancel(null);
    }
  };

  const handleConfirmReject = () => {
    if (meetingToReject) {
        onReject(meetingToReject);
        setMeetingToReject(null);
    }
  };

  return (
    <>
      <div className="space-y-3 md:space-y-4">
        {title && <h3 className="font-serif text-lg md:text-xl font-medium text-charcoal dark:text-white mb-4 md:mb-6">{title}</h3>}
        
        {sortedMeetings.length === 0 ? (
          <div className="border border-dashed border-dune/20 dark:border-gray-700 rounded-xl p-6 md:p-8 text-center bg-white/50 dark:bg-gray-800/50">
             <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
               <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
             </div>
             <p className="text-xs font-mono font-bold uppercase tracking-widest text-dune dark:text-gray-400">{t('noMeetings')}</p>
          </div>
        ) : (
          sortedMeetings.map(meeting => {
            const category = CATEGORY_CONFIG[meeting.category] || CATEGORY_CONFIG.general;
            
            // Logic: I can approve if I am the HOST and the status is pending
            const canApprove = meeting.hostId === currentUser.id && meeting.status === 'pending';
            
            // Logic: I can cancel if I am the HOST or the BOOKER (User)
            const canCancel = meeting.hostId === currentUser.id || meeting.userId === currentUser.id;

            const isSelected = selectedId === meeting.id;

            return (
              <div 
                key={meeting.id} 
                id={`meeting-${meeting.id}`}
                className={`group relative bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 transition-all duration-300 md:hover:shadow-lg md:hover:-translate-y-1 border overflow-hidden cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50
                  ${isSelected ? 'ring-2 ring-al-adaam shadow-lg border-transparent' : 'border-gray-100 dark:border-gray-700'}
                `}
                style={{ borderLeft: `4px solid ${category.color}` }}
                onClick={() => setViewMeeting(meeting)}
              >
                {/* Header with category and title */}
                <div className="flex items-start justify-between mb-3 md:mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                         <span className="inline-block px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white" style={{ backgroundColor: category.color }}>
                            {category.label}
                         </span>
                         {meeting.status === 'pending' && (
                             <span className="inline-flex items-center px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest bg-salmon text-white">
                                {t('pending')}
                             </span>
                         )}
                         {meeting.meetingFormat === 'online' && (
                           <span className="md:hidden inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                             <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                             Online
                           </span>
                         )}
                      </div>
                      <h4 className="font-serif font-bold text-base md:text-lg text-charcoal dark:text-white leading-tight line-clamp-2">{meeting.title}</h4>
                    </div>
                </div>

                {/* Mobile: Compact row | Desktop: Spacious row */}
                <div className="flex flex-wrap items-center gap-3 md:gap-6 mb-4 md:mb-6">
                   <div className="flex items-center gap-1.5 md:gap-2">
                      <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-dune" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="font-medium text-xs md:text-sm text-charcoal dark:text-white">{meeting.date}</span>
                   </div>
                   <div className="flex items-center gap-1.5 md:gap-2">
                      <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-dune" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="font-medium text-xs md:text-sm text-charcoal dark:text-white">{meeting.time}</span>
                   </div>
                   {/* Desktop only: Online badge */}
                   {meeting.meetingFormat === 'online' && (
                      <div className="hidden md:flex items-center gap-2">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                           <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                           <span className="text-[10px] font-bold uppercase tracking-wider">{t('online')}</span>
                        </div>
                        {meeting.meetingLink && (
                           <a 
                             href={meeting.meetingLink}
                             target="_blank"
                             rel="noopener noreferrer"
                             onClick={(e) => e.stopPropagation()}
                             className="text-blue-600 hover:text-blue-800 hover:underline text-xs flex items-center gap-1"
                           >
                              Join
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                           </a>
                        )}
                      </div>
                   )}
                </div>

                <div className="flex items-center justify-between border-t border-gray-50 dark:border-gray-700 pt-3 md:pt-4">
                   <div className="flex items-center gap-2 min-w-0 flex-1">
                     <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-dune text-white flex items-center justify-center text-[9px] md:text-[10px] font-bold flex-shrink-0">
                       {meeting.attendeeName.charAt(0)}
                     </div>
                     <span className="text-[10px] md:text-xs font-bold text-gray-500 dark:text-gray-400 truncate">{meeting.attendeeName}</span>
                   </div>

                   {/* Action Buttons - Larger touch targets on mobile */}
                   <div className="flex gap-1 md:gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {canApprove ? (
                        <>
                          <Button variant="success" onClick={() => onApprove(meeting.id)} className="px-2 md:px-3 py-1.5 md:py-1 text-[9px] md:text-[10px] h-auto">Approve</Button>
                          <Button variant="ghost" onClick={() => setMeetingToReject(meeting.id)} className="px-2 md:px-3 py-1.5 md:py-1 text-[9px] md:text-[10px] h-auto text-salmon hover:text-red-700 hover:bg-salmon/10">Reject</Button>
                        </>
                      ) : (
                        <>
                          {meeting.status === 'approved' && onRemind && meeting.hostId === currentUser.id && (
                             <button onClick={() => onRemind(meeting.id)} className="text-dune hover:text-charcoal dark:hover:text-white p-2 md:p-1 transition-colors touch-target" title="Send Reminder"><svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg></button>
                          )}
                          <button onClick={() => onReschedule(meeting)} className="text-dune hover:text-skyline p-2 md:p-1 transition-colors touch-target" title="Reschedule">
                              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </button>
                          {canCancel && (
                             <button onClick={() => setMeetingToCancel(meeting.id)} className="text-dune hover:text-salmon transition-colors p-2 md:p-1 touch-target" title="Cancel Meeting">
                                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                          )}
                        </>
                      )}
                   </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmationModal
        isOpen={!!meetingToCancel}
        onClose={() => setMeetingToCancel(null)}
        onConfirm={handleConfirmCancel}
        title={t('cancel')}
        message={t('confirmCancel')}
        confirmLabel={t('yes')}
        cancelLabel={t('no')}
        isRTL={lang === 'ar'}
      />

      <ConfirmationModal
        isOpen={!!meetingToReject}
        onClose={() => setMeetingToReject(null)}
        onConfirm={handleConfirmReject}
        title={t('reject')}
        message={t('confirmReject')}
        confirmLabel={t('yes')}
        cancelLabel={t('no')}
        isRTL={lang === 'ar'}
      />

      <MeetingDetailsModal
        isOpen={!!viewMeeting}
        onClose={() => setViewMeeting(null)}
        meeting={viewMeeting}
        t={t}
        lang={lang}
        currentUser={currentUser}
      />
    </>
  );
};