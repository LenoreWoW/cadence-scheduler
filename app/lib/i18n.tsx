import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Language } from '../../types';
import { languageService } from '../../services/languageService';

// ── Dictionary ────────────────────────────────────────────────────────────
// Every user-facing string in the new app. Keys are namespaced by surface.
// `en` is the source of truth; `ar` mirrors it (Qatar GBA → Arabic is first-class).
const EN = {
  // Navigation / shell
  'nav.home': 'Home',
  'nav.requests': 'Requests',
  'nav.schedule': 'Schedule',
  'nav.book': 'Book',
  'nav.profile': 'Profile',
  'a11y.openMenu': 'Open menu',
  'a11y.closeMenu': 'Close menu',
  'a11y.switchLanguage': 'Switch language',
  'a11y.primaryNav': 'Primary',

  // Common
  'common.signOut': 'Sign out',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.approve': 'Approve',
  'common.reject': 'Reject',
  'common.add': 'Add',
  'common.remove': 'Remove',
  'common.loading': 'Loading…',
  'common.connErr': 'Check your connection and try again.',
  'account.lightMode': 'Light mode',

  // Roles
  'role.admin': 'Administrator',
  'role.manager': 'Manager',
  'role.subordinate': 'Team member',
  'role.guest': 'Guest',

  // Statuses
  'status.pending': 'Pending',
  'status.approved': 'Approved',
  'status.rejected': 'Rejected',
  'status.cancelled': 'Cancelled',

  // Dates / units
  'date.today': 'Today',
  'date.tomorrow': 'Tomorrow',
  'date.yesterday': 'Yesterday',
  'unit.min': 'min',
  'unit.meeting': 'meeting',
  'unit.meetings': 'meetings',
  'meeting.with': 'with {name}',

  // Login
  'login.heroTitle1': 'Scheduling,',
  'login.heroTitle2': 'handled.',
  'login.heroSubtitle': 'Request, approve, and manage meetings for your office — one shared schedule.',
  'login.brand': 'Qatar GBA · Cadence',
  'login.title': 'Sign in',
  'login.portalNote': 'You normally arrive authenticated from the portal.',
  'login.devNote': ' For now, choose a role to continue:',
  'login.continuePortal': 'Continue to the portal',
  'login.failed': 'Sign-in failed',
  'login.roleAdmin': 'Admin',
  'login.roleManager': 'Manager',
  'login.roleSub': 'Subordinate',
  'login.roleGuest': 'Guest',

  // Home
  'home.greetingApprover1': 'Good day, {name}.',
  'home.greetingApprover2': 'Your schedule, under control.',
  'home.greetingGuest': 'Book time with the team, {name}.',
  'home.requestMeeting': 'Request a meeting',
  'home.reviewRequests': 'Review requests',
  'home.errTitle': "Couldn't load your dashboard",
  'home.statPending': 'Pending',
  'home.statUpcoming': 'Upcoming',
  'home.statTotal': 'Total',
  'home.upcoming': 'Upcoming',
  'home.viewSchedule': 'View schedule',
  'home.nothingScheduled': 'Nothing scheduled yet.',
  'home.quickActions': 'Quick actions',
  'home.qaBookDesc': 'Find a host and request a time',
  'home.qaReviewDesc': 'Approve or decline pending requests',
  'home.qaScheduleDesc': 'See everything on your calendar',
  'home.qaDelegatesDesc': 'Let assistants book on your behalf',
  'home.manageDelegates': 'Manage delegates',
  'home.awaitingTitle': 'Awaiting your review',
  'home.awaitingEmpty': "You're all caught up — nothing to review.",
  'home.reviewAll': 'Review all',
  'home.howTitle': 'How booking works',
  'home.step1': 'Pick a host and a time that suits you',
  'home.step2': 'Send your request in one tap',
  'home.step3': 'Get confirmed — it lands on your schedule',

  // Book
  'book.badge': 'Request a meeting',
  'book.heroTitle': 'Book time with the team.',
  'book.heroSubtitle': "Pick a host and a time that works — they'll confirm your request.",
  'book.errLoadHosts': "Couldn't load hosts",
  'book.noHostsTitle': 'No hosts available',
  'book.noHostsBody': "There's no one to book with right now. Check back once your team has set up their availability.",
  'book.sentTitle': 'Request sent',
  'book.sentBody': "The host will approve it. You'll see it on your schedule once it's confirmed.",
  'book.bookAnother': 'Book another',
  'book.host': 'Host',
  'book.selectHost': 'Select a host…',
  'book.forOther': 'Booking for someone else?',
  'book.theirName': 'Their name',
  'book.theirEmail': 'Their email',
  'book.attendeeName': 'Attendee name',
  'book.attendeeEmail': 'Attendee email',
  'book.requestingAs': 'Requesting as {name}.',
  'book.date': 'Date',
  'book.time': 'Time',
  'book.selectHostForTimes': 'Select a host to see available times.',
  'book.noOpenTimes': 'This host has no open times. Try a different host.',
  'book.title': 'Title',
  'book.titlePlaceholder': "What's this meeting about?",
  'book.format': 'Format',
  'book.inPerson': 'In-person',
  'book.online': 'Online',
  'book.locationType': 'Location type',
  'book.internal': 'Internal',
  'book.external': 'External',
  'book.localityHint': 'Internal = within the building · External = outside.',
  'book.moreOptions': 'More options',
  'book.hideOptions': 'Hide options',
  'book.notes': 'Notes',
  'book.notesPlaceholder': 'Anything the host should know (optional)',
  'book.requestingAsFooter': 'Requesting as {name}',
  'book.sending': 'Sending…',
  'book.sendRequest': 'Send request',
  'book.errSubmit': 'Could not send your request. Please try again.',
  'book.you': 'you',

  // Requests
  'requests.title': 'Requests',
  'requests.eyebrow': 'Approvals',
  'requests.confirmReject': 'Reject this request? The requester will be declined.',
  'requests.approvedNotice': 'Request approved — moved to the schedule.',
  'requests.rejectedNotice': 'Request rejected.',
  'requests.errUpdate': 'Could not update the request. Please try again.',
  'requests.errLoad': "Couldn't load requests",
  'requests.allCaught': 'All caught up',
  'requests.noWaiting': 'No requests waiting on your review.',
  'requests.approving': 'Approving…',
  'requests.rejecting': 'Rejecting…',

  // Schedule
  'schedule.title': 'Schedule',
  'schedule.eyebrow': 'Your calendar',
  'schedule.subtitle': 'Your agenda, grouped by day.',
  'schedule.viewAgenda': 'Agenda',
  'schedule.viewMonth': 'Month',
  'schedule.showCancelled': 'Show cancelled & rejected',
  'schedule.hideCancelled': 'Hide cancelled & rejected',
  'schedule.errLoad': "Couldn't load your schedule",
  'schedule.emptyTitle': 'Nothing on the calendar',
  'schedule.emptyAllHidden': 'Every meeting here is cancelled or rejected. Toggle them on to take a look.',
  'schedule.emptyNone': 'When meetings are scheduled, they will show up here grouped by day.',

  // Calendar (month view)
  'cal.dowSun': 'Sun',
  'cal.dowMon': 'Mon',
  'cal.dowTue': 'Tue',
  'cal.dowWed': 'Wed',
  'cal.dowThu': 'Thu',
  'cal.dowFri': 'Fri',
  'cal.dowSat': 'Sat',
  'cal.prevMonth': 'Previous month',
  'cal.nextMonth': 'Next month',
  'cal.more': '+{n} more',

  // Meeting detail
  'detail.aria': 'Meeting: {title}',
  'detail.host': 'Host',
  'detail.attendee': 'Attendee',
  'detail.format': 'Format',
  'detail.onBehalf': 'On behalf',
  'detail.onBehalfValue': "Tentative — awaiting the host's confirmation",
  'detail.notes': 'Notes',
  'detail.reschedule': 'Reschedule',
  'detail.newDate': 'New date',
  'detail.newTime': 'New time',
  'detail.saving': 'Saving…',
  'detail.saveNewTime': 'Save new time',
  'detail.cancelMeeting': 'Cancel meeting',
  'detail.confirmReject': 'Reject this request?',
  'detail.confirmCancel': 'Cancel this meeting?',
  'detail.errAction': 'Action failed. Please try again.',

  // Profile
  'profile.title': 'Profile',
  'profile.subtitle': 'Manage your account and preferences.',
  'profile.notSignedIn': "You're not signed in",
  'profile.notSignedInBody': 'Sign in to view and manage your profile.',
  'profile.email': 'Email',
  'profile.preferences': 'Preferences',
  'profile.darkMode': 'Dark mode',
  'profile.darkModeDesc': 'Switch between light and dark appearance.',
  'a11y.toggleDark': 'Toggle dark mode',
  'profile.language': 'Language',
  'profile.languageDesc': 'Choose your preferred language.',
  'profile.account': 'Account',
  'profile.accountDesc': 'Sign out of your current session.',
  'profile.signingOut': 'Signing out…',
  'profile.signOutErr': 'Sign out failed — please try again.',

  // Delegates
  'delegates.title': 'Delegates',
  'delegates.subtitle': 'People who may manage your calendar and book on your behalf.',
  'delegates.errLoad': "Couldn't load delegates.",
  'delegates.none': 'No delegates yet.',
  'delegates.addPlaceholder': 'Add someone…',
  'delegates.add': 'Add a delegate',
  'delegates.adding': 'Adding…',
  'delegates.errAdd': 'Could not add delegate.',
  'delegates.errRemove': 'Could not remove delegate.',
  'delegates.iManage': 'Calendars you manage',
} as const;

