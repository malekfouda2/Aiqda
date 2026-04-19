export const DEFAULT_LOCALE = 'en';
export const LOCALE_STORAGE_KEY = 'aiqda-locale';
export const BRAND_NAMES = {
  en: 'Aiqda',
  ar: 'اقدع',
};

export const text = (en, ar) => ({ en, ar });

export const localizeBrandName = (value, locale = DEFAULT_LOCALE) => {
  if (typeof value !== 'string') {
    return value;
  }

  if (locale !== 'ar') {
    return value;
  }

  return value.replaceAll('Aiqda', BRAND_NAMES.ar).replaceAll('aiqda', BRAND_NAMES.ar);
};

export const isLocalizedValue = (value) => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.prototype.hasOwnProperty.call(value, 'en')
  && Object.prototype.hasOwnProperty.call(value, 'ar')
);

export const getLocalizedValue = (value, locale = DEFAULT_LOCALE) => {
  if (Array.isArray(value)) {
    return value.map((entry) => getLocalizedValue(entry, locale));
  }

  if (isLocalizedValue(value)) {
    return localizeBrandName(value[locale] || value.en || '', locale);
  }

  return localizeBrandName(value, locale);
};

export const getLocalizedField = (entity, field, locale = DEFAULT_LOCALE) => {
  if (!entity) {
    return '';
  }

  const directValue = entity[field];
  if (isLocalizedValue(directValue)) {
    return getLocalizedValue(directValue, locale);
  }

  if (locale === 'ar') {
    const arabicField = `${field}Ar`;
    if (typeof entity[arabicField] === 'string' && entity[arabicField].trim()) {
      return entity[arabicField];
    }

    const translatedField = entity.translations?.[field];
    if (translatedField) {
      return getLocalizedValue(translatedField, locale);
    }
  }

  return directValue ?? '';
};

