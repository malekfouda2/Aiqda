import Consultation from './consultation.model.js';
import { normalizeExternalUrl } from '../../utils/url.js';

const SEEDED_CONSULTATION_LOCALIZATIONS = {
  'Creative Audit': {
    titleAr: 'التقييم الإبداعي',
    descriptionAr: 'جلسة مركزة لمدة 30 دقيقة لتقييم المشروع بسرعة وتقديم توجيه في مسار التحريك.',
    durationAr: '30 دقيقة',
    modeAr: 'فردي',
    focusPointsAr: [
      'تقييم سريع',
      'توجيه في مسار التحريك (ثنائي/ثلاثي الأبعاد/هجين)',
      'ملاحظات مختصرة',
      'خطوات عملية تالية',
      'ملخص اختياري',
    ],
  },
  'Project Review': {
    titleAr: 'مراجعة المشروع',
    descriptionAr: 'جلسة متعمقة لمدة 60 دقيقة تغطي القصة والتصميم والإنتاج مع ملخص PDF.',
    durationAr: '60 دقيقة',
    modeAr: 'جماعي',
    focusPointsAr: [
      'مراجعة تفصيلية للمشروع',
      'مراجعة المواد',
      'خطة لنقاط القوة والضعف',
      'إرشاد حول الأدوات وسير العمل',
      'ملخص PDF قصير',
    ],
  },
  'Studio Advisory': {
    titleAr: 'استشارة الاستوديو',
    descriptionAr: 'جلسة شاملة لمدة 90 دقيقة تناقش تخطيط الإنتاج والميزانية والتوجيه الاستراتيجي.',
    durationAr: '90 دقيقة',
    modeAr: 'جماعي',
    focusPointsAr: [
      'مراجعة شاملة',
      'تقييم الفريق والجدول الزمني',
      'تقييم الميزانية والتسويق',
      'حلول إبداعية وتقنية',
      'توجيه استراتيجي',
      'تقرير PDF تفصيلي كامل',
    ],
  },
  'Strategic Collaboration': {
    titleAr: 'التعاون الاستراتيجي',
    descriptionAr: 'جلسة مخصصة لمدة ساعة لمناقشة أهداف التعاون ونطاق الأعمال والخطوات التالية.',
    durationAr: 'ساعة واحدة',
    modeAr: 'فردي',
    focusPointsAr: [
      'مقدمة وأهداف التعاون',
      'نظرة عامة على النطاق: أعمال 24 Center والملف الإبداعي للشريك',
      'الخطوات التالية واجتماع المتابعة',
    ],
  },
};

let localizationInitializationPromise = null;

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeStringList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
};

const parseBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }

  return fallback;
};

const normalizeOrder = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePrice = (value, priceType, fallback = null) => {
  if (priceType === 'contract') {
    return null;
  }

  if (value === '' || value == null) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sanitizeConsultationData = (data = {}, fallback = {}) => {
  const title = normalizeString(data.title || fallback.title);
  const duration = normalizeString(data.duration || fallback.duration);
  const mode = normalizeString(data.mode || fallback.mode);
  const priceType = data.priceType === 'contract' ? 'contract' : 'fixed';

  if (!title) {
    throw new Error('Title is required');
  }

  if (!duration) {
    throw new Error('Duration is required');
  }

  if (!mode) {
    throw new Error('Mode is required');
  }

  return {
    title,
    titleAr: normalizeString(data.titleAr),
    description: normalizeString(data.description),
    descriptionAr: normalizeString(data.descriptionAr),
    priceType,
    price: normalizePrice(data.price, priceType, fallback.price ?? null),
    currency: normalizeString(data.currency || fallback.currency || 'SAR') || 'SAR',
    duration,
    durationAr: normalizeString(data.durationAr),
    mode,
    modeAr: normalizeString(data.modeAr),
    focusPoints: normalizeStringList(data.focusPoints),
    focusPointsAr: normalizeStringList(data.focusPointsAr),
    zoomSchedulerLink: normalizeExternalUrl(
      data.zoomSchedulerLink ?? fallback.zoomSchedulerLink,
      {
        fieldLabel: 'Zoom scheduler link',
        required: false,
      }
    ),
    isActive: parseBoolean(data.isActive, fallback.isActive ?? true),
    order: normalizeOrder(data.order, fallback.order ?? 0),
  };
};

const ensureDefaultConsultationLocalizationsInternal = async () => {
  const consultations = await Consultation.find({
    title: { $in: Object.keys(SEEDED_CONSULTATION_LOCALIZATIONS) },
  });

  await Promise.all(consultations.map(async (consultation) => {
    const defaults = SEEDED_CONSULTATION_LOCALIZATIONS[consultation.title];
    if (!defaults) {
      return;
    }

    const updates = {};

    if (!normalizeString(consultation.titleAr)) {
      updates.titleAr = defaults.titleAr;
    }

    if (!normalizeString(consultation.descriptionAr)) {
      updates.descriptionAr = defaults.descriptionAr;
    }

    if (!normalizeString(consultation.durationAr)) {
      updates.durationAr = defaults.durationAr;
    }

    if (!normalizeString(consultation.modeAr)) {
      updates.modeAr = defaults.modeAr;
    }

    if (!Array.isArray(consultation.focusPointsAr) || consultation.focusPointsAr.length === 0) {
      updates.focusPointsAr = defaults.focusPointsAr;
    }

    if (Object.keys(updates).length > 0) {
      await Consultation.updateOne({ _id: consultation._id }, { $set: updates });
    }
  }));
};

const ensureDefaultConsultationLocalizations = async () => {
  if (localizationInitializationPromise) {
    return localizationInitializationPromise;
  }

  localizationInitializationPromise = ensureDefaultConsultationLocalizationsInternal()
    .finally(() => {
      localizationInitializationPromise = null;
    });

  return localizationInitializationPromise;
};

export const getActive = async () => {
  await ensureDefaultConsultationLocalizations();
  return Consultation.find({ isActive: true }).sort({ order: 1 });
};

export const getAll = async () => {
  await ensureDefaultConsultationLocalizations();
  return Consultation.find().sort({ order: 1 });
};

export const getById = async (id) => {
  await ensureDefaultConsultationLocalizations();
  return Consultation.findById(id);
};

export const create = async (data) => {
  const consultation = new Consultation(sanitizeConsultationData(data));
  return consultation.save();
};

export const update = async (id, data) => {
  const consultation = await Consultation.findById(id);
  if (!consultation) {
    return null;
  }

  const payload = sanitizeConsultationData(data, consultation.toObject());
  return Consultation.findByIdAndUpdate(id, payload, { new: true });
};

export const remove = async (id) => {
  return Consultation.findByIdAndDelete(id);
};
