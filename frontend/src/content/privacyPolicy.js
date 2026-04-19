import { text } from '../i18n/translations';

export const privacyPolicyMeta = {
  reference: 'POL-0014',
  effectiveDate: text('February 2, 2026', '2 فبراير 2026'),
  title: text('Aiqda Privacy Policy', 'سياسة خصوصية Aiqda'),
};

export const privacyPolicySections = [
  {
    title: text('1. Introduction', '1. المقدمة'),
    paragraphs: [
      text(
        'Aiqda (“Platform”, “we”, “us”) is committed to protecting user privacy and handling personal data in accordance with the Saudi Personal Data Protection Law (PDPL) and applicable regulations issued by SDAIA.',
        'تلتزم Aiqda ("المنصة" أو "نحن") بحماية خصوصية المستخدمين ومعالجة البيانات الشخصية وفقًا لنظام حماية البيانات الشخصية في المملكة العربية السعودية واللوائح المعمول بها الصادرة عن سدايا.'
      ),
      text(
        'This Privacy Policy outlines how personal data is collected, used, stored, and protected when users access the Aiqda platform.',
        'توضح سياسة الخصوصية هذه كيفية جمع البيانات الشخصية واستخدامها وتخزينها وحمايتها عند استخدام منصة Aiqda.'
      ),
    ],
  },
  {
    title: text('2. Platform Nature', '2. طبيعة المنصة'),
    paragraphs: [
      text(
        'Aiqda operates strictly as a digital electronic content library providing access to independently produced recorded materials.',
        'تعمل Aiqda حصريًا كمكتبة رقمية للمحتوى الإلكتروني تتيح الوصول إلى مواد مسجلة تم إنتاجها بشكل مستقل.'
      ),
      text(
        'Aiqda does not provide training, deliver structured learning programs, assess users, or issue certifications, acknowledgements, or qualifications. This classification is mandatory for regulatory compliance.',
        'لا تقدم Aiqda تدريبًا، ولا توفر برامج تعليمية منظمة، ولا تقيّم المستخدمين، ولا تمنح شهادات أو اعتمادات أو مؤهلات. ويعد هذا التصنيف إلزاميًا للامتثال التنظيمي.'
      ),
    ],
  },
  {
    title: text('3. Data Collection', '3. جمع البيانات'),
    bullets: [
      text('Personal data: name, email address, account credentials, and payment-related identifiers processed via third parties.', 'البيانات الشخصية: الاسم، والبريد الإلكتروني، وبيانات اعتماد الحساب، والمعرفات المرتبطة بالدفع التي تتم معالجتها عبر أطراف ثالثة.'),
      text('Usage data: content accessed, session activity, device and browser information, and IP address.', 'بيانات الاستخدام: المحتوى الذي تم الوصول إليه، ونشاط الجلسة، ومعلومات الجهاز والمتصفح، وعنوان IP.'),
      text('Engagement analytics: content access frequency and general interaction patterns.', 'تحليلات التفاعل: وتيرة الوصول إلى المحتوى وأنماط التفاعل العامة.'),
      text('Aiqda does not collect learning progress, completion rates, skill or competency data, or any form of participation or achievement tracking.', 'لا تجمع Aiqda بيانات التقدم التعليمي أو نسب الإكمال أو المهارات أو الكفاءات أو أي شكل من أشكال تتبع المشاركة أو الإنجاز.'),
    ],
  },
  {
    title: text('4. Purpose of Data Use', '4. غرض استخدام البيانات'),
    bullets: [
      text('Provide access to the content library.', 'توفير الوصول إلى مكتبة المحتوى.'),
      text('Manage subscriptions and user accounts.', 'إدارة الاشتراكات وحسابات المستخدمين.'),
      text('Improve platform functionality and performance.', 'تحسين وظائف المنصة وأدائها.'),
      text('Ensure platform security and fraud prevention.', 'ضمان أمن المنصة ومنع الاحتيال.'),
      text('Data is not used to evaluate user skills, measure competency, or track educational outcomes.', 'لا تُستخدم البيانات لتقييم مهارات المستخدم أو قياس كفاءته أو تتبع نتائجه التعليمية.'),
    ],
  },
  {
    title: text('5. Legal Basis for Processing', '5. الأساس القانوني للمعالجة'),
    bullets: [
      text('User consent.', 'موافقة المستخدم.'),
      text('Contractual necessity for subscription services.', 'الضرورة التعاقدية لتقديم خدمات الاشتراك.'),
      text('Legitimate business interest for security and analytics.', 'المصلحة التجارية المشروعة لأغراض الأمن والتحليلات.'),
      text('Legal obligations under Saudi law.', 'الالتزامات القانونية بموجب الأنظمة السعودية.'),
    ],
  },
  {
    title: text('6. Data Sharing', '6. مشاركة البيانات'),
    bullets: [
      text('Payment processors.', 'معالجو المدفوعات.'),
      text('Hosting and cloud service providers.', 'مزودو الاستضافة والخدمات السحابية.'),
      text('Analytics service providers.', 'مزودو خدمات التحليلات.'),
      text('Aiqda does not sell personal data and does not share data for training, evaluation, or certification purposes.', 'لا تبيع Aiqda البيانات الشخصية ولا تشاركها لأغراض التدريب أو التقييم أو الشهادات.'),
    ],
  },
  {
    title: text('7. Data Storage & Transfers', '7. تخزين البيانات ونقلها'),
    bullets: [
      text('Data may be stored within or outside Saudi Arabia.', 'قد تُخزن البيانات داخل المملكة العربية السعودية أو خارجها.'),
      text('All cross-border transfers comply with PDPL requirements.', 'تلتزم جميع عمليات النقل عبر الحدود بمتطلبات نظام حماية البيانات الشخصية.'),
      text('Appropriate safeguards are applied to protect data.', 'يتم تطبيق الضمانات المناسبة لحماية البيانات.'),
    ],
  },
  {
    title: text('8. Data Retention', '8. الاحتفاظ بالبيانات'),
    paragraphs: [
      text('Data is retained for the duration of the user’s account and as required for legal or operational purposes.', 'يتم الاحتفاظ بالبيانات طوال مدة حساب المستخدم وبالقدر اللازم للأغراض القانونية أو التشغيلية.'),
      text('No records related to completion, participation, or certification are stored.', 'لا يتم حفظ سجلات تتعلق بالإكمال أو المشاركة أو الشهادات.'),
    ],
  },
  {
    title: text('9. User Rights (PDPL Compliance)', '9. حقوق المستخدم (الامتثال لنظام حماية البيانات الشخصية)'),
    bullets: [
      text('Access personal data.', 'الوصول إلى البيانات الشخصية.'),
      text('Request correction.', 'طلب التصحيح.'),
      text('Request deletion where applicable.', 'طلب الحذف عند الاقتضاء.'),
      text('Withdraw consent.', 'سحب الموافقة.'),
      text('Requests must be submitted through official Aiqda support channels.', 'يجب تقديم الطلبات عبر قنوات الدعم الرسمية الخاصة بـ Aiqda.'),
    ],
  },
  {
    title: text('10. Security Measures', '10. إجراءات الأمان'),
    bullets: [
      text('Encryption protocols.', 'بروتوكولات التشفير.'),
      text('Access control mechanisms.', 'آليات التحكم في الوصول.'),
      text('Secure infrastructure.', 'بنية تحتية آمنة.'),
    ],
  },
  {
    title: text('11. Cookies & Tracking', '11. ملفات تعريف الارتباط والتتبع'),
    paragraphs: [
      text('Cookies are used for authentication, session management, and platform analytics.', 'تُستخدم ملفات تعريف الارتباط لأغراض المصادقة وإدارة الجلسات وتحليلات المنصة.'),
      text('Cookies are not used to track learning behavior or progression.', 'لا تُستخدم ملفات تعريف الارتباط لتتبع السلوك التعليمي أو التقدم.'),
    ],
  },
  {
    title: text('12. Limitation of Liability', '12. تحديد المسؤولية'),
    bullets: [
      text('Aiqda is not responsible for decisions made based on content.', 'لا تتحمل Aiqda المسؤولية عن القرارات المتخذة بناءً على المحتوى.'),
      text('Aiqda is not responsible for career or employment outcomes.', 'لا تتحمل Aiqda المسؤولية عن نتائج المسار المهني أو التوظيف.'),
      text('Aiqda is not responsible for misinterpretation or misuse of content.', 'لا تتحمل Aiqda المسؤولية عن سوء تفسير المحتوى أو إساءة استخدامه.'),
    ],
  },
  {
    title: text('13. Policy Updates', '13. تحديثات السياسة'),
    paragraphs: [
      text('Aiqda may update this policy at any time.', 'يجوز لـ Aiqda تحديث هذه السياسة في أي وقت.'),
      text('Continued use of the platform constitutes acceptance of updates.', 'ويُعد استمرار استخدام المنصة قبولًا لهذه التحديثات.'),
    ],
  },
  {
    title: text('14. Governing Law', '14. القانون الحاكم'),
    paragraphs: [
      text('This policy is governed by the laws of the Kingdom of Saudi Arabia.', 'تخضع هذه السياسة لأنظمة المملكة العربية السعودية.'),
    ],
  },
];