export const translations = {
  en: {
    brand: {
      name: BRAND_NAMES.en,
    },
    locale: {
      english: 'English',
      arabic: 'العربية',
      switchLanguage: 'Switch language',
      short: 'AR',
    },
    common: {
      loading: 'Loading...',
      save: 'Save',
      saving: 'Saving...',
      cancel: 'Cancel',
      back: 'Back',
      continue: 'Continue',
      submit: 'Submit',
      submitting: 'Submitting...',
      create: 'Create',
      update: 'Update',
      delete: 'Delete',
      close: 'Close',
      all: 'All',
      active: 'Active',
      inactive: 'Inactive',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      submitted: 'Submitted',
      draft: 'Draft',
      published: 'Published',
      yes: 'Yes',
      no: 'No',
      members: 'Members',
      creators: 'Creators',
      admin: 'Admin',
      dashboard: 'Dashboard',
      chapters: 'Chapters',
      content: 'Content',
      contents: 'Contents',
      consultations: 'Consultations',
      subscriptions: 'Subscriptions',
      payments: 'Payments',
      users: 'Users',
      partners: 'Partners',
      quickLinks: 'Quick Links',
      viewAll: 'View All',
      browseMore: 'Browse More',
      getStarted: 'Get Started',
      login: 'Login',
      logout: 'Logout',
      register: 'Register',
      home: 'Home',
      contactUs: 'Contact Us',
      aboutUs: 'About Us',
      creator: 'Creator',
      account: 'Account',
      legal: 'Legal',
      explore: 'Explore',
      poweredBy: 'Powered By',
      allRightsReserved: 'All rights reserved.',
      schedule: 'Schedule',
      mode: 'Mode',
      focus: 'Focus',
      outcome: 'Outcome',
      bankDetails: 'Bank Details',
      reference: 'Reference',
      effectiveDate: 'Effective Date',
      relatedLinks: 'Related Links',
      relatedPolicies: 'Related Policies',
      noResults: 'No results found',
      tryAgain: 'Try again',
      bookAppointment: 'Book Appointment',
      memberView: 'Member View',
      overview: 'Overview',
      emailAddress: 'Email Address',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      fullName: 'Full Name',
      phoneNumber: 'Phone Number',
      subject: 'Subject',
      message: 'Message',
    },
    navbar: {
      chapters: 'Chapters',
      consultations: 'Consultations',
      dashboard: 'Dashboard',
      admin: 'Admin',
      creator: 'Creator',
      getStarted: 'Get Started',
      login: 'Login',
      logout: 'Logout',
    },
    footer: {
      about:
        'Aiqda is a premium skills improvement platform designed for those who seek excellence in creativity. Discover videos that inspire and transform.',
      designedFor:
        'Designed for professional growth, creator development, and studio collaboration.',
    },
    loading: {
      page: 'Loading page...',
      video: 'Loading video...',
    },
    auth: {
      role: {
        student: 'Member',
        instructor: 'Creator',
        admin: 'Admin',
      },
    },
    social: {
      continueWith: 'Or continue with',
      google: 'Continue with Google',
      linkedin: 'Continue with LinkedIn',
    },
    policies: {
      privacyPolicy: 'Privacy Policy',
      refundPolicy: 'Refund Policy',
      userTerms: 'Terms & Conditions For Users',
      creatorTerms: 'Terms & Conditions For Creators',
      accessPolicy: 'User Content Access Policy',
    },
    status: {
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
      monthly: 'Monthly',
      annual: 'Annual',
      fixed: 'Fixed',
      contractBased: 'Contract Based',
      oneToOne: '1 to 1',
      group: 'Group',
      read: 'Read',
      unread: 'Unread',
      custom: 'Custom',
    },
  },
  ar: {
    brand: {
      name: BRAND_NAMES.ar,
    },
    locale: {
      english: 'English',
      arabic: 'العربية',
      switchLanguage: 'تبديل اللغة',
      short: 'EN',
    },
    common: {
      loading: 'جارٍ التحميل...',
      save: 'حفظ',
      saving: 'جارٍ الحفظ...',
      cancel: 'إلغاء',
      back: 'رجوع',
      continue: 'متابعة',
      submit: 'إرسال',
      submitting: 'جارٍ الإرسال...',
      create: 'إنشاء',
      update: 'تحديث',
      delete: 'حذف',
      close: 'إغلاق',
      all: 'الكل',
      active: 'نشط',
      inactive: 'غير نشط',
      pending: 'قيد الانتظار',
      approved: 'مقبول',
      rejected: 'مرفوض',
      submitted: 'تم الإرسال',
      draft: 'مسودة',
      published: 'منشور',
      yes: 'نعم',
      no: 'لا',
      members: 'الأعضاء',
      creators: 'صنّاع المحتوى',
      admin: 'الإدارة',
      dashboard: 'لوحة التحكم',
      chapters: 'الفصول',
      content: 'المحتوى',
      contents: 'المحتويات',
      consultations: 'الاستشارات',
      subscriptions: 'الاشتراكات',
      payments: 'المدفوعات',
      users: 'المستخدمون',
      partners: 'الشركاء',
      quickLinks: 'روابط سريعة',
      viewAll: 'عرض الكل',
      browseMore: 'تصفح المزيد',
      getStarted: 'ابدأ الآن',
      login: 'تسجيل الدخول',
      logout: 'تسجيل الخروج',
      register: 'إنشاء حساب',
      home: 'الرئيسية',
      contactUs: 'تواصل معنا',
      aboutUs: 'من نحن',
      creator: 'صانع المحتوى',
      account: 'الحساب',
      legal: 'القانونية',
      explore: 'استكشف',
      poweredBy: 'بدعم من',
      allRightsReserved: 'جميع الحقوق محفوظة.',
      schedule: 'المدة',
      mode: 'النمط',
      focus: 'التركيز',
      outcome: 'النتيجة',
      bankDetails: 'بيانات البنك',
      reference: 'المرجع',
      effectiveDate: 'تاريخ السريان',
      relatedLinks: 'روابط ذات صلة',
      relatedPolicies: 'السياسات ذات الصلة',
      noResults: 'لا توجد نتائج',
      tryAgain: 'حاول مرة أخرى',
      bookAppointment: 'احجز موعدًا',
      memberView: 'عرض العضو',
      overview: 'نظرة عامة',
      emailAddress: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      confirmPassword: 'تأكيد كلمة المرور',
      fullName: 'الاسم الكامل',
      phoneNumber: 'رقم الهاتف',
      subject: 'الموضوع',
      message: 'الرسالة',
    },
    navbar: {
      chapters: 'الفصول',
      consultations: 'الاستشارات',
      dashboard: 'لوحة التحكم',
      admin: 'الإدارة',
      creator: 'صانع المحتوى',
      getStarted: 'ابدأ الآن',
      login: 'تسجيل الدخول',
      logout: 'تسجيل الخروج',
    },
    footer: {
      about:
        'Aiqda منصة مميزة لتطوير المهارات صُممت لكل من يسعى إلى التميز الإبداعي. اكتشف محتوى مرئيًا يلهمك ويمنحك أدوات التطور.',
      designedFor:
        'مصممة للنمو المهني، وتطوير صنّاع المحتوى، والتعاون مع الاستوديوهات.',
    },
    loading: {
      page: 'جارٍ تحميل الصفحة...',
      video: 'جارٍ تحميل الفيديو...',
    },
    auth: {
      role: {
        student: 'عضو',
        instructor: 'صانع محتوى',
        admin: 'مسؤول',
      },
    },
    social: {
      continueWith: 'أو تابع باستخدام',
      google: 'المتابعة عبر Google',
      linkedin: 'المتابعة عبر LinkedIn',
    },
    policies: {
      privacyPolicy: 'سياسة الخصوصية',
      refundPolicy: 'سياسة الاسترداد',
      userTerms: 'الشروط والأحكام للمستخدمين',
      creatorTerms: 'الشروط والأحكام لصنّاع المحتوى',
      accessPolicy: 'سياسة وصول المستخدم إلى المحتوى',
    },
    status: {
      beginner: 'مبتدئ',
      intermediate: 'متوسط',
      advanced: 'متقدم',
      monthly: 'شهري',
      annual: 'سنوي',
      fixed: 'سعر ثابت',
      contractBased: 'حسب الاتفاق',
      oneToOne: 'فردي',
      group: 'جماعي',
      read: 'مقروء',
      unread: 'غير مقروء',
      custom: 'مخصص',
    },
  },
};
