/**
 * Tour Service - Interactive Tooltip Tour System
 * 
 * Provides a guided tour for first-time users with
 * highlight targets, step-by-step guidance, and progress tracking.
 */

export interface TourStep {
  id: string;
  target: string; // CSS selector for the element to highlight
  title: string;
  titleAr: string; // Arabic translation
  content: string;
  contentAr: string; // Arabic translation
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  spotlightPadding?: number; // Extra padding around spotlight
  action?: 'click' | 'hover' | 'none'; // What the user should do
  actionLabel?: string;
  actionLabelAr?: string;
  requiredView?: string; // View that must be active for this step
  onEnter?: () => void; // Callback when entering this step
  onExit?: () => void; // Callback when exiting this step
}

export interface TourDefinition {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  steps: TourStep[];
  version: number; // Increment to force re-show after updates
}

// ============================================
// TOUR DEFINITIONS
// ============================================

export const tours: Record<string, TourDefinition> = {
  // First-time user tour
  welcome: {
    id: 'welcome',
    name: 'Welcome Tour',
    nameAr: 'جولة الترحيب',
    description: 'Learn the basics of Cadence',
    descriptionAr: 'تعلم أساسيات ريجنت',
    version: 3,
    steps: [
      {
        id: 'welcome-start',
        target: 'body',
        title: 'Welcome to Cadence!',
        titleAr: 'مرحباً بك في ريجنت!',
        content: 'Let\'s take a quick tour to help you get started with scheduling.',
        contentAr: 'لنأخذ جولة سريعة لمساعدتك على البدء في الجدولة.',
        position: 'center',
        action: 'none'
      },
      {
        id: 'nav-dashboard',
        target: '[data-tour="dashboard"]',
        title: 'Dashboard',
        titleAr: 'لوحة التحكم',
        content: 'Your command center. See upcoming meetings, pending requests, and quick actions.',
        contentAr: 'مركز قيادتك. اطلع على الاجتماعات القادمة والطلبات المعلقة والإجراءات السريعة.',
        position: 'bottom',
        action: 'click',
        actionLabel: 'Click to explore',
        actionLabelAr: 'انقر للاستكشاف',
        requiredView: 'dashboard'
      },
      {
        id: 'quick-book',
        target: '[data-tour="quick-book"]',
        title: 'Quick Book',
        titleAr: 'حجز سريع',
        content: 'Start scheduling a new meeting with one click.',
        contentAr: 'ابدأ جدولة اجتماع جديد بنقرة واحدة.',
        position: 'bottom',
        action: 'click',
        actionLabel: 'Try it',
        actionLabelAr: 'جربه'
      },
      {
        id: 'nav-scheduler',
        target: '[data-tour="scheduler"]',
        title: 'Scheduler',
        titleAr: 'الجدول',
        content: 'Browse team calendars and book meetings with specific hosts.',
        contentAr: 'تصفح تقويمات الفريق واحجز اجتماعات مع مضيفين محددين.',
        position: 'bottom',
        action: 'click',
        actionLabel: 'Go to Scheduler',
        actionLabelAr: 'انتقل إلى الجدول',
        requiredView: 'scheduler'
      },
      {
        id: 'host-selector',
        target: '[data-tour="host-grid"]',
        title: 'Select a Host',
        titleAr: 'اختر مضيفاً',
        content: 'Choose the person you want to meet with. Your recent hosts appear first.',
        contentAr: 'اختر الشخص الذي تريد الاجتماع معه. يظهر المضيفون الأخيرون أولاً.',
        position: 'top',
        action: 'click',
        actionLabel: 'Select someone',
        actionLabelAr: 'اختر شخصاً'
      },
      {
        id: 'calendar-grid',
        target: '[data-tour="calendar"]',
        title: 'Pick a Date',
        titleAr: 'اختر تاريخاً',
        content: 'Select a date from the calendar. Dots indicate days with existing meetings.',
        contentAr: 'اختر تاريخاً من التقويم. تشير النقاط إلى الأيام التي بها اجتماعات.',
        position: 'right',
        action: 'click',
        actionLabel: 'Select a date',
        actionLabelAr: 'اختر تاريخاً'
      },
      {
        id: 'time-slots',
        target: '[data-tour="time-slots"]',
        title: 'Choose a Time',
        titleAr: 'اختر وقتاً',
        content: 'Available time slots are shown in white. Click one to select it.',
        contentAr: 'الفترات الزمنية المتاحة تظهر باللون الأبيض. انقر على واحدة لاختيارها.',
        position: 'left',
        action: 'click',
        actionLabel: 'Pick a time',
        actionLabelAr: 'اختر وقتاً'
      },
      {
        id: 'duration-selector',
        target: '[data-tour="duration"]',
        title: 'Meeting Duration',
        titleAr: 'مدة الاجتماع',
        content: 'Choose how long your meeting will be: 15, 30, 45, or 60 minutes.',
        contentAr: 'اختر مدة اجتماعك: 15، 30، 45، أو 60 دقيقة.',
        position: 'bottom',
        action: 'click',
        actionLabel: 'Select duration',
        actionLabelAr: 'اختر المدة'
      },
      {
        id: 'nav-appointments',
        target: '[data-tour="appointments"]',
        title: 'My Appointments',
        titleAr: 'مواعيدي',
        content: 'View and manage all your meetings. Approve, reject, or reschedule.',
        contentAr: 'اطلع على جميع اجتماعاتك وقم بإدارتها. وافق أو ارفض أو أعد الجدولة.',
        position: 'bottom',
        action: 'click',
        actionLabel: 'View appointments',
        actionLabelAr: 'عرض المواعيد',
        requiredView: 'my-meetings'
      },
      {
        id: 'notifications',
        target: '[data-tour="notifications"]',
        title: 'Notifications',
        titleAr: 'الإشعارات',
        content: 'Meeting requests and updates appear here. A red dot means action needed.',
        contentAr: 'طلبات الاجتماعات والتحديثات تظهر هنا. النقطة الحمراء تعني أن هناك إجراء مطلوب.',
        position: 'bottom',
        action: 'hover',
        actionLabel: 'Hover to see',
        actionLabelAr: 'مرر للرؤية'
      },
      {
        id: 'share-link',
        target: '[data-tour="share-link"]',
        title: 'Share Your Booking Page',
        titleAr: 'شارك صفحة الحجز',
        content: 'Share your booking link so others can schedule meetings with you. Like Calendly!',
        contentAr: 'شارك رابط الحجز الخاص بك حتى يتمكن الآخرون من جدولة اجتماعات معك. مثل Calendly!',
        position: 'bottom',
        action: 'click',
        actionLabel: 'Copy your link',
        actionLabelAr: 'انسخ رابطك',
        spotlightPadding: 8
      },
      {
        id: 'profile',
        target: '[data-tour="profile"]',
        title: 'Your Profile',
        titleAr: 'ملفك الشخصي',
        content: 'Set your availability, working hours, and preferences here.',
        contentAr: 'حدد توافرك وساعات عملك وتفضيلاتك هنا.',
        position: 'bottom',
        action: 'click',
        actionLabel: 'Open settings',
        actionLabelAr: 'افتح الإعدادات'
      },
      {
        id: 'booking-links',
        target: '[data-tour="booking-links"]',
        title: 'Booking Links',
        titleAr: 'روابط الحجز',
        content: 'Create shareable links like Calendly! Let anyone book time with you without logging in.',
        contentAr: 'أنشئ روابط قابلة للمشاركة مثل Calendly! اسمح لأي شخص بحجز موعد معك دون تسجيل الدخول.',
        position: 'bottom',
        action: 'click',
        actionLabel: 'Create a link',
        actionLabelAr: 'أنشئ رابطاً',
        spotlightPadding: 10
      },
      {
        id: 'achievements',
        target: '[data-tour="achievements"]',
        title: 'Achievements & Gamification',
        titleAr: 'الإنجازات واللعب',
        content: 'Earn achievements by using Cadence! Track your progress, unlock badges, and level up.',
        contentAr: 'اربح إنجازات باستخدام ريجنت! تتبع تقدمك، افتح الشارات، وارتقِ بمستواك.',
        position: 'bottom',
        action: 'click',
        actionLabel: 'View achievements',
        actionLabelAr: 'عرض الإنجازات'
      },
      {
        id: 'keyboard-shortcuts',
        target: 'body',
        title: 'Pro Tip: Keyboard Shortcuts',
        titleAr: 'نصيحة: اختصارات لوحة المفاتيح',
        content: 'Press ? to see all keyboard shortcuts. Use / to open the command palette.',
        contentAr: 'اضغط ؟ لرؤية جميع اختصارات لوحة المفاتيح. استخدم / لفتح لوحة الأوامر.',
        position: 'center',
        action: 'none'
      },
      {
        id: 'tour-complete',
        target: 'body',
        title: 'You\'re Ready!',
        titleAr: 'أنت جاهز!',
        content: 'That\'s the basics! Start by booking your first meeting. You can restart this tour anytime from Settings.',
        contentAr: 'هذه هي الأساسيات! ابدأ بحجز أول اجتماع لك. يمكنك إعادة تشغيل هذه الجولة في أي وقت من الإعدادات.',
        position: 'center',
        action: 'none'
      }
    ]
  },
  
  // Quick shortcuts tour
  shortcuts: {
    id: 'shortcuts',
    name: 'Keyboard Shortcuts Tour',
    nameAr: 'جولة اختصارات لوحة المفاتيح',
    description: 'Master the keyboard for faster navigation',
    descriptionAr: 'أتقن لوحة المفاتيح للتنقل بشكل أسرع',
    version: 1,
    steps: [
      {
        id: 'shortcuts-intro',
        target: 'body',
        title: 'Keyboard Power User',
        titleAr: 'مستخدم لوحة المفاتيح المحترف',
        content: 'Learn shortcuts to navigate faster without touching your mouse.',
        contentAr: 'تعلم الاختصارات للتنقل بشكل أسرع دون لمس الماوس.',
        position: 'center',
        action: 'none'
      },
      {
        id: 'command-palette',
        target: 'body',
        title: 'Command Palette',
        titleAr: 'لوحة الأوامر',
        content: 'Press / (slash) to open the command palette. Search for any action.',
        contentAr: 'اضغط / (شرطة مائلة) لفتح لوحة الأوامر. ابحث عن أي إجراء.',
        position: 'center',
        action: 'none'
      },
      {
        id: 'navigation-keys',
        target: 'body',
        title: 'Navigation',
        titleAr: 'التنقل',
        content: 'Use g+d for Dashboard, g+s for Scheduler, g+a for Appointments.',
        contentAr: 'استخدم g+d للوحة التحكم، g+s للجدول، g+a للمواعيد.',
        position: 'center',
        action: 'none'
      },
      {
        id: 'list-navigation',
        target: 'body',
        title: 'List Navigation',
        titleAr: 'التنقل في القائمة',
        content: 'In meeting lists: j/k to move up/down, a to approve, x to reject.',
        contentAr: 'في قوائم الاجتماعات: j/k للتحرك لأعلى/لأسفل، a للموافقة، x للرفض.',
        position: 'center',
        action: 'none'
      }
    ]
  },
  
  // Booking Links tour
  bookingLinks: {
    id: 'bookingLinks',
    name: 'Booking Links Tour',
    nameAr: 'جولة روابط الحجز',
    description: 'Learn how to create shareable booking links',
    descriptionAr: 'تعلم كيفية إنشاء روابط حجز قابلة للمشاركة',
    version: 1,
    steps: [
      {
        id: 'bl-intro',
        target: 'body',
        title: 'Shareable Booking Links',
        titleAr: 'روابط الحجز القابلة للمشاركة',
        content: 'Create links that let anyone book time with you - no login required! Just like Calendly.',
        contentAr: 'أنشئ روابط تتيح لأي شخص حجز موعد معك - دون الحاجة لتسجيل الدخول! مثل Calendly.',
        position: 'center',
        action: 'none'
      },
      {
        id: 'bl-create',
        target: '[data-tour="booking-links"]',
        title: 'Create a Booking Link',
        titleAr: 'إنشاء رابط حجز',
        content: 'Click here to create your first booking link. You can customize the title, durations, and more.',
        contentAr: 'انقر هنا لإنشاء أول رابط حجز. يمكنك تخصيص العنوان والمدد والمزيد.',
        position: 'bottom',
        action: 'click',
        actionLabel: 'Open Booking Links',
        actionLabelAr: 'افتح روابط الحجز'
      },
      {
        id: 'bl-share',
        target: 'body',
        title: 'Share Your Link',
        titleAr: 'شارك رابطك',
        content: 'Once created, copy your link and share it via email, social media, or anywhere! Guests can book without creating an account.',
        contentAr: 'بمجرد إنشائه، انسخ رابطك وشاركه عبر البريد الإلكتروني أو وسائل التواصل الاجتماعي أو في أي مكان! يمكن للضيوف الحجز دون إنشاء حساب.',
        position: 'center',
        action: 'none'
      },
      {
        id: 'bl-approval',
        target: 'body',
        title: 'Approve or Auto-Confirm',
        titleAr: 'الموافقة أو التأكيد التلقائي',
        content: 'Bookings from guests show as "pending" until you approve them. You can manage all requests from your dashboard.',
        contentAr: 'تظهر الحجوزات من الضيوف كـ "معلقة" حتى توافق عليها. يمكنك إدارة جميع الطلبات من لوحة التحكم.',
        position: 'center',
        action: 'none'
      }
    ]
  },

  // Admin features tour
  admin: {
    id: 'admin',
    name: 'Admin Features Tour',
    nameAr: 'جولة ميزات المدير',
    description: 'Learn admin-specific features',
    descriptionAr: 'تعلم ميزات المدير',
    version: 1,
    steps: [
      {
        id: 'admin-intro',
        target: 'body',
        title: 'Admin Features',
        titleAr: 'ميزات المدير',
        content: 'As an admin, you have access to team management and system logs.',
        contentAr: 'كمدير، لديك حق الوصول إلى إدارة الفريق وسجلات النظام.',
        position: 'center',
        action: 'none'
      },
      {
        id: 'team-management',
        target: '[data-tour="team-management"]',
        title: 'Team Management',
        titleAr: 'إدارة الفريق',
        content: 'Add users, create teams, and manage permissions.',
        contentAr: 'أضف مستخدمين، أنشئ فرقاً، وأدر الصلاحيات.',
        position: 'bottom',
        action: 'click',
        requiredView: 'team-management'
      },
      {
        id: 'logs',
        target: '[data-tour="logs"]',
        title: 'System Logs',
        titleAr: 'سجلات النظام',
        content: 'View all system activity: logins, bookings, cancellations, and more.',
        contentAr: 'اطلع على جميع أنشطة النظام: تسجيلات الدخول، الحجوزات، الإلغاءات، والمزيد.',
        position: 'bottom',
        action: 'click',
        requiredView: 'logs'
      }
    ]
  }
};

