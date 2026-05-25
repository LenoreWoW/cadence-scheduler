
import React, { useState, useMemo, useEffect } from 'react';
import { Meeting, User, Language, MeetingCategory } from '../types';
import { Button } from './Button';
import { CATEGORY_CONFIG } from '../constants';
import { MeetingList } from './MeetingList'; // Re-using basic list logic for parts, but wrapping heavily
import { shortcutManager } from '../services/keyboardShortcuts';

interface AppointmentsViewProps {
  meetings: Meeting[];
  currentUser: User;
  onCancel: (id: string) => void;
  onReschedule: (meeting: Meeting) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRemind?: (id: string) => void;
  t: (key: string) => string;
  lang: Language;
}

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({
  meetings, currentUser, onCancel, onReschedule, onApprove, onReject, onRemind, t, lang
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'cancelled'>('all');
  const [filterCategory, setFilterCategory] = useState<MeetingCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  // Filter Logic
  const filtered = useMemo(() => {
    return meetings.filter(m => {
      // Role Visibility Logic (simplified from App)
      const isRelated = m.hostId === currentUser.id || m.userId === currentUser.id;
      if (!isRelated) return false;

      // Status Filter
      if (filterStatus !== 'all' && m.status !== filterStatus) return false;
      
      // Category Filter
      if (filterCategory !== 'all' && m.category !== filterCategory) return false;

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return m.title.toLowerCase().includes(q) || m.attendeeName.toLowerCase().includes(q);
      }

      return true;
    });
  }, [meetings, currentUser, filterStatus, filterCategory, searchQuery]);

  // Grouping
  const { pending, upcoming, past } = useMemo(() => {
    const now = new Date();
    // Normalize today for comparison
    now.setHours(0,0,0,0);
    const todayStr = now.toISOString().split('T')[0];

    const p: Meeting[] = [];
    const u: Meeting[] = [];
    const history: Meeting[] = [];

    filtered.forEach(m => {
      if (m.status === 'pending') {
        p.push(m);
        return;
      }
      if (m.status === 'cancelled' || m.status === 'rejected') {
        // Optionally put cancelled in history or separate bucket. Spec puts them in list based on date.
        // For structure, let's put approved/pending in main lists, historical/cancelled in past if date is past.
      }

      const mDate = new Date(m.date + 'T' + m.time);
      if (m.date < todayStr) {
        history.push(m);
      } else {
        u.push(m);
      }
    });

    // Sort
    p.sort((a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime());
    u.sort((a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime());
    history.sort((a, b) => new Date(b.date + 'T' + b.time).getTime() - new Date(a.date + 'T' + a.time).getTime()); // Newest first for history

    return { pending: p, upcoming: u, past: history };
  }, [filtered]);

  // Group Upcoming by Date
  const upcomingGrouped = useMemo(() => {
    const groups: Record<string, Meeting[]> = {};
    upcoming.forEach(m => {
      const d = new Date(m.date);
      const label = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      if (!groups[label]) groups[label] = [];
      groups[label].push(m);
    });
    return groups;
  }, [upcoming, lang]);

  // Keyboard Navigation Integration
  useEffect(() => {
    // Flatten list for navigation
    const allVisibleMeetings = [
      ...pending,
      ...upcoming,
      ...(showPast ? past : [])
    ];
    
    const ids = allVisibleMeetings.map(m => m.id);
    shortcutManager.setListItems(ids);
    
    // Register selection handler
    shortcutManager.register('listSelectionChanged', () => {
      const id = shortcutManager.getSelectedItem();
      setSelectedMeetingId(id);
      
      // Auto-scroll
      if (id) {
        const element = document.getElementById(`meeting-${id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
    
    // Register actions
    shortcutManager.register('listApprove', () => {
      const id = shortcutManager.getSelectedItem();
      if (id) onApprove(id);
    });
    
    shortcutManager.register('listReject', () => {
      const id = shortcutManager.getSelectedItem();
      if (id) onReject(id);
    });
    
    shortcutManager.register('listCancel', () => {
      const id = shortcutManager.getSelectedItem();
      if (id) onCancel(id);
    });

    return () => {
      shortcutManager.clearListItems();
      shortcutManager.unregister('listSelectionChanged');
      shortcutManager.unregister('listApprove');
      shortcutManager.unregister('listReject');
      shortcutManager.unregister('listCancel');
    };
  }, [pending, upcoming, past, showPast, onApprove, onReject, onCancel]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 md:space-y-10 animate-fade-in">
      
      {/* Header & Filters */}
      <div>
        <h2 className="text-2xl md:text-3xl font-display font-medium text-charcoal dark:text-white mb-4 md:mb-6">{t('myAppointments')}</h2>
        
        {/* Mobile-optimized filters */}
        <div className="space-y-3 md:space-y-0 md:flex md:flex-row md:gap-4 p-3 md:p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
           {/* Search */}
           <div className="relative flex-1">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input 
                type="text" 
                placeholder="Search meetings..." 
                className="w-full pl-10 pr-4 py-2.5 md:py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-charcoal dark:text-white focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none transition-colors"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
           </div>
           
           {/* Mobile: Status Pills + Category Dropdown | Desktop: Both Dropdowns */}
           <div className="md:hidden">
             {/* Status Pills - Horizontal Scroll */}
             <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-3 px-3">
               {[
                 { value: 'all', label: 'All', color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' },
                 { value: 'pending', label: 'Pending', color: 'bg-salmon/10 text-salmon' },
                 { value: 'approved', label: 'Approved', color: 'bg-palm/10 text-palm' },
                 { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-500' }
               ].map(status => (
                 <button
                   key={status.value}
                   onClick={() => setFilterStatus(status.value as any)}
                   className={`
                     flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95
                     ${filterStatus === status.value 
                       ? 'bg-charcoal dark:bg-white text-white dark:text-charcoal shadow-sm' 
                       : status.color + ' hover:opacity-80'}
                   `}
                 >
                   {status.label}
                 </button>
               ))}
             </div>
             
             {/* Category Filter - Full Width */}
             <select 
               className="w-full mt-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-charcoal dark:text-white text-sm rounded-lg focus:border-al-adaam focus:ring-al-adaam block px-3 py-2.5 outline-none cursor-pointer"
               value={filterCategory}
               onChange={(e) => setFilterCategory(e.target.value as any)}
             >
               <option value="all">All Types</option>
               {Object.entries(CATEGORY_CONFIG).map(([key, conf]) => (
                 <option key={key} value={key}>{conf.label}</option>
               ))}
             </select>
           </div>
           
           {/* Desktop Dropdowns */}
           <div className="hidden md:flex gap-2">
              <select 
                className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-charcoal dark:text-white text-sm rounded-lg focus:border-al-adaam focus:ring-al-adaam block px-3 py-2 outline-none cursor-pointer"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select 
                className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-charcoal dark:text-white text-sm rounded-lg focus:border-al-adaam focus:ring-al-adaam block px-3 py-2 outline-none cursor-pointer"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as any)}
              >
                <option value="all">All Types</option>
                {Object.entries(CATEGORY_CONFIG).map(([key, conf]) => (
                  <option key={key} value={key}>{conf.label}</option>
                ))}
              </select>
           </div>
        </div>
      </div>

      {/* Pending Section */}
      {pending.length > 0 && (
        <div className="animate-slide-up">
           <div className="flex items-center gap-2 mb-3 md:mb-4">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-salmon/10 text-salmon flex items-center justify-center">
                 <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-base md:text-lg font-bold text-charcoal dark:text-white">Pending Requests ({pending.length})</h3>
           </div>
           <div className="bg-salmon/5 dark:bg-salmon/10 border-l-4 border-salmon rounded-r-xl p-4 md:p-6">
              <MeetingList 
                meetings={pending} 
                currentUser={currentUser} 
                onCancel={onCancel} 
                onReschedule={onReschedule} 
                onApprove={onApprove} 
                onReject={onReject} 
                onRemind={onRemind}
                t={t} 
                lang={lang} 
                selectedId={selectedMeetingId}
              />
           </div>
        </div>
      )}

      {/* Upcoming Section */}
      <div className="animate-slide-up delay-100">
         <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-bold text-charcoal dark:text-white flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-palm"></span>
               Upcoming
            </h3>
            <span className="text-[10px] md:text-xs font-mono text-dune">{upcoming.length} meetings</span>
         </div>
         
         {Object.keys(upcomingGrouped).length === 0 ? (
            <div className="text-center py-8 md:py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
               <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                 <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               </div>
               <p className="text-gray-400 dark:text-gray-500 text-sm">No upcoming meetings match your filters.</p>
            </div>
         ) : (
            <div className="space-y-6 md:space-y-8">
               {Object.entries(upcomingGrouped).map(([dateLabel, ms]) => (
                  <div key={dateLabel}>
                     <h4 className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-dune mb-2 md:mb-3 border-b border-gray-100 dark:border-gray-700 pb-2 sticky top-0 md:top-16 bg-white dark:bg-gray-900 z-10 -mx-4 px-4 md:mx-0 md:px-0">{dateLabel}</h4>
                     <MeetingList 
                        meetings={ms} 
                        currentUser={currentUser} 
                        onCancel={onCancel} 
                        onReschedule={onReschedule} 
                        onApprove={onApprove} 
                        onReject={onReject} 
                        onRemind={onRemind}
                        t={t} 
                        lang={lang} 
                        selectedId={selectedMeetingId}
                     />
                  </div>
               ))}
            </div>
         )}
      </div>

      {/* Past Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6 md:pt-8 animate-slide-up delay-200">
         <button 
           onClick={() => setShowPast(!showPast)}
           className="flex items-center gap-2 text-dune hover:text-charcoal dark:hover:text-white transition-colors group w-full touch-target py-2"
         >
            <svg className={`w-4 h-4 transition-transform duration-200 ${showPast ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            <span className="text-sm font-medium">Past Meetings ({past.length})</span>
         </button>
         
         {showPast && (
            <div className="mt-4 md:mt-6 opacity-70 hover:opacity-100 transition-opacity duration-300">
               <MeetingList 
                  meetings={past} 
                  currentUser={currentUser} 
                  onCancel={onCancel} 
                  onReschedule={onReschedule} 
                  onApprove={onApprove} 
                  onReject={onReject} 
                  onRemind={onRemind}
                  t={t} 
                  lang={lang} 
                  selectedId={selectedMeetingId}
               />
            </div>
         )}
      </div>

    </div>
  );
};