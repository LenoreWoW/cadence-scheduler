import React from 'react';
import { Meeting, Language, VideoPlatform } from '../types';
import { Button } from './Button';
import { CATEGORY_CONFIG, VIDEO_PLATFORM_CONFIG } from '../constants';
import { MeetingAttachmentsPanel } from './MeetingAttachmentsPanel';

interface MeetingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: Meeting | null;
  t: (key: string) => string;
  lang: Language;
}

export const MeetingDetailsModal: React.FC<MeetingDetailsModalProps> = ({
  isOpen,
  onClose,
  meeting,
  t,
  lang
}) => {
  if (!isOpen || !meeting) return null;

  const category = CATEGORY_CONFIG[meeting.category] || CATEGORY_CONFIG.general;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pb-20 text-center sm:block sm:p-0">
        
        <div 
          className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm transition-opacity" 
          aria-hidden="true"
          onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className={`inline-block align-middle bg-white rounded-2xl text-left rtl:text-right overflow-hidden shadow-2xl transform transition-all w-full max-w-2xl p-8`}>
          
          {/* Header */}
          <div className="flex justify-between items-start mb-8 border-b border-gray-100 pb-6">
             <div>
               <div className="flex items-center gap-3 mb-2">
                 <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-white" style={{ backgroundColor: category.color }}>
                    {category.label}
                 </span>
                 <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest
                    ${meeting.status === 'approved' ? 'bg-palm/10 text-palm' : 
                      meeting.status === 'pending' ? 'bg-salmon/10 text-salmon' : 
                      'bg-gray-100 text-gray-500'}`}>
                    {t(meeting.status)}
                 </span>
               </div>
               <h3 className="text-3xl font-serif font-bold text-charcoal leading-tight">{meeting.title}</h3>
             </div>
             <button onClick={onClose} className="text-gray-400 hover:text-charcoal p-2 rounded-full hover:bg-gray-100 transition-colors">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          </div>
          
          {/* Body */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
             
             {/* Time Details */}
             <div className="space-y-6">
                <h4 className="text-xs font-bold uppercase tracking-widest text-dune border-b border-gray-100 pb-2">Timing</h4>
                <div className="space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-dune">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <div>
                         <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Date</p>
                         <p className="font-medium text-charcoal">{meeting.date}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-dune">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div>
                         <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Time</p>
                         <p className="font-medium text-charcoal">{meeting.time} ({meeting.durationMinutes} min)</p>
                      </div>
                   </div>
                   
                   {/* Meeting Format */}
                   <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${meeting.meetingFormat === 'online' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-dune'}`}>
                        {meeting.meetingFormat === 'online' ? (
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        ) : (
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        )}
                      </div>
                      <div>
                         <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">{t('meetingFormatLabel')}</p>
                         <p className="font-medium text-charcoal">
                            {meeting.meetingFormat === 'online' ? t('online') : t('inPerson')}
                         </p>
                      </div>
                   </div>
                </div>
             </div>

             {/* People Details */}
             <div className="space-y-6">
                <h4 className="text-xs font-bold uppercase tracking-widest text-dune border-b border-gray-100 pb-2">Participants</h4>
                <div className="space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-dune">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                      <div>
                         <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Attendee</p>
                         <p className="font-medium text-charcoal">{meeting.attendeeName}</p>
                         <p className="text-xs text-gray-500">{meeting.attendeeEmail}</p>
                      </div>
                   </div>
                   {meeting.additionalAttendees && (
                      <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-dune shrink-0">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          </div>
                          <div>
                             <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Guests</p>
                             <p className="text-sm text-gray-600 whitespace-pre-line">{meeting.additionalAttendees}</p>
                          </div>
                      </div>
                   )}
                </div>
             </div>
          </div>

          {/* Notes */}
          {meeting.notes && (
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 mb-8">
               <h4 className="text-xs font-bold uppercase tracking-widest text-dune mb-3">Notes</h4>
               <p className="text-gray-700 text-sm leading-relaxed">{meeting.notes}</p>
            </div>
          )}
          
          {/* Meeting Link (for online meetings) */}
          {meeting.meetingFormat === 'online' && meeting.meetingLink && (
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 mb-8">
               <h4 className="text-xs font-bold uppercase tracking-widest text-blue-800 mb-3">{t('joinMeeting')}</h4>
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-2xl shadow-sm">
                     {VIDEO_PLATFORM_CONFIG[meeting.meetingPlatform as VideoPlatform]?.icon || '🔗'}
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className="text-sm font-bold text-blue-900">
                        {VIDEO_PLATFORM_CONFIG[meeting.meetingPlatform as VideoPlatform]?.label || t('online')}
                     </p>
                     <p className="text-xs text-blue-600 truncate">{meeting.meetingLink}</p>
                  </div>
                  <a
                    href={meeting.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
                  >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                     {t('joinMeeting')}
                  </a>
               </div>
            </div>
          )}
          
          <div className="border-t border-gray-100 pt-6">
            <h4 className="text-xs font-bold uppercase tracking-widest text-dune mb-2">Internal Info</h4>
            <p className="text-xs text-gray-500">
               Booked by: <span className="font-medium">{meeting.bookedBy}</span> | ID: {meeting.id}
            </p>
          </div>

          {/* Attachments */}
          <MeetingAttachmentsPanel
            meetingId={meeting.id}
            currentUserId={meeting.userId}
            lang={lang}
          />

          <div className="flex justify-end mt-6">
             <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
};