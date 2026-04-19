import { text } from '../i18n/translations';

export const refundPolicyMeta = {
  reference: 'POL-0015',
  effectiveDate: text('April 12, 2026', '12 أبريل 2026'),
};

export const refundPolicySections = [
  {
    title: text('1. Introduction', '1. المقدمة'),
    paragraphs: [
      text(
        'Aiqda ("Platform") is committed to providing a transparent and fair refund process in accordance with applicable regulations of the Kingdom of Saudi Arabia, including consumer protection standards issued by the Ministry of Commerce.',
        'تلتزم Aiqda ("المنصة") بتوفير آلية استرداد واضحة وعادلة وفقًا للأنظمة المعمول بها في المملكة العربية السعودية، بما في ذلك معايير حماية المستهلك الصادرة عن وزارة التجارة.'
      ),
    ],
  },
  {
    title: text('2. Nature of Service', '2. طبيعة الخدمة'),
    bullets: [
      text('Paid access to a digital library of pre-recorded content.', 'وصول مدفوع إلى مكتبة رقمية من المحتوى المسجل مسبقًا.'),
      text('Upon initiating a purchase, access to content is granted immediately.', 'يتم منح الوصول إلى المحتوى فور بدء عملية الشراء.'),
      text('The payment is authorized at checkout and finalized after 24 hours.', 'يتم تفويض الدفع عند إتمام الطلب ويُعتمد نهائيًا بعد 24 ساعة.'),
    ],
  },
  {
    title: text('3. 24-Hour Refund Eligibility', '3. أهلية الاسترداد خلال 24 ساعة'),
    paragraphs: [
      text('Users may request a full refund within 24 hours of initiating payment.', 'يجوز للمستخدم طلب استرداد كامل خلال 24 ساعة من بدء عملية الدفع.'),
    ],
    bullets: [
      text('During this 24-hour period, the transaction remains eligible for cancellation.', 'خلال هذه الفترة البالغة 24 ساعة تبقى العملية قابلة للإلغاء.'),
      text('No final charge is considered completed until the 24-hour period has passed.', 'لا يُعتبر الخصم نهائيًا قبل انقضاء فترة الـ 24 ساعة.'),
    ],
  },
  {
    title: text('4. Non-Refundable Conditions', '4. حالات غير قابلة للاسترداد'),
    bullets: [
      text('Requests submitted after 24 hours from the initial transaction.', 'الطلبات المقدمة بعد مرور 24 ساعة من المعاملة الأصلية.'),
      text('Abuse or repeated misuse of the refund policy.', 'إساءة استخدام سياسة الاسترداد أو تكرار إساءة استخدامها.'),
    ],
  },
  {
    title: text('5. Payment Model', '5. آلية الدفع'),
    bullets: [
      text('Access to Aiqda is provided through electronic payments only.', 'يتم توفير الوصول إلى Aiqda من خلال وسائل الدفع الإلكتروني فقط.'),
      text('Cash or offline payment methods are not accepted.', 'لا تُقبل المدفوعات النقدية أو وسائل الدفع غير الإلكترونية.'),
      text('There are no automatic renewals or recurring billing.', 'لا توجد عمليات تجديد تلقائي أو فوترة متكررة.'),
      text('Each purchase is treated as an independent transaction.', 'تُعامل كل عملية شراء على أنها معاملة مستقلة.'),
      text('Payments are authorized immediately and finalized after 24 hours.', 'يتم تفويض المدفوعات فورًا وتأكيدها نهائيًا بعد 24 ساعة.'),
    ],
  },
  {
    title: text('6. Exceptional Cases', '6. الحالات الاستثنائية'),
    paragraphs: [
      text('Aiqda may review refund or compensation requests in exceptional circumstances, including:', 'يجوز لـ Aiqda مراجعة طلبات الاسترداد أو التعويض في الظروف الاستثنائية، ومنها:'),
    ],
    bullets: [
      text('Verified technical issues preventing access to the platform.', 'وجود مشكلات تقنية مؤكدة تمنع الوصول إلى المنصة.'),
      text('Duplicate or incorrect billing transactions.', 'العمليات المكررة أو الأخطاء في الفوترة.'),
      text('In such cases, Aiqda may, at its sole discretion, resolve the issue, provide compensation, or issue a refund.', 'وفي هذه الحالات قد تقوم Aiqda، وفق تقديرها الخاص، بحل المشكلة أو تقديم تعويض أو إصدار استرداد.'),
    ],
  },
  {
    title: text('7. Refund Processing', '7. معالجة الاسترداد'),
    bullets: [
      text('Approved refunds are processed within 7 to 15 business days.', 'تُعالج عمليات الاسترداد المعتمدة خلال 7 إلى 15 يوم عمل.'),
      text('Refunds are issued via the original electronic payment method only.', 'يتم إصدار الاسترداد عبر وسيلة الدفع الإلكترونية الأصلية فقط.'),
      text('Processing time may vary depending on financial institutions.', 'قد تختلف مدة المعالجة بحسب المؤسسة المالية المعنية.'),
    ],
  },
  {
    title: text('8. Abuse Prevention', '8. منع إساءة الاستخدام'),
    paragraphs: [
      text('Aiqda reserves the right to suspend or restrict accounts if a user is found to be abusing the refund policy through repeated or fraudulent requests.', 'تحتفظ Aiqda بحق تعليق الحسابات أو تقييدها إذا ثبت إساءة المستخدم لسياسة الاسترداد من خلال طلبات متكررة أو احتيالية.'),
    ],
  },
  {
    title: text('9. Acceptance of Policy', '9. قبول السياسة'),
    paragraphs: [
      text('By initiating a payment, the user explicitly acknowledges and agrees to this Refund Policy, including the electronic payment requirement and delayed payment finalization structure.', 'من خلال بدء عملية الدفع، يقر المستخدم صراحةً ويوافق على سياسة الاسترداد هذه، بما في ذلك شرط الدفع الإلكتروني وآلية اعتماد الدفع النهائي المؤجل.'),
    ],
  },
];