export type StringKey = keyof typeof EN;

const AR: Record<StringKey, string> = {
  // Navigation / shell
  'nav.home': 'الرئيسية',
  'nav.requests': 'الطلبات',
  'nav.schedule': 'الجدول',
  'nav.book': 'حجز',
  'nav.profile': 'الملف الشخصي',
  'a11y.openMenu': 'فتح القائمة',
  'a11y.closeMenu': 'إغلاق القائمة',
  'a11y.switchLanguage': 'تبديل اللغة',
  'a11y.primaryNav': 'التنقل الرئيسي',

  // Common
  'common.signOut': 'تسجيل الخروج',
  'common.cancel': 'إلغاء',
  'common.close': 'إغلاق',
  'common.approve': 'موافقة',
  'common.reject': 'رفض',
  'common.add': 'إضافة',
  'common.remove': 'إزالة',
  'common.loading': 'جارٍ التحميل…',
  'common.connErr': 'تحقق من اتصالك وحاول مرة أخرى.',
  'account.lightMode': 'الوضع الفاتح',

  // Roles
  'role.admin': 'مدير النظام',
  'role.manager': 'مدير',
  'role.subordinate': 'عضو الفريق',
  'role.guest': 'ضيف',

  // Statuses
  'status.pending': 'قيد الانتظار',
  'status.approved': 'مقبول',
  'status.rejected': 'مرفوض',
  'status.cancelled': 'ملغى',

  // Dates / units
  'date.today': 'اليوم',
  'date.tomorrow': 'غدًا',
  'date.yesterday': 'أمس',
  'unit.min': 'دقيقة',
  'unit.meeting': 'موعد',
  'unit.meetings': 'مواعيد',
  'meeting.with': 'مع {name}',

  // Login
  'login.heroTitle1': 'إدارة المواعيد',
  'login.heroTitle2': 'بكل سهولة.',
  'login.heroSubtitle': 'اطلب المواعيد ووافق عليها وأدِرها لمكتبك — جدول واحد مشترك.',
  'login.brand': 'هيئة قطر للألعاب · Cadence',
  'login.title': 'تسجيل الدخول',
  'login.portalNote': 'تصل عادةً مُوثَّقًا من البوابة.',
  'login.devNote': ' مؤقتًا، اختر دورًا للمتابعة:',
  'login.continuePortal': 'المتابعة إلى البوابة',
  'login.failed': 'فشل تسجيل الدخول',
  'login.roleAdmin': 'مدير النظام',
  'login.roleManager': 'مدير',
  'login.roleSub': 'موظف',
  'login.roleGuest': 'ضيف',

  // Home
  'home.greetingApprover1': 'طاب يومك، {name}.',
  'home.greetingApprover2': 'جدولك تحت السيطرة.',
  'home.greetingGuest': 'احجز وقتًا مع الفريق، {name}.',
  'home.requestMeeting': 'اطلب موعدًا',
  'home.reviewRequests': 'مراجعة الطلبات',
  'home.errTitle': 'تعذّر تحميل لوحة التحكم',
  'home.statPending': 'قيد الانتظار',
  'home.statUpcoming': 'القادمة',
  'home.statTotal': 'الإجمالي',
  'home.upcoming': 'المواعيد القادمة',
  'home.viewSchedule': 'عرض الجدول',
  'home.nothingScheduled': 'لا توجد مواعيد بعد.',
  'home.quickActions': 'إجراءات سريعة',
  'home.qaBookDesc': 'اختر مضيفًا واطلب وقتًا',
  'home.qaReviewDesc': 'وافق على الطلبات المعلّقة أو ارفضها',
  'home.qaScheduleDesc': 'اطّلع على كل ما في تقويمك',
  'home.qaDelegatesDesc': 'اسمح للمساعدين بالحجز نيابةً عنك',
  'home.manageDelegates': 'إدارة المفوَّضين',
  'home.awaitingTitle': 'بانتظار مراجعتك',
  'home.awaitingEmpty': 'لا جديد لمراجعته — كل شيء مُحدَّث.',
  'home.reviewAll': 'مراجعة الكل',
  'home.howTitle': 'كيف تعمل المواعيد',
  'home.step1': 'اختر مضيفًا ووقتًا يناسبك',
  'home.step2': 'أرسل طلبك بنقرة واحدة',
  'home.step3': 'احصل على التأكيد — يظهر في جدولك',

  // Book
  'book.badge': 'طلب موعد',
  'book.heroTitle': 'احجز وقتًا مع الفريق.',
  'book.heroSubtitle': 'اختر مُضيفًا ووقتًا مناسبًا — سيؤكدون طلبك.',
  'book.errLoadHosts': 'تعذّر تحميل المضيفين',
  'book.noHostsTitle': 'لا يوجد مضيفون متاحون',
  'book.noHostsBody': 'لا يوجد أحد للحجز معه الآن. عُد بعد أن يحدد فريقك أوقات توفّره.',
  'book.sentTitle': 'تم إرسال الطلب',
  'book.sentBody': 'سيوافق عليه المضيف. سيظهر في جدولك بمجرد تأكيده.',
  'book.bookAnother': 'احجز موعدًا آخر',
  'book.host': 'المضيف',
  'book.selectHost': 'اختر مضيفًا…',
  'book.forOther': 'هل تحجز لشخص آخر؟',
  'book.theirName': 'اسمه',
  'book.theirEmail': 'بريده الإلكتروني',
  'book.attendeeName': 'اسم الحاضر',
  'book.attendeeEmail': 'بريد الحاضر',
  'book.requestingAs': 'تطلب باسم {name}.',
  'book.date': 'التاريخ',
  'book.time': 'الوقت',
  'book.selectHostForTimes': 'اختر مضيفًا لعرض الأوقات المتاحة.',
  'book.noOpenTimes': 'لا تتوفر أوقات لهذا المضيف. جرّب مضيفًا آخر.',
  'book.title': 'العنوان',
  'book.titlePlaceholder': 'ما موضوع هذا الموعد؟',
  'book.format': 'الصيغة',
  'book.inPerson': 'حضوري',
  'book.online': 'عن بُعد',
  'book.locationType': 'نوع الموقع',
  'book.internal': 'داخلي',
  'book.external': 'خارجي',
  'book.localityHint': 'داخلي = داخل المبنى · خارجي = خارجه.',
  'book.moreOptions': 'خيارات أخرى',
  'book.hideOptions': 'إخفاء الخيارات',
  'book.notes': 'ملاحظات',
  'book.notesPlaceholder': 'أي شيء يجب أن يعرفه المضيف (اختياري)',
  'book.requestingAsFooter': 'تطلب باسم {name}',
  'book.sending': 'جارٍ الإرسال…',
  'book.sendRequest': 'إرسال الطلب',
  'book.errSubmit': 'تعذّر إرسال طلبك. حاول مرة أخرى.',
  'book.you': 'أنت',

  // Requests
  'requests.title': 'الطلبات',
  'requests.eyebrow': 'الموافقات',
  'requests.confirmReject': 'رفض هذا الطلب؟ سيُرفض مُقدّم الطلب.',
  'requests.approvedNotice': 'تمت الموافقة على الطلب — نُقل إلى الجدول.',
  'requests.rejectedNotice': 'تم رفض الطلب.',
  'requests.errUpdate': 'تعذّر تحديث الطلب. حاول مرة أخرى.',
  'requests.errLoad': 'تعذّر تحميل الطلبات',
  'requests.allCaught': 'كل شيء مُحدَّث',
  'requests.noWaiting': 'لا توجد طلبات تنتظر مراجعتك.',
  'requests.approving': 'جارٍ الموافقة…',
  'requests.rejecting': 'جارٍ الرفض…',

  // Schedule
  'schedule.title': 'الجدول',
  'schedule.eyebrow': 'تقويمك',
  'schedule.subtitle': 'جدول أعمالك، مُرتَّبًا حسب اليوم.',
  'schedule.viewAgenda': 'قائمة',
  'schedule.viewMonth': 'شهر',
  'schedule.showCancelled': 'عرض الملغاة والمرفوضة',
  'schedule.hideCancelled': 'إخفاء الملغاة والمرفوضة',
  'schedule.errLoad': 'تعذّر تحميل جدولك',
  'schedule.emptyTitle': 'لا شيء في التقويم',
  'schedule.emptyAllHidden': 'كل المواعيد هنا ملغاة أو مرفوضة. فعّل عرضها لإلقاء نظرة.',
  'schedule.emptyNone': 'عند جدولة المواعيد، ستظهر هنا مُرتَّبة حسب اليوم.',

  // Calendar (month view)
  'cal.dowSun': 'أحد',
  'cal.dowMon': 'إثن',
  'cal.dowTue': 'ثلا',
  'cal.dowWed': 'أرب',
  'cal.dowThu': 'خمي',
  'cal.dowFri': 'جمع',
  'cal.dowSat': 'سبت',
  'cal.prevMonth': 'الشهر السابق',
  'cal.nextMonth': 'الشهر التالي',
  'cal.more': '+{n} أخرى',

  // Meeting detail
  'detail.aria': 'موعد: {title}',
  'detail.host': 'المضيف',
  'detail.attendee': 'الحاضر',
  'detail.format': 'الصيغة',
  'detail.onBehalf': 'بالنيابة',
  'detail.onBehalfValue': 'مبدئي — بانتظار تأكيد المضيف',
  'detail.notes': 'ملاحظات',
  'detail.reschedule': 'إعادة جدولة',
  'detail.newDate': 'تاريخ جديد',
  'detail.newTime': 'وقت جديد',
  'detail.saving': 'جارٍ الحفظ…',
  'detail.saveNewTime': 'حفظ الوقت الجديد',
  'detail.cancelMeeting': 'إلغاء الموعد',
  'detail.confirmReject': 'رفض هذا الطلب؟',
  'detail.confirmCancel': 'إلغاء هذا الموعد؟',
  'detail.errAction': 'فشل الإجراء. حاول مرة أخرى.',

  // Profile
  'profile.title': 'الملف الشخصي',
  'profile.subtitle': 'أدِر حسابك وتفضيلاتك.',
  'profile.notSignedIn': 'لم تسجّل الدخول',
  'profile.notSignedInBody': 'سجّل الدخول لعرض ملفك وإدارته.',
  'profile.email': 'البريد الإلكتروني',
  'profile.preferences': 'التفضيلات',
  'profile.darkMode': 'الوضع الداكن',
  'profile.darkModeDesc': 'بدّل بين المظهر الفاتح والداكن.',
  'a11y.toggleDark': 'تبديل الوضع الداكن',
  'profile.language': 'اللغة',
  'profile.languageDesc': 'اختر لغتك المفضلة.',
  'profile.account': 'الحساب',
  'profile.accountDesc': 'تسجيل الخروج من جلستك الحالية.',
  'profile.signingOut': 'جارٍ تسجيل الخروج…',
  'profile.signOutErr': 'فشل تسجيل الخروج — حاول مرة أخرى.',

  // Delegates
  'delegates.title': 'المفوَّضون',
  'delegates.subtitle': 'الأشخاص الذين يمكنهم إدارة تقويمك والحجز بالنيابة عنك.',
  'delegates.errLoad': 'تعذّر تحميل المفوَّضين.',
  'delegates.none': 'لا يوجد مفوَّضون بعد.',
  'delegates.addPlaceholder': 'أضف شخصًا…',
  'delegates.add': 'إضافة مفوَّض',
  'delegates.adding': 'جارٍ الإضافة…',
  'delegates.errAdd': 'تعذّر إضافة المفوَّض.',
  'delegates.errRemove': 'تعذّر إزالة المفوَّض.',
  'delegates.iManage': 'التقاويم التي تديرها',
};

