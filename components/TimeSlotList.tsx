

import React, { useMemo } from 'react';
import { TimeSlot, Role, Meeting, Language } from '../types';
import { smartDefaults } from '../services/smartDefaults';

interface TimeSlotListProps {
  slots: TimeSlot[];
  role: Role;
  onSelectSlot: (slot: TimeSlot) => void;
  meetingsForDate: Meeting[];
  t: (key: string) => string;
  lang: Language;
  hostId?: string; // Added for scoring
}

export const TimeSlotList: React.FC<TimeSlotListProps> = ({ 
  slots, 
  role, 
  onSelectSlot,
  meetingsForDate,
  t,
  lang,
  hostId
}) => {
  
  // Score slots if hostId is present
  const scoredSlots = useMemo(() => {
    if (!hostId) return slots;
    const scored = smartDefaults.scoreTimeSlots(slots, hostId);
    // Return original slot objects but with score metadata attached if possible, 
    // or just use the scored objects which extend TimeSlot
    return scored;
  }, [slots, hostId]);
  
  // Group slots
  const groups = {
    morning: scoredSlots.filter(s => s.period === 'morning' && s.available),
    afternoon: scoredSlots.filter(s => s.period === 'afternoon' && s.available),
    evening: scoredSlots.filter(s => s.period === 'evening' && s.available)
  };

  const hasAvailability = slots.some(s => s.available);

  // Find the highest score to highlight top recommendations
  const maxScore = Math.max(...scoredSlots.map((s: any) => s.score || 0));

  const renderGroup = (title: string, groupSlots: any[]) => {
    if (groupSlots.length === 0) return null;
    return (
      <div className="mb-6 animate-fade-in">
        <h4 className="text-xs font-bold uppercase tracking-widest text-dune mb-3 border-b border-gray-100 pb-2">{title}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {groupSlots.map((slot, idx) => {
             const isRecommended = slot.score && slot.score >= maxScore && slot.score > 50;
             
             return (
             <button
               key={slot.label}
               onClick={() => onSelectSlot(slot)}
                 className={`group relative px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95
                   ${isRecommended 
                     ? 'border-al-adaam/50 bg-al-adaam/5 text-charcoal ring-1 ring-al-adaam ring-offset-1' 
                     : 'border-dune/20 bg-white text-charcoal hover:border-al-adaam hover:bg-al-adaam hover:text-white'}
                 `}
               style={{ animationDelay: `${idx * 30}ms` }}
             >
                  {isRecommended && (
                    <span className="absolute -top-2 -right-2 w-4 h-4 bg-al-adaam text-white text-[10px] flex items-center justify-center rounded-full shadow-sm z-10">
                      ★
                    </span>
                  )}
                {slot.label}
             </button>
             );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
       {!hasAvailability ? (
         <div className="w-full py-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center">
            <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-dune font-mono text-xs uppercase tracking-widest">{t('unavailable')}</p>
         </div>
       ) : (
         <div className="pb-4">
           {renderGroup(lang === 'ar' ? 'الصباح' : 'Morning', groups.morning)}
           {renderGroup(lang === 'ar' ? 'بعد الظهر' : 'Afternoon', groups.afternoon)}
           {renderGroup(lang === 'ar' ? 'المساء' : 'Evening', groups.evening)}
         </div>
       )}
    </div>
  );
};