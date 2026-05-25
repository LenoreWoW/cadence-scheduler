
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarGrid } from './components/CalendarGrid';
import { TimeSlotList } from './components/TimeSlotList';
import { BookingModal } from './components/BookingModal';
import { MeetingList } from './components/MeetingList';
import { LoginPage } from './components/LoginPage';
import { LogsPanel } from './components/LogsPanel';
import { RescheduleModal } from './components/RescheduleModal';
import { HostSelector } from './components/HostSelector';
import { TeamManagement } from './components/TeamManagement';
import { Dashboard } from './components/Dashboard'; 
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast'; 
import { CommandPalette } from './components/CommandPalette';
import { AppointmentsView } from './components/AppointmentsView';
import { OnboardingFlow } from './components/OnboardingFlow'; 
import { MobileNav } from './components/MobileNav'; 
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { LiveRegion } from './components/LiveRegion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AchievementPopup } from './components/AchievementPopup';
import ThemeToggle from './components/ThemeToggle';
import { tourService } from './services/tourService';
import { PageTransition } from './components/PageTransition';
import { TourOverlay } from './components/TourOverlay';
import { QuickBookModal } from './components/QuickBookModal';
import { PublicBookingPage } from './components/PublicBookingPage';
import { ManageBookingPage } from './components/ManageBookingPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { ForgotPasswordPage } from './components/ForgotPasswordPage';
import { TeamBookingPage } from './components/TeamBookingPage';
import { Meeting, Role, TimeSlot, User, LogEntry, Language, Team, Achievement } from './types';
import { BookingLinksManager } from './components/BookingLinksManager';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { generateTimeSlots, createMeeting, createRecurringMeetings, cancelMeeting, rescheduleMeeting, getMeetingsForDate, updateMeetingStatus, checkMeetingConflict } from './services/schedulerService';
import { storageService } from './services/storageService';
import { authService } from './services/authService';
import { audioService } from './services/audioService';
import { achievementService } from './services/achievementService';
import { smartDefaults } from './services/smartDefaults';
import { shortcutManager } from './services/keyboardShortcuts';
import { translations } from './services/translations';
import { Button } from './components/Button';

interface AppProps {
  initialAuthMode?: 'login' | 'register';
}

