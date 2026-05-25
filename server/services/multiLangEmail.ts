/**
 * Multi-language email string lookup.
 *
 * Intentionally minimal — just enough keys to swap headers and primary lines
 * when a recipient has `preferred_language = 'ar'`. Param substitution uses
 * `{name}` placeholders.
 */

import { db } from '../database';

export type Lang = 'en' | 'ar';

type Dict = Record<string, string>;

const EN: Dict = {
  booking_received: 'Booking received',
  booking_received_body: "We've sent your request to {host}. You'll get another email when it's confirmed.",
  booking_approved: 'Meeting confirmed',
  booking_approved_body: '{host} confirmed your meeting.',
  booking_cancelled: 'Meeting cancelled',
  booking_cancelled_body: 'This meeting has been cancelled.',
  host_new_booking: 'New booking request',
  host_new_booking_body: '{attendee} requested a meeting.',
  reminder_24h: 'Reminder: your meeting is tomorrow',
  reminder_1h: 'Reminder: your meeting is in 1 hour',
  password_reset: 'Reset your password',
  team_invitation: "You're invited to join {team}",
};

const AR: Dict = {
  booking_received: 'تم استلام الحجز',
  booking_received_body: 'لقد أرسلنا طلبك إلى {host}. ستتلقى بريداً إلكترونياً آخر عند تأكيده.',
  booking_approved: 'تم تأكيد الاجتماع',
  booking_approved_body: 'أكد {host} اجتماعك.',
  booking_cancelled: 'تم إلغاء الاجتماع',
  booking_cancelled_body: 'تم إلغاء هذا الاجتماع.',
  host_new_booking: 'طلب حجز جديد',
  host_new_booking_body: 'طلب {attendee} عقد اجتماع.',
  reminder_24h: 'تذكير: اجتماعك غداً',
  reminder_1h: 'تذكير: اجتماعك بعد ساعة',
  password_reset: 'إعادة تعيين كلمة المرور',
  team_invitation: 'أنت مدعو للانضمام إلى {team}',
};

const DICTIONARIES: Record<Lang, Dict> = { en: EN, ar: AR };

/** Substitute `{name}` placeholders. */
function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{${key}}`;
  });
}

/** Look up a string for the given language; falls back to English. */
export function t(lang: Lang | string | null | undefined, key: string, params?: Record<string, string | number>): string {
  const normalized: Lang = lang === 'ar' ? 'ar' : 'en';
  const dict = DICTIONARIES[normalized];
  const value = dict[key] ?? EN[key] ?? key;
  return interpolate(value, params);
}

/**
 * Look up a user's preferred language by email. Returns 'en' if the
 * email isn't found or has no preference. Used by booking emails to
 * pick the right strings before rendering the HTML.
 */
export function getPreferredLanguageByEmail(email: string | null | undefined): Lang {
  if (!email) return 'en';
  try {
    const row = db.connection.prepare(
      `SELECT preferred_language FROM users WHERE lower(email) = lower(?)`
    ).get(email) as any;
    if (row && row.preferred_language === 'ar') return 'ar';
  } catch {}
  return 'en';
}

/** Direction hint for the HTML <body dir="..."> attribute. */
export function dirFor(lang: Lang | string | null | undefined): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}
