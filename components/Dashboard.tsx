import React, { useMemo, useState, useEffect } from 'react';
import { useSwipeable } from 'react-swipeable';
import { Meeting, User, Language } from '../types';
import { Button } from './Button';
import { EmptyState3D } from './EmptyState3D';
import { AchievementGallery } from './AchievementGallery';
import { gamificationService, Achievement } from '../services/gamificationService';

interface DashboardProps {
  user: User;
  meetings: Meeting[];
  t: (key: string) => string;
  lang: Language;
  onNavigate: (view: any) => void;
  onBookForTeam?: () => void;
  onQuickBook?: () => void;
  onRefresh?: () => void; // Added for pull-to-refresh
}

export const Dashboard: React.FC<DashboardProps> = ({ user, meetings, t, lang, onNavigate, onBookForTeam, onQuickBook, onRefresh }) => {
  const [linkCopied, setLinkCopied] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [timeUntil, setTimeUntil] = useState<{ hours: number; minutes: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false); // Refresh state
  
  // Achievement State
  const [showAchievements, setShowAchievements] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<string[]>([]);

  // Pull-to-refresh Handlers
  const pullHandlers = useSwipeable({
    onSwipedDown: async (eventData) => {
      if (window.scrollY === 0 && eventData.deltaY > 100 && onRefresh) { // Only trigger at top
        setIsRefreshing(true);
        await onRefresh();
        setTimeout(() => setIsRefreshing(false), 1000); // Minimum feedback time
      }
    },
    preventScrollOnSwipe: false,
    trackMouse: false
  });

  useEffect(() => {
    setAchievements(gamificationService.getAchievements());
    setUserAchievements(gamificationService.getUserAchievements());
    const unsubscribe = gamificationService.subscribe(() => {
       setUserAchievements(gamificationService.getUserAchievements());
    });
    return unsubscribe;
  }, []);
  
  // Derived Data
  const myMeetings = useMemo(() => meetings.filter(m => m.hostId === user.id || m.userId === user.id), [meetings, user.id]);
  const pendingCount = myMeetings.filter(m => m.status === 'pending').length;
  const approvedCount = myMeetings.filter(m => m.status === 'approved').length;
  
  // Next Meeting Logic
  const nextMeeting = useMemo(() => {
    return myMeetings
      .filter(m => {
         if (m.status === 'cancelled' || m.status === 'rejected') return false;
         const mDate = new Date(m.date + 'T' + m.time);
         // Include recent past (1 hr ago) for "Happening Now"
         const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
         return mDate > oneHourAgo;
      })
      .sort((a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime())[0];
  }, [myMeetings]);

  // Timer Effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hour = now.getHours();
      let greetKey = 'Good morning';
      let theme = 'morning';

      if (hour >= 12 && hour < 17) {
        greetKey = 'Good afternoon';
        theme = 'afternoon';
      } else if (hour >= 17 && hour < 21) {
        greetKey = 'Good evening';
        theme = 'evening';
      } else if (hour >= 21 || hour < 5) {
        greetKey = 'Working late?';
        theme = 'night';
      }
      
      if (lang === 'ar') {
         if (theme === 'morning') greetKey = 'صباح الخير';
         else if (theme === 'night') greetKey = 'تعمل متأخراً؟';
         else greetKey = 'مساء الخير';
      }

      setGreeting(greetKey);
      document.body.setAttribute('data-time', theme);

      // Countdown logic
      if (nextMeeting) {
        const meetingTime = new Date(nextMeeting.date + 'T' + nextMeeting.time);
        const diff = meetingTime.getTime() - now.getTime();
        
        if (diff > 0) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeUntil({ hours, minutes });
        } else {
          setTimeUntil(null); // Happening now or past
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [lang, nextMeeting]);

  const todayStr = new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  const handleCopyLink = () => {
    const url = `https://adaam.scheduler.com/${user.username}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const isHappeningNow = nextMeeting && (!timeUntil || (timeUntil.hours === 0 && timeUntil.minutes < 0));

  return (
    <div {...pullHandlers} className="space-y-6 md:space-y-12 relative min-h-[80vh]">
      {/* Pull to Refresh Indicator */}
      {isRefreshing && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg text-al-adaam text-xs font-bold animate-fade-in-down">
           <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
           Refreshing...
        </div>
      )}
      
      {/* Editorial Header - Mobile Optimized */}
      <div className="flex flex-col gap-6 md:gap-8 animate-slide-up">
        {/* Greeting Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 lg:gap-8">
          <div>
            <div className="flex items-center gap-3 mb-2 md:mb-4">
              <span className="h-px w-6 md:w-8 bg-dune/50"></span>
              <p className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] text-dune">{todayStr}</p>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-display font-medium text-charcoal dark:text-white leading-[1] md:leading-[0.9] tracking-tight">
               {greeting}, <br className="hidden sm:block"/>
               <span className="text-dune opacity-80">{user.name.split(' ')[0]}.</span>
            </h1>
          </div>
          
          {/* Desktop Quick Actions - Hidden on Mobile */}
          <div className="hidden lg:grid grid-cols-3 gap-3 w-auto">
               {onQuickBook && (
                 <button 
                   onClick={onQuickBook}
                   data-tour="quick-book"
                   className="group flex flex-col items-start p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-al-adaam hover:shadow-lg transition-all rounded-lg text-left"
                 >
                    <div className="w-8 h-8 rounded-full bg-al-adaam/10 text-al-adaam flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <span className="text-sm font-bold text-charcoal dark:text-white group-hover:text-al-adaam transition-colors">Quick Book</span>
                    <span className="text-[10px] text-gray-500">Next available</span>
                 </button>
               )}

               <button 
                 onClick={() => onNavigate('scheduler')}
                 className="group flex flex-col items-start p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-al-adaam hover:shadow-lg transition-all rounded-lg text-left"
               >
                  <div className="w-8 h-8 rounded-full bg-al-adaam/10 text-al-adaam flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <span className="text-sm font-bold text-charcoal dark:text-white group-hover:text-al-adaam transition-colors">Book Meeting</span>
                  <span className="text-[10px] text-gray-500">Schedule new</span>
               </button>

               <button 
                 onClick={handleCopyLink}
                 data-tour="share-link"
                 className="group flex flex-col items-start p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-al-adaam hover:shadow-lg transition-all rounded-lg text-left"
               >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-transform group-hover:scale-110 ${linkCopied ? 'bg-palm/10 text-palm' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                     {linkCopied ? (
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     ) : (
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                     )}
                  </div>
                  <span className="text-sm font-bold text-charcoal dark:text-white group-hover:text-al-adaam transition-colors">{linkCopied ? 'Copied' : 'Copy Link'}</span>
                  <span className="text-[10px] text-gray-500">Share page</span>
               </button>
          </div>
        </div>
        
        {/* Mobile Quick Actions - Horizontal Scroll */}
        <div className="lg:hidden -mx-4 px-4">
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar scroll-smooth-mobile">
               {onQuickBook && (
                 <button 
                   onClick={onQuickBook}
                   data-tour="quick-book"
                   className="group flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-al-adaam to-al-adaam-dark text-white rounded-xl shadow-md shadow-al-adaam/20 active:scale-95 transition-transform"
                 >
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-bold block">Quick Book</span>
                      <span className="text-[10px] text-white/70">Next available</span>
                    </div>
                 </button>
               )}

               <button 
                 onClick={() => onNavigate('scheduler')}
                 className="group flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm active:scale-95 transition-transform"
               >
                  <div className="w-10 h-10 rounded-full bg-al-adaam/10 text-al-adaam flex items-center justify-center">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold text-charcoal dark:text-white block">Book Meeting</span>
                    <span className="text-[10px] text-gray-500">Schedule new</span>
                  </div>
               </button>

               <button 
                 onClick={handleCopyLink}
                 data-tour="share-link"
                 className="group flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm active:scale-95 transition-transform"
               >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${linkCopied ? 'bg-palm/10 text-palm' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                     {linkCopied ? (
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     ) : (
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                     )}
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold text-charcoal dark:text-white block">{linkCopied ? 'Copied!' : 'Share Link'}</span>
                    <span className="text-[10px] text-gray-500">Copy booking page</span>
                  </div>
               </button>

               {user.role !== 'guest' && (
                 <button 
                   onClick={onBookForTeam}
                   className="group flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm active:scale-95 transition-transform"
                 >
                    <div className="w-10 h-10 rounded-full bg-skyline/10 text-skyline flex items-center justify-center">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-bold text-charcoal dark:text-white block">Team</span>
                      <span className="text-[10px] text-gray-500">View peers</span>
                    </div>
                 </button>
               )}

               <button 
                 onClick={() => setShowAchievements(true)}
                 data-tour="achievements"
                 className="group flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm active:scale-95 transition-transform"
               >
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold text-charcoal dark:text-white block">Achievements</span>
                    <span className="text-[10px] text-gray-500">{userAchievements.length} Unlocked</span>
                  </div>
               </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 animate-slide-up delay-100">
        
        {/* Left Column: Stats - Horizontal on Mobile */}
        <div className="flex gap-3 md:gap-6 md:flex-col overflow-x-auto md:overflow-visible no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
           <div onClick={() => onNavigate('my-meetings')} className="flex-shrink-0 w-[160px] md:w-auto bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group active:scale-[0.98]">
              <div className="flex justify-between items-start mb-2 md:mb-4">
                 <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-dune">Pending</span>
                 <span className="w-2 h-2 rounded-full bg-salmon group-hover:animate-pulse"></span>
              </div>
              <div className="text-3xl md:text-5xl font-display font-light text-charcoal dark:text-white mb-1 md:mb-2">{pendingCount}</div>
              <div className="flex items-center gap-1 text-[10px] md:text-xs text-salmon font-medium">
                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 <span>Awaiting action</span>
              </div>
           </div>

           <div onClick={() => onNavigate('my-meetings')} className="flex-shrink-0 w-[160px] md:w-auto bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group active:scale-[0.98]">
              <div className="flex justify-between items-start mb-2 md:mb-4">
                 <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-dune">Approved</span>
                 <span className="w-2 h-2 rounded-full bg-palm"></span>
              </div>
              <div className="text-3xl md:text-5xl font-display font-light text-charcoal dark:text-white mb-1 md:mb-2">{approvedCount}</div>
              <div className="flex items-center gap-1 text-[10px] md:text-xs text-palm font-medium">
                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                 <span>Confirmed</span>
              </div>
           </div>
           
           {/* Mobile-only: Total Meetings Card */}
           <div onClick={() => onNavigate('my-meetings')} className="md:hidden flex-shrink-0 w-[160px] bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm cursor-pointer group active:scale-[0.98]">
              <div className="flex justify-between items-start mb-2">
                 <span className="text-[10px] font-bold uppercase tracking-widest text-dune">Total</span>
                 <span className="w-2 h-2 rounded-full bg-skyline"></span>
              </div>
              <div className="text-3xl font-display font-light text-charcoal dark:text-white mb-1">{pendingCount + approvedCount}</div>
              <div className="flex items-center gap-1 text-[10px] text-skyline font-medium">
                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                 <span>All meetings</span>
              </div>
           </div>
        </div>

        {/* Center/Right: Next Meeting Feature */}
        <div className="lg:col-span-2">
           <div className={`h-full min-h-[280px] md:min-h-[320px] rounded-2xl p-5 md:p-8 relative overflow-hidden flex flex-col justify-between group shadow-xl md:shadow-2xl transition-all duration-500 ${isHappeningNow ? 'bg-al-adaam text-white' : 'bg-charcoal dark:bg-gray-800 text-white'}`}>
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-gradient-to-br from-white/10 to-transparent opacity-20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:opacity-30 transition-opacity duration-700"></div>
              
              <div className="relative z-10 flex justify-between items-start">
                 <div className="flex items-center gap-2 md:gap-3">
                    <span className="relative flex h-2.5 w-2.5 md:h-3 md:w-3">
                      {nextMeeting && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>}
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 md:h-3 md:w-3 ${nextMeeting ? (isHappeningNow ? 'bg-white' : 'bg-al-adaam') : 'bg-gray-500'}`}></span>
                    </span>
                    <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/80">
                       {isHappeningNow ? 'Happening Now' : nextMeeting ? 'Next Up' : 'Schedule Clear'}
                    </span>
                 </div>
                 {nextMeeting && (
                    <span className="font-display text-lg md:text-2xl font-light opacity-80">{nextMeeting.time}</span>
                 )}
              </div>

              <div className="relative z-10 mt-auto pt-6 md:pt-12">
                 {nextMeeting ? (
                    <>
                      <h2 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-display font-medium mb-2 leading-tight max-w-xl line-clamp-2">
                        {nextMeeting.title}
                      </h2>
                      {timeUntil && (
                         <p className="text-white/60 text-xs md:text-sm font-mono uppercase tracking-widest mb-4 md:mb-6 animate-pulse-slow">
                            Starts in {timeUntil.hours > 0 ? `${timeUntil.hours}h ` : ''}{timeUntil.minutes}m
                         </p>
                      )}
                      
                      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between border-t border-white/10 pt-4 md:pt-6 gap-4">
                         <div className="flex items-center gap-3 md:gap-4">
                           <img 
                             src={`https://ui-avatars.com/api/?name=${nextMeeting.attendeeName}&background=random&color=fff`} 
                             className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-white/20" 
                             alt="" 
                           />
                           <div>
                             <p className="text-white/50 text-[9px] md:text-[10px] font-mono uppercase tracking-widest mb-0.5">Attendee</p>
                             <p className="text-xs md:text-sm font-medium">{nextMeeting.attendeeName}</p>
                           </div>
                         </div>
                         
                         <div className="flex gap-2 md:gap-3">
                            <Button variant="ghost" className="text-white border border-white/20 hover:bg-white/10 !py-2 !px-3 md:!px-4 !text-[10px] md:!text-xs flex-1 sm:flex-none">
                               Details
                            </Button>
                            {nextMeeting.meetingFormat === 'online' && nextMeeting.meetingLink && (
                              <Button 
                                onClick={() => window.open(nextMeeting.meetingLink, '_blank')}
                                className="!bg-white !text-charcoal hover:!bg-gray-100 !py-2 !px-3 md:!px-4 !text-[10px] md:!text-xs !shadow-none flex-1 sm:flex-none"
                              >
                               Join Meeting
                            </Button>
                            )}
                         </div>
                      </div>
                    </>
                 ) : (
                    <div className="text-center py-4 relative h-48 md:h-64 w-full">
                       <EmptyState3D type="calendar" />
                       <div className="absolute bottom-4 left-0 right-0">
                         <Button 
                           onClick={() => onNavigate('scheduler')} 
                           className="bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 !text-xs md:!text-sm"
                         >
                           Schedule First Meeting
                         </Button>
                       </div>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </div>
      
      {/* Activity Feed / History Teaser */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6 md:pt-8 animate-slide-up delay-200">
         <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-serif font-bold text-charcoal dark:text-white">Recent Activity</h3>
            <button onClick={() => onNavigate('logs')} className="text-[10px] md:text-xs font-bold text-dune hover:text-al-adaam uppercase tracking-wider transition-colors touch-target flex items-center gap-1">
               View Log
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
         </div>
         <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            {meetings.slice(0, 3).map((m, i) => (
              <div key={m.id} className="flex items-center justify-between p-3 md:p-4 border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors active:bg-gray-100 dark:active:bg-gray-700 press-effect">
                 <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.status === 'approved' ? 'bg-palm' : m.status === 'pending' ? 'bg-salmon' : 'bg-gray-300'}`}></div>
                    <div className="min-w-0 flex-1">
                       <p className="text-sm font-bold text-charcoal dark:text-white truncate">{m.title}</p>
                       <p className="text-xs text-gray-500 truncate">with {m.attendeeName}</p>
                    </div>
                 </div>
                 <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-[10px] md:text-xs font-mono text-charcoal dark:text-gray-300">{m.date}</p>
                    <p className={`text-[9px] md:text-[10px] uppercase font-medium ${m.status === 'approved' ? 'text-palm' : m.status === 'pending' ? 'text-salmon' : 'text-gray-400'}`}>{m.status}</p>
                 </div>
              </div>
            ))}
            {meetings.length === 0 && (
              <div className="p-6 md:p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-sm text-gray-400 dark:text-gray-500">No recent activity</p>
              </div>
            )}
         </div>
      </div>

      {showAchievements && (
        <AchievementGallery 
          achievements={achievements}
          userAchievements={userAchievements}
          onClose={() => setShowAchievements(false)}
          t={t}
          userId={user.id}
        />
      )}
    </div>
  );
};
