import React, { useState } from 'react';

/**
 * TermsOfServicePage
 *
 * Bilingual standalone Terms of Service page. Mirrors the layout used by
 * PrivacyPolicyPage so the two read as a pair.
 */
export const TermsOfServicePage: React.FC = () => {
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const isRTL = lang === 'ar';

  const content = {
    en: {
      title: 'Terms of Service',
      updated: 'Last updated: April 12, 2026',
      intro:
        'These Terms of Service ("Terms") govern your use of Cadence. By creating an account or otherwise using Cadence, you agree to these Terms. If you do not agree, do not use the service.',
      sections: [
        {
          h: '1. The service',
          p: 'Cadence is a scheduling platform that lets individuals and teams publish booking links, manage calendars, send reminders, run team competitions, and integrate with third-party calendars. Features may change over time; we will provide reasonable notice for material changes.',
        },
        {
          h: '2. Accounts',
          p: 'You must be at least 16 years old. You are responsible for safeguarding your password, for keeping your account information accurate, and for all activity that occurs under your account. Notify us immediately of any unauthorized use.',
        },
        {
          h: '3. Acceptable use',
          p: 'You agree not to: (a) use Cadence for unlawful purposes; (b) send spam or unsolicited communications; (c) reverse-engineer, scrape, or attempt to bypass security; (d) impersonate others or misrepresent your affiliation; (e) upload malware; or (f) exceed reasonable rate limits. We may suspend or terminate accounts that violate these rules.',
        },
        {
          h: '4. Your content',
          p: 'You retain ownership of the data you upload (meeting titles, notes, attachments, custom branding). You grant Cadence a limited license to host, display, and process that data solely to provide the service. We do not claim ownership of your content.',
        },
        {
          h: '5. Intellectual property',
          p: 'Cadence, including its software, trademarks, and original content, is owned by us or our licensors and protected by intellectual-property laws. Nothing in these Terms grants you any right to our trademarks or branding.',
        },
        {
          h: '6. Third-party integrations',
          p: 'When you connect Google, Microsoft, or another third-party service, the third party\'s terms also apply. We are not responsible for outages, data loss, or policy changes on third-party platforms.',
        },
        {
          h: '7. Disclaimers',
          p: 'Cadence is provided "as is" and "as available", without warranties of any kind, whether express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the service will be uninterrupted, error-free, or that calendar sync will be perfectly accurate.',
        },
        {
          h: '8. Limitation of liability',
          p: 'To the maximum extent permitted by law, Cadence and its affiliates are not liable for indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, revenue, data, or business opportunities, arising from your use of the service. Our total liability for any claim is limited to the greater of (a) the fees you paid us in the 12 months preceding the claim or (b) USD 100.',
        },
        {
          h: '9. Indemnity',
          p: 'You agree to indemnify and hold harmless Cadence from any claim, loss, or expense (including reasonable legal fees) arising from your use of the service, your content, or your violation of these Terms.',
        },
        {
          h: '10. Termination',
          p: 'You may terminate your account at any time from the Settings page. We may suspend or terminate your account if you breach these Terms, with notice where practicable. On termination, your data is deleted within 30 days, except where retention is required by law.',
        },
        {
          h: '11. Governing law',
          p: 'These Terms are governed by the laws of the jurisdiction stated in your service agreement, or where no agreement specifies, the laws of the State of Qatar, without regard to conflict-of-laws principles. Disputes are subject to the exclusive jurisdiction of the courts of that jurisdiction.',
        },
        {
          h: '12. Changes to the terms',
          p: 'We may revise these Terms from time to time. We will post the updated version and notify you of material changes. Continued use after the effective date constitutes acceptance.',
        },
        {
          h: '13. Contact',
          p: 'Questions about these Terms can be sent to legal@cadence.app.',
        },
      ],
    },
    ar: {
      title: 'شروط الخدمة',
      updated: 'آخر تحديث: 12 أبريل 2026',
      intro:
        'تحكم شروط الخدمة هذه ("الشروط") استخدامك لـ Cadence. بإنشائك حساباً أو استخدامك Cadence فإنك توافق على هذه الشروط. إذا لم توافق، فلا تستخدم الخدمة.',
      sections: [
        {
          h: '1. الخدمة',
          p: 'Cadence منصة جدولة تتيح للأفراد والفرق نشر روابط الحجز، إدارة التقاويم، إرسال التذكيرات، تشغيل منافسات الفرق، والتكامل مع تقاويم خارجية. قد تتغير الميزات بمرور الوقت؛ سنقدم إشعاراً معقولاً للتغييرات الجوهرية.',
        },
        {
          h: '2. الحسابات',
          p: 'يجب أن يكون عمرك 16 عاماً على الأقل. أنت مسؤول عن حماية كلمة المرور، وعن دقة معلومات الحساب، وعن جميع الأنشطة التي تتم تحت حسابك. أبلغنا فوراً بأي استخدام غير مصرح به.',
        },
        {
          h: '3. الاستخدام المقبول',
          p: 'توافق على عدم: (أ) استخدام Cadence لأغراض غير قانونية؛ (ب) إرسال رسائل غير مرغوبة؛ (ج) محاولة الهندسة العكسية أو تجاوز الأمان؛ (د) انتحال شخصية أو تضليل الانتماء؛ (هـ) تحميل برمجيات خبيثة؛ أو (و) تجاوز حدود المعدل المعقولة. يمكننا تعليق أو إنهاء الحسابات المخالفة.',
        },
        {
          h: '4. محتواك',
          p: 'تحتفظ بملكية البيانات التي ترفعها (عناوين الاجتماعات، الملاحظات، المرفقات، العلامة التجارية). تمنح Cadence ترخيصاً محدوداً لاستضافة وعرض ومعالجة تلك البيانات فقط لتقديم الخدمة. لا ندعي ملكية محتواك.',
        },
        {
          h: '5. الملكية الفكرية',
          p: 'Cadence، بما في ذلك برمجياتها وعلاماتها التجارية ومحتواها الأصلي، مملوكة لنا أو لمرخصينا ومحمية بقوانين الملكية الفكرية. لا شيء في هذه الشروط يمنحك أي حق في علاماتنا التجارية.',
        },
        {
          h: '6. التكاملات الخارجية',
          p: 'عند ربط Google أو Microsoft أو أي خدمة خارجية أخرى، تنطبق شروط الطرف الثالث أيضاً. نحن غير مسؤولين عن انقطاع أو فقدان البيانات أو تغييرات السياسة على المنصات الخارجية.',
        },
        {
          h: '7. إخلاء المسؤولية',
          p: 'تُقدَّم Cadence "كما هي" و"حسب توفرها"، دون ضمانات من أي نوع، صريحة أو ضمنية، بما في ذلك القابلية للتسويق والملاءمة لغرض معين وعدم الانتهاك. لا نضمن أن الخدمة ستعمل دون انقطاع أو خالية من الأخطاء.',
        },
        {
          h: '8. تحديد المسؤولية',
          p: 'إلى أقصى حد يسمح به القانون، لا تكون Cadence وشركاؤها مسؤولين عن الأضرار غير المباشرة أو العرضية أو الخاصة أو التبعية أو العقابية، أو عن أي خسارة أرباح أو إيرادات أو بيانات. مسؤوليتنا الإجمالية عن أي مطالبة تقتصر على الأكبر من (أ) الرسوم المدفوعة لنا خلال 12 شهراً السابقة أو (ب) 100 دولار أمريكي.',
        },
        {
          h: '9. التعويض',
          p: 'توافق على تعويض Cadence وحمايتها من أي مطالبة أو خسارة أو نفقة (بما في ذلك الرسوم القانونية المعقولة) ناتجة عن استخدامك للخدمة أو محتواك أو انتهاكك لهذه الشروط.',
        },
        {
          h: '10. الإنهاء',
          p: 'يمكنك إنهاء حسابك في أي وقت من صفحة الإعدادات. يمكننا تعليق أو إنهاء حسابك إذا انتهكت هذه الشروط، مع إشعار حيثما أمكن. عند الإنهاء، تُحذف بياناتك خلال 30 يوماً، إلا حيث يتطلب القانون الاحتفاظ بها.',
        },
        {
          h: '11. القانون الحاكم',
          p: 'تخضع هذه الشروط لقوانين الولاية القضائية المنصوص عليها في اتفاقية خدمتك، أو حيث لا تحدد اتفاقية، قوانين دولة قطر، دون اعتبار لمبادئ تنازع القوانين. تخضع النزاعات للاختصاص الحصري لمحاكم تلك الولاية القضائية.',
        },
        {
          h: '12. تغييرات الشروط',
          p: 'قد نراجع هذه الشروط من وقت لآخر. سننشر النسخة المحدثة ونخطرك بالتغييرات الجوهرية. الاستخدام المستمر بعد التاريخ الفعلي يشكل قبولاً.',
        },
        {
          h: '13. التواصل',
          p: 'يمكن إرسال الأسئلة حول هذه الشروط إلى legal@cadence.app.',
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
          <a href="/privacy" className="hover:text-[#8A1538] transition-colors">
            {lang === 'en' ? 'Privacy Policy' : 'سياسة الخصوصية'}
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

export default TermsOfServicePage;
