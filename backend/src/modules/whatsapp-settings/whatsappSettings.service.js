import WhatsAppSettings from './whatsappSettings.model.js';

const DEFAULT_SETTINGS = Object.freeze({
  key: 'global',
  isEnabled: false,
  englishNumber: '',
  arabicNumber: '',
});

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }
  }

  return fallback;
};

const normalizePhoneNumber = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';

  if (!trimmed) {
    return '';
  }

  let normalized = trimmed.replace(/[^\d]/g, '');
  if (normalized.startsWith('00')) {
    normalized = normalized.slice(2);
  }

  if (normalized.length < 8 || normalized.length > 15) {
    throw new Error('WhatsApp numbers must include a valid country code and contain between 8 and 15 digits.');
  }

  return normalized;
};

const getOrCreateSettings = async () => (
  WhatsAppSettings.findOneAndUpdate(
    { key: DEFAULT_SETTINGS.key },
    { $setOnInsert: DEFAULT_SETTINGS },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  )
);

const toAdminPayload = (settings) => ({
  isEnabled: settings.isEnabled,
  englishNumber: settings.englishNumber || '',
  arabicNumber: settings.arabicNumber || '',
  updatedAt: settings.updatedAt,
});

const toPublicPayload = (settings) => ({
  isEnabled: Boolean(settings.isEnabled),
  englishNumber: settings.englishNumber || '',
  arabicNumber: settings.arabicNumber || '',
  hasEnglishNumber: Boolean(settings.englishNumber),
  hasArabicNumber: Boolean(settings.arabicNumber),
});

export const getPublicSettings = async () => {
  const settings = await getOrCreateSettings();
  return toPublicPayload(settings);
};

export const getAdminSettings = async () => {
  const settings = await getOrCreateSettings();
  return toAdminPayload(settings);
};

export const updateAdminSettings = async (data = {}) => {
  const current = await getOrCreateSettings();
  const isEnabled = normalizeBoolean(data.isEnabled, current.isEnabled);
  const englishNumber = normalizePhoneNumber(data.englishNumber);
  const arabicNumber = normalizePhoneNumber(data.arabicNumber);

  if (isEnabled && !englishNumber && !arabicNumber) {
    throw new Error('Add at least one WhatsApp number before enabling the floating chat button.');
  }

  current.isEnabled = isEnabled;
  current.englishNumber = englishNumber;
  current.arabicNumber = arabicNumber;
  await current.save();

  return toAdminPayload(current);
};