export const CHECKOUT_DISCLAIMER_VERSION = refundPolicyMeta.reference;
export const CHECKOUT_DISCLAIMER_EFFECTIVE_DATE = refundPolicyMeta.effectiveDate;
export const CHECKOUT_DISCLAIMER_LABEL = text('I Understand and Agree', 'أفهم وأوافق');

export const CHECKOUT_DISCLAIMER_PARAGRAPHS = [
  text('By completing this purchase, you acknowledge and agree that Aiqda provides immediate access to a digital library of pre-recorded content upon payment authorization, and that access is granted instantly with no delay or staged delivery.', 'بإتمام هذا الشراء، فإنك تقر وتوافق على أن Aiqda توفّر وصولًا فوريًا إلى مكتبة رقمية من المحتوى المسجل مسبقًا عند تفويض الدفع، وأن الوصول يُمنح مباشرة دون تأخير أو تسليم مرحلي.'),
  text('You understand that Aiqda operates as a digital content access platform, and that all purchases made are for access to digital content only.', 'أنت تدرك أن Aiqda تعمل كمنصة للوصول إلى المحتوى الرقمي، وأن جميع المشتريات تتم بغرض الوصول إلى المحتوى الرقمي فقط.'),
  text('You acknowledge that payments on Aiqda are conducted through electronic methods only, and that your payment will be authorized at the time of purchase and finalized after a 24-hour period, during which you remain eligible to request a full refund.', 'أنت تقر بأن المدفوعات على Aiqda تتم عبر وسائل إلكترونية فقط، وأن دفعتك سيتم تفويضها وقت الشراء واعتمادها نهائيًا بعد 24 ساعة، وخلال هذه الفترة تظل مؤهلًا لطلب استرداد كامل.'),
  text('You understand that refund requests must be submitted within 24 hours of initiating the transaction, and that requests submitted after this period will not be eligible for refund under normal conditions.', 'أنت تدرك أن طلبات الاسترداد يجب أن تُقدَّم خلال 24 ساعة من بدء المعاملة، وأن الطلبات المقدمة بعد هذه المدة لن تكون مؤهلة للاسترداد في الظروف المعتادة.'),
  text('You further understand that all purchases on Aiqda are one-time transactions with no automatic renewals or recurring charges.', 'كما تدرك أن جميع المشتريات على Aiqda هي معاملات لمرة واحدة دون تجديد تلقائي أو رسوم متكررة.'),
  text('You agree that any refund requests are subject to Aiqda\'s review and approval process, and that exceptional cases, including technical issues or billing errors, may be handled at Aiqda\'s discretion through resolution, compensation, or refund where applicable.', 'وتوافق على أن أي طلب استرداد يخضع لمراجعة وموافقة Aiqda، وأن الحالات الاستثنائية، بما في ذلك الأعطال التقنية أو أخطاء الفوترة، قد تُعالج وفق تقدير Aiqda عبر الحل أو التعويض أو الاسترداد عند الاقتضاء.'),
  text('You acknowledge that approved refunds will be processed within 7 to 15 business days and will be issued using the original electronic payment method, subject to processing times imposed by financial institutions.', 'كما تقر بأن عمليات الاسترداد المعتمدة ستُعالَج خلال 7 إلى 15 يوم عمل، وستُصرف باستخدام وسيلة الدفع الإلكترونية الأصلية، مع خضوعها للمدد التي تفرضها الجهات المالية.'),
  text('By proceeding, you confirm that you have read, understood, and agreed to Aiqda\'s Refund Policy in full, including the electronic payment requirement and delayed payment finalization structure.', 'وبمتابعتك، فإنك تؤكد أنك قرأت وفهمت ووافقت بالكامل على سياسة الاسترداد الخاصة بـ Aiqda، بما في ذلك شرط الدفع الإلكتروني وآلية اعتماد الدفع النهائي المؤجل.'),
];