const DICT: Record<Language, Record<StringKey, string>> = { en: EN, ar: AR };

// Replace {placeholders} with values from `vars`.
const interpolate = (template: string, vars?: Record<string, string | number>): string =>
  vars ? template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)) : template;

export type TFunction = (key: StringKey, vars?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Language;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
  locale: string;
  t: TFunction;
  setLang: (lang: Language) => void;
  toggle: () => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => languageService.getLanguage());

  useEffect(() => {
    const unsub = languageService.subscribe(setLangState);
    return () => { unsub(); };
  }, []);

  const t = useCallback<TFunction>(
    (key, vars) => interpolate(DICT[lang][key] ?? EN[key] ?? key, vars),
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      isRTL: lang === 'ar',
      locale: lang === 'ar' ? 'ar' : 'en-US',
      t,
      setLang: (l) => languageService.setLanguage(l),
      toggle: () => languageService.toggle(),
    }),
    [lang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};

// Role labels resolve through the dictionary too (never render the raw enum).
const ROLE_KEY: Record<string, StringKey> = {
  admin: 'role.admin',
  manager: 'role.manager',
  subordinate: 'role.subordinate',
  guest: 'role.guest',
};
export const roleLabelKey = (role?: string): StringKey | null => (role ? ROLE_KEY[role] ?? null : null);
