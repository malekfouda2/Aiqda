import { text } from '../i18n/translations';

export const studioContentSubmissionFrameworkMeta = {
  reference: '24-OP-0003',
  effectiveDate: text('February 2, 2026', '2 فبراير 2026'),
  title: text(
    'Aiqda Studio Content Submission Framework',
    'إطار تقديم محتوى الاستوديو في Aiqda'
  ),
  summary: text(
    'This framework governs production documentation and technical walkthrough content only. It does not establish educational structure, training methodology, or learning progression.',
    'ينظم هذا الإطار محتوى التوثيق الإنتاجي والشروحات التقنية فقط، ولا يضع بنية تعليمية أو منهجية تدريبية أو تسلسلاً للتعلّم.'
  ),
};

export const studioContentSubmissionFrameworkSections = [
  {
    title: text(
      'I. Content Nature Requirements (Non-Negotiable)',
      '1. متطلبات طبيعة المحتوى (غير قابلة للتفاوض)'
    ),
    bullets: [
      text('All submitted content must be pre-recorded.', 'يجب أن يكون جميع المحتوى المقدم مسجلاً مسبقًا.'),
      text('Content must be standalone and independently accessible.', 'يجب أن يكون المحتوى مستقلاً ويمكن الوصول إليه بشكل منفصل.'),
      text('No structured curriculum, learning paths, or progression language.', 'يُمنع استخدام لغة المناهج المنظمة أو مسارات التعلّم أو التدرج التعليمي.'),
      text('No competency validation, assessment, or training framing.', 'يُمنع تقديم المحتوى بصيغة التقييم أو التحقق من الكفاءة أو التدريب.'),
      text(
        'Must align with Aiqda’s classification as a digital electronic content library.',
        'يجب أن يتوافق المحتوى مع تصنيف Aiqda كمكتبة رقمية للمحتوى الإلكتروني.'
      ),
    ],
  },
  {
    title: text(
      'II. Production-Level Content Criteria',
      '2. معايير المحتوى على مستوى الإنتاج'
    ),
    bullets: [
      text(
        'Content must demonstrate real production context (shot breakdowns, pipeline decisions, scene workflows).',
        'يجب أن يُظهر المحتوى سياقًا إنتاجيًا حقيقيًا مثل تفكيك اللقطات وقرارات خط الإنتاج وسير عمل المشاهد.'
      ),
      text(
        'Content must reflect production systems thinking (asset management, version control, bottlenecks).',
        'يجب أن يعكس المحتوى فهمًا لأنظمة الإنتاج مثل إدارة الأصول والتحكم في الإصدارات ونقاط الاختناق.'
      ),
      text(
        'Software must be demonstrated at studio production scale, not beginner tutorial level.',
        'يجب عرض استخدام البرامج على مستوى إنتاج الاستوديو، وليس على مستوى الشروحات المبتدئة.'
      ),
      text(
        'Each submission must be project-based and structured asset-by-asset per content/video. Content must reflect production insight and process transparency, not instructional sequencing.',
        'يجب أن يكون كل تقديم قائمًا على مشروع وأن يُنظَّم أصلًا بأصل داخل كل محتوى أو فيديو. ويجب أن يعكس المحتوى رؤية إنتاجية وشفافية في العملية، لا تسلسلاً تعليميًا.'
      ),
      text(
        'If presenting an illustration, scene, or shot, creators must break down how each asset was built (e.g., background construction, lighting setup, character development, compositing layers, rendering passes, final polish).',
        'عند تقديم رسم أو مشهد أو لقطة، يجب على صناع المحتوى شرح كيفية بناء كل أصل، مثل بناء الخلفية، وإعداد الإضاءة، وتطوير الشخصيات، وطبقات الدمج، وتمريرات الرندر، واللمسات النهائية.'
      ),
      text(
        'If presenting animation or VFX work, studios must explain shot construction step-by-step (layout, blocking, rigging, simulation, lighting, compositing, render strategy).',
        'عند تقديم أعمال التحريك أو المؤثرات البصرية، يجب على الاستوديوهات شرح بناء اللقطة خطوة بخطوة، مثل التخطيط، والبلوكينغ، والريغ، والمحاكاة، والإضاءة، والدمج، واستراتيجية الرندر.'
      ),
      text(
        'Content must reflect how elements function together inside a real production pipeline.',
        'يجب أن يوضح المحتوى كيف تعمل العناصر معًا داخل خط إنتاج حقيقي.'
      ),
    ],
  },
  {
    title: text(
      'III. Category-Based Eligibility (Animation & VFX)',
      '3. الأهلية حسب التخصص (التحريك والمؤثرات البصرية)'
    ),
    bullets: [
      text(
        'Animation specialties: 2D/3D Character Animation, Rigging, Pipeline Workflow, Storyboarding, Cinematic Animation.',
        'تخصصات التحريك: تحريك الشخصيات ثنائي وثلاثي الأبعاد، والريغ، وسير عمل خط الإنتاج، والستوريبورد، والتحريك السينمائي.'
      ),
      text(
        'VFX specialties: Compositing, FX Simulation, Lighting & Rendering, Unreal for VFX, On-Set Supervision.',
        'تخصصات المؤثرات البصرية: الدمج، ومحاكاة المؤثرات، والإضاءة والرندر، واستخدام Unreal للمؤثرات البصرية، والإشراف في موقع التصوير.'
      ),
      text(
        'Content must demonstrate real studio application aligned with approved industry software.',
        'يجب أن يوضح المحتوى تطبيقًا حقيقيًا داخل الاستوديو باستخدام برامج معتمدة في المجال.'
      ),
      text(
        'Each specialty submission must clearly identify which production phase and asset category it represents.',
        'يجب أن يحدد كل تقديم تخصصي بوضوح المرحلة الإنتاجية وفئة الأصول التي يمثلها.'
      ),
    ],
  },
  {
    title: text(
      'IV. File Format & Technical Submission Standards',
      '4. معايير الصيغ الفنية والتسليم التقني'
    ),
    bullets: [
      text(
        'Final rendered media required (.mov, .mp4, .png, .exr).',
        'يجب تسليم الوسائط النهائية المخرجة بصيغ مثل (.mov، .mp4، .png، .exr).'
      ),
      text(
        'Minimum 1920x1080 resolution, 24fps or 30fps.',
        'الحد الأدنى للدقة هو 1920×1080 وبمعدل 24 أو 30 إطارًا في الثانية.'
      ),
      text(
        '48kHz clean audio, no watermark or promotional overlays.',
        'يجب أن يكون الصوت نظيفًا بتردد 48kHz ومن دون علامات مائية أو طبقات ترويجية.'
      ),
      text(
        'Optional source files accepted when relevant (.ma, .mb, .blend, .c4d, .nk, .aep, .uasset, .ztl, .psd, etc.).',
        'يمكن قبول ملفات المصدر اختياريًا عند الحاجة بصيغ مثل (.ma، .mb، .blend، .c4d، .nk، .aep، .uasset، .ztl، .psd وغيرها).'
      ),
      text(
        'Source files must correspond directly to the demonstrated asset or production segment.',
        'يجب أن ترتبط ملفات المصدر مباشرة بالأصل أو الجزء الإنتاجي المعروض.'
      ),
    ],
  },
  {
    title: text('V. Quality Threshold', '5. الحد الأدنى للجودة'),
    bullets: [
      text('Professional production audio and visual clarity.', 'وضوح بصري وصوتي بمستوى إنتاج احترافي.'),
      text(
        'Structured technical explanation with real-world relevance.',
        'شرح تقني منظم ومرتبط بتطبيقات واقعية.'
      ),
      text(
        'Clear asset-by-asset or shot-by-shot articulation.',
        'عرض واضح أصلًا بأصل أو لقطة بلقطة.'
      ),
      text(
        'No beginner-level tutorials or hobby-focused demonstrations.',
        'يُمنع تقديم شروحات للمبتدئين أو عروض موجهة للهوايات.'
      ),
    ],
  },
  {
    title: text(
      'VI. Source of Eligible Studio Content',
      '6. مصادر محتوى الاستوديو المؤهل'
    ),
    bullets: [
      text('Completed production case studies.', 'دراسات حالة لمشاريع إنتاجية مكتملة.'),
      text(
        'Internal production retrospectives and shot reviews.',
        'مراجعات داخلية للإنتاج وتحليلات اللقطات.'
      ),
      text(
        'Pipeline documentation and technical deep dives.',
        'توثيق خط الإنتاج والشروحات التقنية المتعمقة.'
      ),
      text(
        'Supervisory presentations and internal knowledge sessions.',
        'عروض إشرافية وجلسات معرفة داخلية.'
      ),
      text(
        'Project breakdown sessions where assets are deconstructed into their production components.',
        'جلسات تفكيك المشاريع التي تُشرح فيها الأصول إلى مكوناتها الإنتاجية.'
      ),
      text(
        'Not accepted: influencer-style tutorials, casual livestreams, beginner workshops.',
        'غير مقبول: الشروحات بأسلوب المؤثرين، أو البثوث العفوية، أو الورش الموجهة للمبتدئين.'
      ),
    ],
  },
  {
    title: text(
      'VII. Compliance & Regulatory Alignment',
      '7. الامتثال والمواءمة التنظيمية'
    ),
    bullets: [
      text(
        'Content must remain informational and non-assessable.',
        'يجب أن يظل المحتوى معلوماتيًا وغير خاضع للتقييم.'
      ),
      text(
        'No certification, qualification, or completion claims.',
        'يُمنع تقديم أي ادعاءات بالشهادات أو الاعتماد أو الإكمال.'
      ),
      text(
        'Aligned with Aiqda Electronic Content Library Policy and User Content Access Policy.',
        'يجب أن يتوافق مع سياسة مكتبة المحتوى الإلكتروني في Aiqda وسياسة وصول المستخدم إلى المحتوى.'
      ),
    ],
    paragraphs: [
      text(
        'This framework governs production documentation and technical walkthrough content only. It does not establish educational structure, training methodology, or learning progression.',
        'ينظم هذا الإطار محتوى التوثيق الإنتاجي والشروحات التقنية فقط، ولا يضع بنية تعليمية أو منهجية تدريبية أو تسلسلاً للتعلّم.'
      ),
    ],
  },
];
