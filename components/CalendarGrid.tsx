
import React, { useEffect, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { CalendarDay, Language, Meeting } from '../types';

interface CalendarGridProps {
  currentDate: Date;
  selectedDate: Date;
  meetings: Meeting[];
  onSelectDate: (date: Date) => void;
  onNextMonth: () => void;
  onPrevMonth: () => void;
  lang: Language;
  t: (key: string) => string;
  // Range Props
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
  isRangeMode?: boolean;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentDate,
  selectedDate,
  meetings,
  onSelectDate,
  onNextMonth,
  onPrevMonth,
  lang,
  t,
  rangeStart,
  rangeEnd,
  isRangeMode = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Swipe Gestures
  const handlers = useSwipeable({
    onSwipedLeft: () => lang === 'ar' ? onPrevMonth() : onNextMonth(),
    onSwipedRight: () => lang === 'ar' ? onNextMonth() : onPrevMonth(),
    preventScrollOnSwipe: true,
    trackMouse: false
  });

  // Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle if focused or active
    const newDate = new Date(selectedDate);
    let handled = true;

    switch (e.key) {
      case 'ArrowLeft':
        newDate.setDate(selectedDate.getDate() + (lang === 'ar' ? 1 : -1));
        break;
      case 'ArrowRight':
        newDate.setDate(selectedDate.getDate() + (lang === 'ar' ? -1 : 1));
        break;
      case 'ArrowUp':
        newDate.setDate(selectedDate.getDate() - 7);
        break;
      case 'ArrowDown':
        newDate.setDate(selectedDate.getDate() + 7);
        break;
      case 'Enter':
      case ' ':
        onSelectDate(selectedDate);
        return;
      case 'PageUp':
        onPrevMonth();
        return;
      case 'PageDown':
        onNextMonth();
        return;
      case 'Home':
        newDate.setDate(1);
        break;
      case 'End':
        newDate.setMonth(newDate.getMonth() + 1, 0);
        break;
      default:
        handled = false;
    }

    if (handled) {
      e.preventDefault();
      
      // Check if we need to switch months
      if (newDate.getMonth() !== currentDate.getMonth()) {
        if (newDate < currentDate) onPrevMonth();
        else onNextMonth();
      }
      
      onSelectDate(newDate);
    }
  };

  const generateCalendarDays = (date: Date): CalendarDay[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay(); 
    const days: CalendarDay[] = [];
    
    for (let i = 0; i < startDayOfWeek; i++) {
      const prevDate = new Date(year, month, 0 - (startDayOfWeek - 1 - i));
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false
      });
    }
    
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
      const current = new Date(year, month, i);
      days.push({
        date: current,
        isCurrentMonth: true,
        isToday: current.toDateString() === today.toDateString(),
        isSelected: current.toDateString() === selectedDate.toDateString()
      });
    }
    
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        date: nextDate,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false
      });
    }
    return days;
  };

  const days = generateCalendarDays(currentDate);
  const monthLabel = currentDate.toLocaleString(lang === 'ar' ? 'ar-EG' : 'default', { month: 'long', year: 'numeric' });
  const weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Helper to check range inclusion
  const isInRange = (date: Date) => {
    if (!rangeStart || !rangeEnd) return false;
    // Normalize to start of day
    const d = new Date(date.setHours(0,0,0,0)).getTime();
    const s = new Date(rangeStart.setHours(0,0,0,0)).getTime();
    const e = new Date(rangeEnd.setHours(0,0,0,0)).getTime();
    return d >= Math.min(s, e) && d <= Math.max(s, e);
  };

  const isRangeEndpoint = (date: Date) => {
    if (!rangeStart) return false;
    const d = new Date(date.setHours(0,0,0,0)).getTime();
    const s = new Date(rangeStart.setHours(0,0,0,0)).getTime();
    if (d === s) return true;
    if (rangeEnd) {
       const e = new Date(rangeEnd.setHours(0,0,0,0)).getTime();
       if (d === e) return true;
    }
    return false;
  };

  // Dynamic Legend Numbers
  const todayDayNumber = new Date().getDate();
  const selectedDayNumber = selectedDate.getDate();

  return (
    <div 
      {...handlers}
      ref={containerRef}
      className="w-full flex flex-col h-full bg-white p-4 rounded-lg outline-none focus:ring-2 focus:ring-al-adaam/50 focus:border-al-adaam transition-shadow touch-pan-y"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="grid"
      aria-label="Calendar"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-serif font-medium text-charcoal">{monthLabel}</h2>
        <div className="flex gap-1">
          <button onClick={onPrevMonth} type="button" className="w-7 h-7 flex items-center justify-center rounded-full text-dune hover:bg-al-adaam hover:text-white transition-all rtl:rotate-180">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={onNextMonth} type="button" className="w-7 h-7 flex items-center justify-center rounded-full text-dune hover:bg-al-adaam hover:text-white transition-all rtl:rotate-180">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 mb-2">
        {weekDayLabels.map(day => (
          <div key={day} className="text-center text-[9px] font-bold text-dune uppercase tracking-widest pb-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day, idx) => {
          const isWeekend = day.date.getDay() === 5 || day.date.getDay() === 6; 
          const isPast = day.date < new Date(new Date().setHours(0,0,0,0));
          const dateKey = day.date.toISOString().split('T')[0];
          const dayMeetings = meetings.filter(m => m.date === dateKey && m.status !== 'cancelled' && m.status !== 'rejected');
          
          let cellClass = "relative w-8 h-8 flex flex-col items-center justify-center rounded-full transition-all duration-300 font-medium text-xs ";
          const inRange = isRangeMode && isInRange(day.date);
          const isEndpoint = isRangeMode && isRangeEndpoint(day.date);

          if (!day.isCurrentMonth) {
             cellClass += "text-dune/30 ";
          } else if (isPast && !day.isToday && !isRangeMode) { 
             cellClass += "text-dune/40 cursor-not-allowed ";
          } else if (isWeekend && !isRangeMode) {
             cellClass += "text-dune/60 ";
          } else {
             cellClass += "cursor-pointer hover:bg-al-adaam/10 text-charcoal ";
          }

          if (isRangeMode) {
             if (isEndpoint) {
                cellClass += " bg-al-adaam text-white shadow-md z-10 ";
             } else if (inRange) {
                cellClass += " bg-al-adaam/10 text-al-adaam rounded-none ";
             }
          } else {
             if (day.isSelected && day.isCurrentMonth) {
               cellClass = "relative w-8 h-8 flex flex-col items-center justify-center rounded-full bg-al-adaam text-white shadow-lg transform scale-110 z-10 transition-all duration-200 ease-spring";
             } else if (day.isToday) {
                cellClass += " text-al-adaam font-bold ";
             }
          }

          return (
            <div 
              key={idx} 
              className={`flex justify-center items-center py-1 ${inRange && !isEndpoint ? 'bg-al-adaam/5' : ''}`}
            >
              <button 
                type="button"
                className={cellClass}
                onClick={() => {
                   if (!day.isCurrentMonth) return;
                   if (!isRangeMode && isPast && !day.isToday) return; 
                   onSelectDate(day.date);
                }}
                disabled={!day.isCurrentMonth || (!isRangeMode && isPast && !day.isToday)}
              >
                <span className="relative z-10">
                  {day.date.getDate()}
                </span>
                
                {/* Meeting Indicator */}
                {!isRangeMode && day.isCurrentMonth && dayMeetings.length > 0 && !day.isSelected && (
                  <div className="absolute bottom-1 w-1 h-1 bg-al-adaam rounded-full"></div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {!isRangeMode && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 justify-center">
           <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-al-adaam"></div>
               <span className="text-[9px] text-dune font-bold uppercase tracking-widest">{t('legendBooked')}</span>
           </div>
           <div className="flex items-center gap-2">
               <div className="w-4 h-4 rounded-full bg-al-adaam text-white flex items-center justify-center text-[9px] font-bold shadow-sm">
                 {selectedDayNumber}
               </div>
               <span className="text-[9px] text-dune font-bold uppercase tracking-widest">{t('legendSelected')}</span>
           </div>
           <div className="flex items-center gap-2">
               <span className="text-al-adaam font-bold text-xs">{todayDayNumber}</span>
               <span className="text-[9px] text-dune font-bold uppercase tracking-widest">{t('legendToday')}</span>
           </div>
        </div>
      )}
    </div>
  );
};