const App: React.FC<AppProps> = ({ initialAuthMode }) => {
  // Global State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Views
  const [currentView, setCurrentView] = useState<'dashboard' | 'scheduler' | 'logs' | 'my-meetings' | 'team-management' | 'booking-links' | 'analytics'>('dashboard');
  const [lang, setLang] = useState<Language>('en');

  // Scheduler State
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Data State
  const [availableHosts, setAvailableHosts] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  // The host whose calendar we are viewing/booking on
  const [selectedHost, setSelectedHost] = useState<User | null>(null);
  
  // Booking Configuration State
  const [bookingDuration, setBookingDuration] = useState(30);

  // Interaction State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isQuickBookOpen, setIsQuickBookOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false); 
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  
  // Notification State
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  // Reschedule State
  const [rescheduleMeetingObj, setRescheduleMeetingObj] = useState<Meeting | null>(null);

  // Notifications & Achievements State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  
  // Accessibility State
  const [announcement, setAnnouncement] = useState('');

  // Initialize Data
  useEffect(() => {
    storageService.init();
    setMeetings(storageService.getMeetings());
    setLogs(storageService.getLogs());
    setTeams(storageService.getTeams());
    
    const sessionUser = authService.getCurrentSession();
    if (sessionUser) {
      setCurrentUser(sessionUser);
      if (sessionUser.role !== 'guest' && !sessionUser.onboardingCompleted) {
         setShowOnboarding(true);
      }
    }
    
    loadHosts();

    // Register Global Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => shortcutManager.handleKeyDown(e);
    window.addEventListener('keydown', handleKeyDown);
    
    shortcutManager.register('showShortcuts', () => setIsShortcutsModalOpen(prev => !prev));
    shortcutManager.register('openCommand', () => setIsCommandPaletteOpen(true));
    shortcutManager.register('goToDashboard', () => { setCurrentView('dashboard'); audioService.play('open'); });
    shortcutManager.register('goToSchedule', () => { setCurrentView('scheduler'); audioService.play('open'); });
    shortcutManager.register('goToAppointments', () => { setCurrentView('my-meetings'); audioService.play('open'); });
    shortcutManager.register('newMeeting', () => { setCurrentView('scheduler'); setSelectedHost(null); audioService.play('click'); });
    shortcutManager.register('quickBook', () => { setIsQuickBookOpen(true); audioService.play('click'); });
    shortcutManager.register('close', () => {
        setIsModalOpen(false);
        setIsProfileModalOpen(false);
        setIsCommandPaletteOpen(false);
        setIsShortcutsModalOpen(false);
        setIsQuickBookOpen(false);
        setRescheduleMeetingObj(null);
        setShowNotifications(false);
    });

    // Close notifications on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.onboardingCompleted) {
       // Check for welcome tour (only AFTER onboarding is complete)
       if (tourService.shouldShowTour('welcome')) {
         setTimeout(() => {
           tourService.startTour('welcome');
         }, 1000);
       }
    }
  }, [currentUser, currentUser?.onboardingCompleted]);

  const announce = (msg: string) => {
     setAnnouncement(msg);
     setTimeout(() => setAnnouncement(''), 1000);
  };

  const addToast = (type: ToastType, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    if (type === 'success') audioService.play('success');
    if (type === 'error') audioService.play('error');
    if (type === 'info') audioService.play('notification');
    announce(`${type}: ${message}`);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const checkAchievements = (action: 'login' | 'booking' | 'visit_team') => {
     if (!currentUser) return;
     const unlocks = achievementService.trackAction(currentUser.id, action);
     if (unlocks.length > 0) {
        setNewAchievements(prev => [...prev, ...unlocks]);
     }
  }

  const loadHosts = () => {
    const allUsers = storageService.getUsers();
    const internalUsers = allUsers.filter(u => u.role !== 'guest');
    // Sort by smart default preference
    const sortedHosts = smartDefaults.getPreferredHosts(internalUsers);
    setAvailableHosts(sortedHosts);
  };

  useEffect(() => {
    if (currentUser) {
       storageService.saveMeetings(meetings);
    }
  }, [meetings, currentUser]);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    if (lang === 'ar') document.body.classList.add('font-arabic');
    else document.body.classList.remove('font-arabic');
  }, [lang]);

  const t = (key: string) => translations[lang][key] || key;

  // Derived State
  const timeSlots = useMemo(() => {
    if (!selectedHost) return [];
    return generateTimeSlots(selectedDate, meetings, selectedHost, bookingDuration);
  }, [selectedDate, meetings, selectedHost, bookingDuration]);

  const dailyMeetings = useMemo(() => {
    if (!selectedHost) return [];
    return getMeetingsForDate(selectedDate, meetings, selectedHost.id);
  }, [selectedDate, meetings, selectedHost]);

  const requestsToApprove = useMemo(() => {
    if (!currentUser || currentUser.role === 'guest') return [];
    return meetings.filter(m => m.hostId === currentUser.id && m.status === 'pending');
  }, [meetings, currentUser]);

  // Handlers
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    loadHosts(); 
    setTeams(storageService.getTeams()); 
    setLogs(prev => [storageService.addLog({ action: 'LOGIN', details: 'User logged in', performedBy: user.name, role: user.role }), ...prev]);
    addToast('success', `${t('welcome')} ${user.name}`);
    setCurrentView(user.role === 'guest' ? 'scheduler' : 'dashboard');
    
    // Check login achievements
    setTimeout(() => {
       const unlocks = achievementService.trackAction(user.id, 'login');
       if (unlocks.length > 0) setNewAchievements(unlocks);
    }, 1000);

    if (user.role !== 'guest' && !user.onboardingCompleted) {
       setShowOnboarding(true);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setCurrentView('dashboard');
    setRescheduleMeetingObj(null);
    setSelectedHost(null);
    addToast('info', 'Logged out successfully');
  };

  const handleSelectHost = (host: User) => {
    smartDefaults.trackAction('view_host', { hostId: host.id });
    setSelectedHost(host); 
    setSelectedSlot(null);
    
    // Smart Default: Use recommended duration if available, else host default
    const recommendedDuration = smartDefaults.getRecommendedDuration(host.id);
    setBookingDuration(recommendedDuration || host.availability?.slotDuration || 30);
    
    audioService.play('click');
  };

  const handleCompleteOnboarding = (data: any) => {
     if (!currentUser) return;
     const updatedUser: User = {
        ...currentUser,
        onboardingCompleted: true,
        availability: {
           ...currentUser.availability,
           days: data.workingDays,
           startHour: data.startHour,
           endHour: data.endHour,
           slotDuration: data.slotDuration
        } as any
     };

     if (data.soundEnabled !== audioService.enabled) audioService.toggle();

     setCurrentUser(updatedUser);
     const allUsers = storageService.getUsers();
     const newUsers = allUsers.map(u => u.id === updatedUser.id ? updatedUser : u);
     storageService.saveUsers(newUsers);

     // Persist server-side too — without this, a localStorage clear re-runs onboarding.
     const accessToken = localStorage.getItem('accessToken');
     if (accessToken) {
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/users/${updatedUser.id}`, {
           method: 'PUT',
           headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
           },
           body: JSON.stringify({
              onboardingCompleted: true,
              availability: updatedUser.availability,
           }),
        }).catch(err => console.error('Failed to persist onboarding completion:', err));
     }

     setShowOnboarding(false);
     addToast('success', 'Setup complete!');
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    audioService.play('click');
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    audioService.play('click');
  };

  const handleContinueBooking = () => {
    setIsModalOpen(true);
    audioService.play('click');
  };

  const handleUpdateProfile = (availability: any) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, availability };
    setCurrentUser(updatedUser);
    const allUsers = storageService.getUsers();
    const newUsers = allUsers.map(u => u.id === currentUser.id ? updatedUser : u);
    storageService.saveUsers(newUsers);
    
    if (currentUser.role === 'manager' || currentUser.role === 'admin') {
       loadHosts();
       if(selectedHost?.id === currentUser.id) setSelectedHost(updatedUser);
    }
    addToast('success', 'Profile updated');
  };

  const handleBookingSubmit = (formData: any) => {
    if (!selectedSlot || !currentUser || !selectedHost) return;

    const baseDateStr = selectedDate.toISOString().split('T')[0];
    const newMeetingData = {
      title: formData.title,
      category: formData.category || 'general',
      date: baseDateStr,
      time: selectedSlot.label,
      durationMinutes: formData.duration || bookingDuration, 
      attendeeName: formData.attendeeName, 
      attendeeEmail: formData.attendeeEmail,
      additionalAttendees: formData.additionalAttendees,
      bookedBy: currentUser.role,
      userId: currentUser.id,
      notes: formData.notes,
      hostId: selectedHost.id,
      meetingFormat: formData.meetingFormat || 'in-person',
      meetingLink: formData.meetingLink
    };

    const buffer = selectedHost.availability?.bufferMinutes || 0;

    // Recurrence Logic
    if (formData.frequency && formData.frequency !== 'none') {
       let hasAnyConflict = false;
       const conflictingDates: string[] = [];
       const datesToCheck: string[] = [];
       
       for(let i=0; i<formData.occurrences; i++) {
          const d = new Date(baseDateStr);
          if (formData.frequency === 'daily') d.setDate(d.getDate() + i);
          if (formData.frequency === 'weekly') d.setDate(d.getDate() + (i * 7));
          datesToCheck.push(d.toISOString().split('T')[0]);
       }

       for (const dateStr of datesToCheck) {
          if (checkMeetingConflict(meetings, dateStr, newMeetingData.time, newMeetingData.durationMinutes, selectedHost.id, undefined, buffer)) {
             hasAnyConflict = true;
             conflictingDates.push(dateStr);
          }
       }

       if (hasAnyConflict) {
          if (!window.confirm(`${t('recurringConflictMessage')}\n${conflictingDates.join(', ')}\n\n${t('proceedAnyway')}`)) return;
       }

       setMeetings(prev => createRecurringMeetings(prev, newMeetingData, currentUser.role, formData.frequency, formData.occurrences));
       
       setLogs(prev => [storageService.addLog({ action: 'BOOK', details: `Scheduled recurring "${newMeetingData.title}" (${formData.frequency}) with ${selectedHost.name}`, performedBy: currentUser.name, role: currentUser.role }), ...prev]);
       
    } else {
       // Single Meeting
       const hasConflict = checkMeetingConflict(meetings, baseDateStr, newMeetingData.time, newMeetingData.durationMinutes, selectedHost.id, undefined, buffer);
       if (hasConflict && !window.confirm(`${t('conflictMessage')} ${t('proceedAnyway')}`)) return;

       setMeetings(prev => createMeeting(prev, newMeetingData, currentUser.role));
       setLogs(prev => [storageService.addLog({ action: 'BOOK', details: `Scheduled "${newMeetingData.title}" with ${selectedHost.name}`, performedBy: currentUser.name, role: currentUser.role }), ...prev]);
    }

    // Track smart defaults
    smartDefaults.trackAction('book_slot', { 
       hostId: selectedHost.id, 
       duration: newMeetingData.durationMinutes, 
       time: newMeetingData.time 
    });

    addToast('success', currentUser.role === 'guest' ? t('requestSent') : t('meetingScheduled'));
    checkAchievements('booking');
  };

  const handleCancelMeeting = (id: string) => {
    setMeetings(prev => cancelMeeting(prev, id));
    if (currentUser) {
      storageService.addLog({ action: 'CANCEL', details: `Cancelled meeting ID ${id}`, performedBy: currentUser.name, role: currentUser.role });
    }
    addToast('info', 'Meeting Cancelled');
  };

  const handleApprove = (id: string) => {
    setMeetings(prev => updateMeetingStatus(prev, id, 'approved'));
    if(currentUser) storageService.addLog({ action: 'APPROVE', details: `Approved ID ${id}`, performedBy: currentUser.name, role: currentUser.role });
    addToast('success', 'Meeting Approved');
  };

  const handleReject = (id: string) => {
    setMeetings(prev => updateMeetingStatus(prev, id, 'rejected'));
    if(currentUser) storageService.addLog({ action: 'REJECT', details: `Rejected ID ${id}`, performedBy: currentUser.name, role: currentUser.role });
    addToast('error', 'Meeting Rejected');
  };
  
  const handleRemind = (id: string) => {
    const meeting = meetings.find(m => m.id === id);
    if(meeting && currentUser) {
      storageService.addLog({ action: 'REMIND', details: `Sent reminder to ${meeting.attendeeName}`, performedBy: currentUser.name, role: currentUser.role });
      addToast('info', t('reminderSent'));
    }
  };

  const handleInitReschedule = (meeting: Meeting) => {
    setRescheduleMeetingObj(meeting);
  };

  const handleConfirmReschedule = (newDate: Date, newSlot: TimeSlot) => {
    if (!rescheduleMeetingObj || !currentUser) return;
    const dateStr = newDate.toISOString().split('T')[0];
    const hostId = rescheduleMeetingObj.hostId;
    const host = availableHosts.find(h => h.id === hostId);
    const buffer = host?.availability?.bufferMinutes || 0;

    const hasConflict = checkMeetingConflict(meetings, dateStr, newSlot.label, rescheduleMeetingObj.durationMinutes, hostId, rescheduleMeetingObj.id, buffer);
    if (hasConflict && !window.confirm(`${t('conflictMessage')} ${t('proceedAnyway')}`)) return;

    if (window.confirm(`${t('confirmReschedule')} ${newDate.toDateString()} @ ${newSlot.label}?`)) {
        setMeetings(prev => rescheduleMeeting(prev, rescheduleMeetingObj.id, dateStr, newSlot.label));
        storageService.addLog({ action: 'RESCHEDULE', details: `Rescheduled "${rescheduleMeetingObj.title}"`, performedBy: currentUser.name, role: currentUser.role });
        setRescheduleMeetingObj(null);
        addToast('success', 'Meeting Rescheduled');
    }
  };

  const toggleLang = () => {
    setLang(prev => prev === 'en' ? 'ar' : 'en');
    audioService.play('click');
  };

  const handleSelectTeam = () => {
    setSelectedHost(null); 
    setCurrentView('scheduler');
    checkAchievements('visit_team');
  };

  const handleMobileNavigate = (viewId: string) => {
     if (viewId === 'profile') {
        setIsProfileModalOpen(true);
     } else {
        setCurrentView(viewId as any);
     }
     audioService.play('click');
  };

  const commandActions = useMemo(() => [
    { id: 'dashboard', label: 'Go to Dashboard', icon: '🏠', shortcut: 'g d', action: () => setCurrentView('dashboard'), category: 'Navigation' },
    { id: 'schedule', label: 'Schedule Meeting', icon: '📅', shortcut: 'g s', action: () => setCurrentView('scheduler'), category: 'Navigation' },
    { id: 'appointments', label: 'My Appointments', icon: '📝', shortcut: 'g a', action: () => setCurrentView('my-meetings'), category: 'Navigation' },
    { id: 'new', label: 'New Meeting', icon: '⊕', shortcut: 'n', action: () => { setCurrentView('scheduler'); setSelectedHost(null); }, category: 'Actions' },
    { id: 'profile', label: 'Profile Settings', icon: '⚙️', shortcut: 'P', action: () => setIsProfileModalOpen(true), category: 'Settings' },
    ...(currentUser?.role !== 'guest' ? [{ id: 'booking-links', label: 'Manage Booking Links', icon: '🔗', action: () => setCurrentView('booking-links'), category: 'Settings' }] : []),
    ...(currentUser?.role === 'admin' ? [{ id: 'analytics', label: 'View Analytics', icon: '📊', action: () => setCurrentView('analytics'), category: 'Admin' }] : []),
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: '⌨️', shortcut: '?', action: () => setIsShortcutsModalOpen(true), category: 'Help' },
    { id: 'logout', label: 'Sign Out', icon: '🚪', action: handleLogout, category: 'Account' },
    ...(currentUser?.role === 'admin' ? [{ id: 'teams', label: 'Team Management', icon: '👥', action: () => setCurrentView('team-management'), category: 'Admin' }] : []),
    { id: 'lang', label: `Switch to ${lang === 'en' ? 'Arabic' : 'English'}`, icon: '🌐', action: toggleLang, category: 'Preferences' }
  ], [currentUser, lang]);

  if (!currentUser) {
    return (
      <ErrorBoundary>
         <LoginPage onLogin={handleLogin} lang={lang} t={t} toggleLang={toggleLang} initialMode={initialAuthMode} />
      </ErrorBoundary>
    );
  }

  const role = currentUser.role;

  return (
    <ErrorBoundary>
      <div className={`min-h-screen flex flex-col bg-white dark:bg-[#0a0a0a] text-charcoal dark:text-gray-100 font-sans transition-colors duration-300 pb-16 md:pb-0`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <LiveRegion message={announcement} />
        
        {/* Global Achievement Toast */}
        <AchievementPopup achievements={newAchievements} onClose={() => setNewAchievements([])} />

        {showOnboarding && (
           <OnboardingFlow onComplete={handleCompleteOnboarding} currentUser={currentUser} t={t} />
        )}

        <ToastContainer toasts={toasts} onRemove={removeToast} isRTL={lang === 'ar'} />
        <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} actions={commandActions} />
        <KeyboardShortcutsModal isOpen={isShortcutsModalOpen} onClose={() => setIsShortcutsModalOpen(false)} />

        {/* Sticky Header with Frosted Glass - Hidden on Mobile */}
        <div className="hidden md:block sticky top-0 left-0 right-0 z-[50] bg-white/80 dark:bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-700/60 transition-all duration-300 shadow-sm">
          <header className="max-w-[1440px] mx-auto flex justify-between items-center h-16 px-6 sm:px-8">
            {/* Logo */}
            <div className="group cursor-pointer flex items-center gap-3" onClick={() => setCurrentView('dashboard')}>
              <div className="w-8 h-8 bg-al-adaam rounded-full flex items-center justify-center text-white font-serif font-bold italic shadow-lg shadow-al-adaam/20">R</div>
              <div>
                <h1 className="text-xl font-display font-bold tracking-tight group-hover:text-al-adaam transition-colors duration-300">
                  REGENT
                </h1>
              </div>
            </div>

            {/* Navigation Pills */}
            <div className="flex items-center gap-2 md:gap-8">
              <nav className="hidden md:flex items-center space-x-1 rtl:space-x-reverse bg-gray-100/50 p-1 rounded-full">
                {[
                    { id: 'dashboard', label: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', show: role !== 'guest' },
                    { id: 'scheduler', label: t('scheduler'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', show: true },
                    { id: 'my-meetings', label: t('myAppointments'), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', show: true },
                    { id: 'team-management', label: t('teams'), icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', show: role === 'admin' },
                    { id: 'logs', label: t('logs'), icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', show: role === 'admin' },
                    { id: 'booking-links', label: 'Booking Links', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', show: role !== 'guest' },
                    { id: 'analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', show: role === 'admin' }
                ].map(nav => nav.show && (
                  <button
                    key={nav.id}
                    data-tour={nav.id === 'my-meetings' ? 'appointments' : nav.id}
                    onClick={() => { setCurrentView(nav.id as any); audioService.play('click'); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                      currentView === nav.id 
                      ? 'bg-white text-charcoal shadow-sm ring-1 ring-gray-200' 
                      : 'text-gray-500 hover:text-charcoal hover:bg-white/50'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={nav.icon} /></svg>
                    <span className="hidden lg:inline">{nav.label}</span>
                    {nav.id === 'my-meetings' && requestsToApprove.length > 0 && (
                       <span className="w-2 h-2 rounded-full bg-salmon animate-pulse"></span>
                    )}
                  </button>
                ))}
              </nav>
              
              <div className="flex items-center gap-3 border-l border-gray-200 dark:border-gray-700 pl-4 rtl:pr-4 rtl:pl-0">
                 {/* Theme Toggle */}
                 <ThemeToggle data-tour="theme-toggle" />
                 
                 {/* Notifications */}
                 <div className="relative" ref={notificationRef} data-tour="notifications">
                   <button 
                     className={`relative p-2 rounded-full transition-colors ${showNotifications ? 'bg-gray-100 dark:bg-gray-800 text-charcoal dark:text-white' : 'text-gray-400 hover:text-charcoal dark:hover:text-white'}`}
                     onClick={() => { setShowNotifications(!showNotifications); audioService.play('click'); }}
                   >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                      {requestsToApprove.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-salmon rounded-full border border-white"></span>}
                   </button>
                   
                   {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-scale-in origin-top-right">
                         <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h4 className="font-bold text-sm text-charcoal">Notifications</h4>
                            {requestsToApprove.length > 0 && <span className="bg-salmon text-white text-[10px] px-2 py-0.5 rounded-full">{requestsToApprove.length} New</span>}
                         </div>
                         <div className="max-h-64 overflow-y-auto">
                            {requestsToApprove.length === 0 ? (
                               <div className="p-8 text-center">
                                  <p className="text-gray-400 text-xs italic">No pending requests</p>
                               </div>
                            ) : (
                               requestsToApprove.map(req => (
                                  <div key={req.id} className="p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                     <div className="flex justify-between items-start mb-2">
                                        <p className="text-sm font-bold text-charcoal">{req.title}</p>
                                        <span className="text-[10px] text-gray-400">{req.date}</span>
                                     </div>
                                     <p className="text-xs text-gray-500 mb-3">from {req.attendeeName}</p>
                                     <div className="flex gap-2">
                                        <button onClick={() => handleApprove(req.id)} className="flex-1 bg-palm/10 text-palm text-[10px] font-bold py-1.5 rounded hover:bg-palm hover:text-white transition-colors">Approve</button>
                                        <button onClick={() => handleReject(req.id)} className="flex-1 bg-salmon/10 text-salmon text-[10px] font-bold py-1.5 rounded hover:bg-salmon hover:text-white transition-colors">Reject</button>
                                     </div>
                                  </div>
                               ))
                            )}
                         </div>
                         <button onClick={() => { setCurrentView('my-meetings'); setShowNotifications(false); }} className="w-full p-3 text-center text-xs font-bold text-dune hover:bg-gray-50 hover:text-al-adaam border-t border-gray-100 transition-colors">
                            View All Appointments
                         </button>
                      </div>
                   )}
                 </div>

                {(role === 'manager' || role === 'admin') && (
                  <div className="relative group cursor-pointer" data-tour="profile" onClick={() => setIsProfileModalOpen(true)}>
                     <img 
                       src={currentUser.avatar || `https://ui-avatars.com/api/?name=${currentUser.name}`} 
                       alt="Profile" 
                       className="w-8 h-8 rounded-full border border-gray-200 group-hover:border-al-adaam transition-colors"
                     />
                  </div>
                )}
                
                <button onClick={handleLogout} className="text-xs font-bold text-gray-400 hover:text-salmon transition-colors">
                   Sign Out
                </button>
              </div>
            </div>
          </header>
        </div>

        <main id="main-content" className="flex-1 w-full pt-6 md:pt-12 pb-12 px-4 sm:px-8 max-w-[1440px] mx-auto min-h-screen">
          {/* Mobile Header - Enhanced */}
          <div className="md:hidden sticky top-0 z-40 -mx-4 px-4 py-3 mb-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
             <div className="flex justify-between items-center">
               <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-al-adaam to-al-adaam-dark rounded-xl flex items-center justify-center text-white font-serif font-bold text-sm shadow-md shadow-al-adaam/20">R</div>
                  <div>
                    <span className="font-bold text-base text-charcoal dark:text-white tracking-tight block leading-none">REGENT</span>
                    <span className="text-[9px] text-dune font-medium uppercase tracking-widest">Scheduler</span>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                 <ThemeToggle />
                 {/* Notifications Bell */}
                 <button 
                   onClick={() => setShowNotifications(!showNotifications)}
                   className="relative p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 active:scale-95 transition-transform"
                 >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                   {requestsToApprove.length > 0 && (
                     <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-salmon text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
                       {requestsToApprove.length > 9 ? '9+' : requestsToApprove.length}
                     </span>
                   )}
                 </button>
               </div>
             </div>
             
             {/* Mobile Notifications Dropdown */}
             {showNotifications && (
               <div className="absolute top-full left-0 right-0 mt-1 mx-3 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-fade-in-down">
                 <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
                   <h4 className="font-bold text-sm text-charcoal dark:text-white">Notifications</h4>
                   <button onClick={() => setShowNotifications(false)} className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                     <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                 </div>
                 <div className="max-h-64 overflow-y-auto">
                   {requestsToApprove.length === 0 ? (
                     <div className="p-6 text-center">
                       <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                         <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                       </div>
                       <p className="text-gray-400 text-xs">All caught up!</p>
                     </div>
                   ) : (
                     requestsToApprove.map(req => (
                       <div key={req.id} className="p-3 border-b border-gray-50 dark:border-gray-700/50 active:bg-gray-50 dark:active:bg-gray-700">
                         <div className="flex justify-between items-start mb-2">
                           <p className="text-sm font-bold text-charcoal dark:text-white truncate flex-1">{req.title}</p>
                           <span className="text-[9px] text-gray-400 ml-2">{req.date}</span>
                         </div>
                         <p className="text-xs text-gray-500 mb-2">from {req.attendeeName}</p>
                         <div className="flex gap-2">
                           <button onClick={() => { handleApprove(req.id); setShowNotifications(false); }} className="flex-1 bg-palm text-white text-[10px] font-bold py-2 rounded-lg active:scale-95 transition-transform">Approve</button>
                           <button onClick={() => { handleReject(req.id); setShowNotifications(false); }} className="flex-1 bg-salmon text-white text-[10px] font-bold py-2 rounded-lg active:scale-95 transition-transform">Reject</button>
                         </div>
                       </div>
                     ))
                   )}
                 </div>
               </div>
             )}
          </div>

          {currentView === 'dashboard' ? (
            <PageTransition viewKey="dashboard">
            <Dashboard 
              user={currentUser} 
              meetings={meetings} 
              t={t} 
              lang={lang} 
              onNavigate={(view) => { setCurrentView(view); audioService.play('click'); }}
              onBookForTeam={handleSelectTeam}
                onQuickBook={() => { setIsQuickBookOpen(true); audioService.play('click'); }}
                onRefresh={async () => {
                  // Simulate refresh
                  await new Promise(resolve => setTimeout(resolve, 1500));
                  setMeetings(storageService.getMeetings()); // Reload from storage
                  loadHosts();
                  audioService.play('notification');
                  addToast('info', 'Dashboard refreshed');
                }}
            />
            </PageTransition>
          ) : currentView === 'logs' ? (
            <PageTransition viewKey="logs"><div className="animate-slide-up"><LogsPanel logs={logs} t={t} /></div></PageTransition>
          ) : currentView === 'team-management' ? (
             <PageTransition viewKey="team"><div className="animate-slide-up"><TeamManagement t={t} lang={lang} /></div></PageTransition>
          ) : currentView === 'booking-links' ? (
             <PageTransition viewKey="booking-links">
               <div className="animate-slide-up max-w-4xl mx-auto">
                 <BookingLinksManager
                   userId={currentUser.id}
                   t={t}
                   lang={lang}
                   accessToken={localStorage.getItem('accessToken') || ''}
                 />
               </div>
             </PageTransition>
          ) : currentView === 'analytics' ? (
             <PageTransition viewKey="analytics">
               <div className="animate-slide-up">
                 <AnalyticsDashboard
                   meetings={meetings}
                   users={availableHosts}
                   currentUser={currentUser}
                   language={lang}
                 />
               </div>
             </PageTransition>
          ) : currentView === 'my-meetings' ? (
            <PageTransition viewKey="appointments">
            <AppointmentsView
              meetings={meetings}
              currentUser={currentUser}
              onCancel={handleCancelMeeting}
              onReschedule={handleInitReschedule}
              onApprove={handleApprove}
              onReject={handleReject}
              onRemind={handleRemind}
              t={t}
              lang={lang}
            />
            </PageTransition>
          ) : (
            <PageTransition viewKey="scheduler">
            <div className="animate-slide-up space-y-8">
              {/* Host Selector */}
              {(!selectedHost || role === 'guest') && (
                <HostSelector 
                  hosts={availableHosts}
                  teams={teams}
                  selectedHost={selectedHost}
                  onSelectHost={handleSelectHost}
                  t={t}
                  lang={lang}
                  currentUser={currentUser}
                />
              )}

              {selectedHost && (
                <div className="max-w-[1440px] mx-auto animate-reveal pb-20">
                  {/* Context Header */}
                  <div className="sticky top-0 md:top-20 z-30 bg-white/95 backdrop-blur-md shadow-sm -mx-4 md:-mx-6 px-4 md:px-6 py-4 mb-8 flex justify-between items-center border-b border-gray-100 rounded-b-xl transition-all">
                      <div className="flex items-center gap-6">
                         <button 
                           onClick={() => { setSelectedHost(null); setSelectedSlot(null); }}
                           className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-charcoal uppercase tracking-widest transition-colors"
                         >
                           <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                           Back
                         </button>
                         <div className="h-8 w-px bg-gray-200"></div>
                         <div className="flex items-center gap-3">
                           <img className="h-10 w-10 rounded-full object-cover border border-gray-200" src={selectedHost.avatar || `https://ui-avatars.com/api/?name=${selectedHost.name}`} alt="" />
                           <div>
                              <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Scheduling with</p>
                              <h2 className="text-base font-bold text-charcoal leading-none">
                                {selectedHost.id === currentUser.id ? "My Calendar" : selectedHost.name}
                              </h2>
                           </div>
                         </div>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8">
                    {/* Calendar Column */}
                    <div className="lg:col-span-5 flex flex-col gap-8">
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden p-2">
                        <CalendarGrid 
                          currentDate={currentDate}
                          selectedDate={selectedDate}
                          onSelectDate={handleSelectDate}
                          onNextMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                          onPrevMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                          lang={lang}
                          t={t}
                          meetings={meetings.filter(m => m.hostId === selectedHost.id)}
                        />
                      </div>
                    </div>

                    {/* Time Slots Column */}
                    <div className="lg:col-span-7 space-y-6">
                       <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 min-h-[500px]">
                         <div className="flex items-center justify-between mb-6">
                            <div>
                               <h3 className="text-sm font-mono font-bold uppercase tracking-widest text-dune">Available Times</h3>
                               <h2 className="text-2xl font-display font-medium text-charcoal mt-1">
                                  {selectedDate.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                               </h2>
                            </div>
                            
                            {/* Duration Selector */}
                            <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                               {[15, 30, 45, 60].map(dur => (
                                 <button
                                   key={dur}
                                   onClick={() => { setBookingDuration(dur); setSelectedSlot(null); }}
                                   className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${bookingDuration === dur ? 'bg-charcoal text-white shadow-sm' : 'text-gray-500 hover:text-charcoal hover:bg-gray-50'}`}
                                 >
                                   {dur}m
                                 </button>
                               ))}
                            </div>
                         </div>
                         
                         <div className="overflow-y-auto max-h-[600px] pr-2">
                            <TimeSlotList 
                              slots={timeSlots} 
                              role={role}
                              onSelectSlot={handleSelectSlot}
                              meetingsForDate={dailyMeetings}
                              t={t}
                              lang={lang}
                            />
                         </div>
                       </div>
                    </div>
                  </div>
                  
                  {/* Selection Summary Bar (Sticky Bottom) */}
                  {selectedSlot && (
                     <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-xl border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-40 animate-slide-up">
                        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 px-4">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-palm/10 text-palm flex items-center justify-center">
                                 <svg className="w-6 h-6 animate-check-pop" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              </div>
                              <div>
                                 <p className="text-sm font-bold text-charcoal">
                                    {selectedDate.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                 </p>
                                 <p className="text-xs text-gray-500 font-mono">
                                    at <span className="font-bold text-dune">{selectedSlot.label}</span> ({bookingDuration} min)
                                 </p>
                              </div>
                           </div>
                           <Button onClick={handleContinueBooking} className="w-full md:w-auto shadow-lg shadow-al-adaam/20" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}>
                              Continue
                           </Button>
                        </div>
                     </div>
                  )}
                </div>
              )}
            </div>
            </PageTransition>
          )}
        </main>
        
        <MobileNav 
           currentView={currentView} 
           onNavigate={handleMobileNavigate}
           pendingCount={requestsToApprove.length}
        />

        <TourOverlay />

        <QuickBookModal
          isOpen={isQuickBookOpen}
          onClose={() => setIsQuickBookOpen(false)}
          onConfirm={(data) => {
             const newMeetingData = {
                title: data.title,
                category: 'general',
                date: data.date.toISOString().split('T')[0],
                time: data.slot.label,
                durationMinutes: 30,
                attendeeName: currentUser.name,
                attendeeEmail: currentUser.email,
                bookedBy: currentUser.role,
                userId: currentUser.id,
                hostId: data.hostId
             };
             
             setMeetings(prev => createMeeting(prev, newMeetingData as any, currentUser.role));
             setLogs(prev => [storageService.addLog({ action: 'BOOK', details: `Quick Booked "${data.title}"`, performedBy: currentUser.name, role: currentUser.role }), ...prev]);
             smartDefaults.trackAction('book_slot', { hostId: data.hostId, duration: 30, time: data.slot.label });
             addToast('success', 'Quick booking confirmed!');
             checkAchievements('booking');
             setIsQuickBookOpen(false);
          }}
          hosts={availableHosts}
          meetings={meetings}
          currentUser={currentUser}
        />

        <BookingModal 
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); }}
          onSubmit={handleBookingSubmit}
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          initialDuration={bookingDuration}
          role={role}
          t={t}
          lang={lang}
          currentUser={currentUser}
          host={selectedHost}
        />
        
        {currentUser && (
          <ProfileSettingsModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            onSave={handleUpdateProfile}
            currentUser={currentUser}
            t={t}
            lang={lang}
          />
        )}

        <RescheduleModal
          isOpen={!!rescheduleMeetingObj}
          onClose={() => setRescheduleMeetingObj(null)}
          onConfirm={handleConfirmReschedule}
          meeting={rescheduleMeetingObj}
          existingMeetings={meetings.filter(m => m.hostId === (rescheduleMeetingObj?.hostId || selectedHost?.id))}
          t={t}
          lang={lang}
          role={role}
          host={availableHosts.find(h => h.id === rescheduleMeetingObj?.hostId)}
        />
      </div>
    </ErrorBoundary>
  );
};

// Simple Router Component
const Router: React.FC = () => {
  const [route, setRoute] = useState(() => {
    return resolveRoute(window.location.pathname, window.location.search);
  });

  // Listen for navigation changes
  useEffect(() => {
    const handlePopState = () => {
      setRoute(resolveRoute(window.location.pathname, window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (route.type === 'public-booking') {
    return (
      <ErrorBoundary>
        <PublicBookingPage slug={route.slug} />
      </ErrorBoundary>
    );
  }
  if (route.type === 'team-booking') {
    return (
      <ErrorBoundary>
        <TeamBookingPage slug={route.slug} />
      </ErrorBoundary>
    );
  }
  if (route.type === 'manage-booking') {
    return (
      <ErrorBoundary>
        <ManageBookingPage token={route.token} />
      </ErrorBoundary>
    );
  }
  if (route.type === 'reset-password') {
    return (
      <ErrorBoundary>
        <ResetPasswordPage token={route.token} />
      </ErrorBoundary>
    );
  }
  if (route.type === 'forgot-password') {
    return (
      <ErrorBoundary>
        <ForgotPasswordPage />
      </ErrorBoundary>
    );
  }

  return <App initialAuthMode={route.authMode} />;
};

function resolveRoute(path: string, search: string): RouteState {
  if (path === '/login') return { type: 'app', authMode: 'login' };
  if (path === '/register') return { type: 'app', authMode: 'register' };
  if (path === '/forgot-password') return { type: 'forgot-password' };

  const params = new URLSearchParams(search);

  if (path === '/reset-password') {
    return { type: 'reset-password', token: params.get('token') || '' };
  }
  if (path === '/manage-booking') {
    return { type: 'manage-booking', token: params.get('token') || '' };
  }
  const teamBookingMatch = path.match(/^\/book\/team\/([^/]+)$/);
  if (teamBookingMatch) {
    return { type: 'team-booking', slug: teamBookingMatch[1] };
  }
  const bookingMatch = path.match(/^\/book\/([^/]+)$/);
  if (bookingMatch) {
    return { type: 'public-booking', slug: bookingMatch[1] };
  }
  return { type: 'app' };
}

type RouteState =
  | { type: 'app'; authMode?: 'login' | 'register' }
  | { type: 'public-booking'; slug: string }
  | { type: 'team-booking'; slug: string }
  | { type: 'manage-booking'; token: string }
  | { type: 'reset-password'; token: string }
  | { type: 'forgot-password' };

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Router />);
}
