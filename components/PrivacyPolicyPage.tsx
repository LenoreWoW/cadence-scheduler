import React, { useState } from 'react';

/**
 * PrivacyPolicyPage
 *
 * Standalone bilingual privacy policy page. No app shell — designed to be
 * linked from email footers, the cookie banner, and the public booking pages.
 */
export const PrivacyPolicyPage: React.FC = () => {
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const isRTL = lang === 'ar';

  const content = {
    en: {
      title: 'Privacy Policy',
      updated: 'Last updated: April 12, 2026',
      intro:
        'Cadence ("we", "us", "our") respects your privacy. This Privacy Policy explains what information we collect when you use Cadence, how we use it, and the choices you have. By using Cadence you agree to the practices described here.',
      sections: [
        {
          h: '1. Information we collect',
          p: 'We collect (a) account information you provide — name, username, email, password (hashed), job title, avatar; (b) meeting data — meeting titles, dates, attendees, notes, attachments, and booking-link responses; (c) calendar integration tokens (Google, Microsoft) when you choose to connect a calendar; (d) usage data — IP address, browser type, pages viewed, and actions performed; and (e) communications — emails you send to support or feedback channels.',
        },
        {
          h: '2. How we use your information',
          p: 'We use your information to: provide the scheduling service; sync your calendar; send transactional emails (booking confirmations, reminders, password resets); detect fraud and abuse; comply with legal obligations; and improve our product through anonymized analytics. We do not sell personal data to third parties.',
        },
        {
          h: '3. Third-party services',
          p: 'Cadence integrates with: Google Calendar and Microsoft Calendar (for two-way calendar sync, under your explicit consent); Resend (for transactional email delivery); and analytics tooling (for anonymized usage stats). Each third party processes data under its own privacy policy.',
        },
        {
          h: '4. Data retention',
          p: 'Activity logs are retained for 12 months. Notification history is retained for 6 months. Meeting records are retained for the lifetime of your account; canceled meetings are kept for 90 days after cancellation. You can delete your account at any time — see "Your rights" below.',
        },
        {
          h: '5. Your rights',
          p: 'You may (a) export your personal data in JSON format from Settings → Security & Data; (b) correct inaccurate data by editing your profile; (c) delete your account, which permanently removes your data within 30 days; and (d) withdraw calendar integration consent at any time. Residents of the EU/UK have additional rights under GDPR; residents of California have rights under the CCPA.',
        },
        {
          h: '6. Security',
          p: 'We use industry-standard safeguards: TLS in transit, bcrypt for password storage, encrypted refresh tokens, role-based access controls, and audit logging of administrative actions. No system is perfectly secure; if we become aware of a breach we will notify affected users within 72 hours.',
        },
        {
          h: '7. Cookies',
          p: 'Cadence uses a small number of essential cookies for authentication and language preference. We do not use advertising cookies. You can revoke cookie consent at any time via your browser settings.',
        },
        {
          h: '8. Children',
          p: 'Cadence is not directed to children under 16. We do not knowingly collect personal data from children. If you believe a child has provided us data, contact us and we will delete it.',
        },
        {
          h: '9. Contact',
          p: 'Questions or requests about this Privacy Policy can be sent to privacy@cadence.app. We respond within 30 days.',
        },
      ],
    },
    ar: {
      title: 'سياسة الخصوصية',
      updated: 'آخر تحديث: 12 أبريل 2026',
      intro:
        'تحترم Cadence ("نحن") خصوصيتك. توضح سياسة الخصوصية هذه ما هي المعلومات التي نجمعها عند استخدامك Cadence، وكيف نستخدمها، والخيارات المتاحة لك. باستخدامك Cadence فإنك توافق على الممارسات الموضحة هنا.',
      sections: [
        {
          h: '1. المعلومات التي نجمعها',
          p: 'نجمع: (أ) معلومات الحساب التي تقدمها — الاسم، اسم المستخدم، البريد الإلكتروني، كلمة المرور (مشفّرة)، المسمى الوظيفي، الصورة الرمزية؛ (ب) بيانات الاجتماعات — العناوين، التواريخ، الحضور، الملاحظات، المرفقات، وردود نماذج الحجز؛ (ج) رموز التكامل مع التقويم (Google، Microsoft) عند ربط التقويم اختياريا؛ (د) بيانات الاستخدام — عنوان IP، نوع المتصفح، الصفحات المعروضة، والإجراءات التي تتم؛ و(هـ) المراسلات — الرسائل المرسلة لقنوات الدعم.',
        },
        {
          h: '2. كيف نستخدم معلوماتك',
          p: 'نستخدم معلوماتك من أجل: تقديم خدمة الجدولة؛ مزامنة التقويم؛ إرسال الرسائل التشغيلية (تأكيدات الحجز، التذكيرات، استعادة كلمة المرور)؛ كشف الاحتيال؛ الامتثال للالتزامات القانونية؛ وتحسين منتجنا عبر تحليلات مجهولة الهوية. لا نبيع البيانات الشخصية لأطراف ثالثة.',
        },
        {
          h: '3. خدمات الطرف الثالث',
          p: 'تتكامل Cadence مع: تقويم Google وتقويم Microsoft (للمزامنة الثنائية بعد موافقتك الصريحة)؛ Resend (لتسليم البريد التشغيلي)؛ وأدوات تحليل (لإحصاءات استخدام مجهولة الهوية). يعالج كل طرف ثالث البيانات بموجب سياسة الخصوصية الخاصة به.',
        },
        {
          h: '4. الاحتفاظ بالبيانات',
          p: 'سجلات النشاط تُحفظ لمدة 12 شهراً. سجل الإشعارات يُحفظ لمدة 6 أشهر. سجلات الاجتماعات تُحفظ طوال فترة حسابك؛ الاجتماعات الملغاة تُحفظ 90 يوماً بعد الإلغاء. يمكنك حذف حسابك في أي وقت — انظر "حقوقك" أدناه.',
        },
        {
          h: '5. حقوقك',
          p: 'يمكنك: (أ) تصدير بياناتك الشخصية بصيغة JSON من الإعدادات → الأمان والبيانات؛ (ب) تصحيح البيانات غير الدقيقة بتعديل ملفك الشخصي؛ (ج) حذف حسابك، مما يزيل بياناتك نهائياً خلال 30 يوماً؛ و(د) سحب موافقة تكامل التقويم في أي وقت. لسكان الاتحاد الأوروبي والمملكة المتحدة حقوق إضافية بموجب GDPR؛ ولسكان كاليفورنيا حقوق بموجب CCPA.',
        },
        {
          h: '6. الأمان',
          p: 'نستخدم ضمانات قياسية في الصناعة: TLS أثناء النقل، bcrypt لتخزين كلمات المرور، رموز تحديث مشفّرة، تحكم وصول قائم على الأدوار، وتسجيل تدقيق للإجراءات الإدارية. لا يوجد نظام آمن تماماً؛ إذا علمنا بحدوث اختراق فسنخطر المستخدمين المتأثرين خلال 72 ساعة.',
        },
        {
          h: '7. ملفات تعريف الارتباط',
          p: 'تستخدم Cadence عدداً صغيراً من ملفات تعريف الارتباط الأساسية للمصادقة وتفضيل اللغة. لا نستخدم ملفات تعريف ارتباط إعلانية. يمكنك إلغاء الموافقة في أي وقت عبر إعدادات متصفحك.',
        },
        {
          h: '8. الأطفال',
          p: 'Cadence ليست موجهة للأطفال دون 16 عاماً. لا نجمع عن قصد بيانات شخصية من الأطفال. إذا كنت تعتقد أن طفلاً قدم لنا بيانات، فاتصل بنا وسنقوم بحذفها.',
        },
        {
          h: '9. التواصل',
          p: 'يمكن إرسال الأسئلة أو الطلبات المتعلقة بسياسة الخصوصية إلى privacy@cadence.app. نرد خلال 30 يوماً.',
        },
      ],
    },
  };

  const c = content[lang];

  return (
    <div className="min-h-screen bg-white text-charcoal font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-[#8A1538] rounded-full flex items-center justify-center text-white font-serif font-bold italic shadow-lg shadow-[#8A1538]/20">
              R
            </div>
            <span className="font-display font-bold tracking-tight text-lg group-hover:text-[#8A1538] transition-colors">
              REGENT
            </span>
          </a>
          <button
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="text-xs font-bold border border-gray-200 px-4 py-2 rounded-full text-gray-600 hover:bg-[#8A1538] hover:text-white hover:border-[#8A1538] transition-colors uppercase tracking-wider"
            aria-label="Toggle language"
          >
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-display font-bold tracking-tight mb-2">{c.title}</h1>
        <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-10">{c.updated}</p>

        <p className="text-base text-gray-700 leading-relaxed mb-10">{c.intro}</p>

        <div className="space-y-8">
          {c.sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-lg font-bold text-charcoal mb-3">{s.h}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{s.p}</p>
            </section>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-gray-100 text-xs text-gray-400 font-mono">
          <a href="/terms" className="hover:text-[#8A1538] transition-colors">
            {lang === 'en' ? 'Terms of Service' : 'شروط الخدمة'}
          </a>
          <span className="mx-3">·</span>
          <a href="/" className="hover:text-[#8A1538] transition-colors">
            {lang === 'en' ? 'Back to app' : 'العودة للتطبيق'}
          </a>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicyPage;