// ============================================
// TOUR STATE MANAGEMENT
// ============================================

interface TourState {
  completedTours: Record<string, number>; // tourId -> completed version
  currentTour: string | null;
  currentStep: number;
  dismissed: boolean;
}

const STORAGE_KEY = 'al_adaam_tour_state';

class TourService {
  private state: TourState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): TourState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {
        completedTours: {},
        currentTour: null,
        currentStep: 0,
        dismissed: false
      };
    } catch {
      return {
        completedTours: {},
        currentTour: null,
        currentStep: 0,
        dismissed: false
      };
    }
  }

  private saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(fn => fn());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Check if a tour should be shown (not completed or new version)
   */
  shouldShowTour(tourId: string): boolean {
    const tour = tours[tourId];
    if (!tour) return false;
    
    const completedVersion = this.state.completedTours[tourId] || 0;
    return completedVersion < tour.version && !this.state.dismissed;
  }

  /**
   * Start a tour
   */
  startTour(tourId: string) {
    const tour = tours[tourId];
    if (!tour) return;

    this.state.currentTour = tourId;
    this.state.currentStep = 0;
    this.state.dismissed = false;
    this.saveState();
  }

  /**
   * Move to next step
   */
  nextStep(): boolean {
    if (!this.state.currentTour) return false;
    
    const tour = tours[this.state.currentTour];
    if (!tour) return false;

    // Call onExit for current step
    const currentStep = tour.steps[this.state.currentStep];
    if (currentStep?.onExit) {
      currentStep.onExit();
    }

    if (this.state.currentStep < tour.steps.length - 1) {
      this.state.currentStep++;
      
      // Call onEnter for new step
      const newStep = tour.steps[this.state.currentStep];
      if (newStep?.onEnter) {
        newStep.onEnter();
      }
      
      this.saveState();
      return true;
    } else {
      // Tour complete
      this.completeTour();
      return false;
    }
  }

  /**
   * Move to previous step
   */
  prevStep(): boolean {
    if (!this.state.currentTour) return false;
    
    const tour = tours[this.state.currentTour];
    if (!tour) return false;

    // Call onExit for current step
    const currentStep = tour.steps[this.state.currentStep];
    if (currentStep?.onExit) {
      currentStep.onExit();
    }

    if (this.state.currentStep > 0) {
      this.state.currentStep--;
      
      // Call onEnter for new step
      const newStep = tour.steps[this.state.currentStep];
      if (newStep?.onEnter) {
        newStep.onEnter();
      }
      
      this.saveState();
      return true;
    }
    return false;
  }

  /**
   * Go to a specific step
   */
  goToStep(stepIndex: number) {
    if (!this.state.currentTour) return;
    
    const tour = tours[this.state.currentTour];
    if (!tour || stepIndex < 0 || stepIndex >= tour.steps.length) return;

    this.state.currentStep = stepIndex;
    this.saveState();
  }

  /**
   * Complete the current tour
   */
  completeTour() {
    if (!this.state.currentTour) return;
    
    const tour = tours[this.state.currentTour];
    if (tour) {
      this.state.completedTours[this.state.currentTour] = tour.version;
    }
    
    this.state.currentTour = null;
    this.state.currentStep = 0;
    this.saveState();
  }

  /**
   * Dismiss tour (don't show again this session)
   */
  dismissTour() {
    this.state.currentTour = null;
    this.state.currentStep = 0;
    this.state.dismissed = true;
    this.saveState();
  }

  /**
   * Skip current tour without completing
   */
  skipTour() {
    this.state.currentTour = null;
    this.state.currentStep = 0;
    this.saveState();
  }

  /**
   * Reset a specific tour (for re-showing)
   */
  resetTour(tourId: string) {
    delete this.state.completedTours[tourId];
    this.state.dismissed = false;
    this.saveState();
  }

  /**
   * Reset all tours
   */
  resetAllTours() {
    this.state.completedTours = {};
    this.state.dismissed = false;
    this.saveState();
  }

  /**
   * Get current tour info
   */
  getCurrentTour(): TourDefinition | null {
    if (!this.state.currentTour) return null;
    return tours[this.state.currentTour] || null;
  }

  /**
   * Get current step info
   */
  getCurrentStep(): TourStep | null {
    const tour = this.getCurrentTour();
    if (!tour) return null;
    return tour.steps[this.state.currentStep] || null;
  }

  /**
   * Get current step index
   */
  getCurrentStepIndex(): number {
    return this.state.currentStep;
  }

  /**
   * Get total steps in current tour
   */
  getTotalSteps(): number {
    const tour = this.getCurrentTour();
    return tour ? tour.steps.length : 0;
  }

  /**
   * Check if a tour is active
   */
  isActive(): boolean {
    return this.state.currentTour !== null;
  }

  /**
   * Get all available tours
   */
  getAllTours(): TourDefinition[] {
    return Object.values(tours);
  }

  /**
   * Check if a tour has been completed
   */
  isTourCompleted(tourId: string): boolean {
    const tour = tours[tourId];
    if (!tour) return false;
    return (this.state.completedTours[tourId] || 0) >= tour.version;
  }
}

export const tourService = new TourService();

