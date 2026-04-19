import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import Partner from './partner.model.js';
import PartnerContentState from './partnerContentState.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, '../../uploads');
const PARTNER_CONTENT_STATE_KEY = 'partners-defaults-v1';
let initializationPromise = null;

const DEFAULT_PARTNERS = [
  {
    name: '24 Center',
    image: '/partners/24-center-logo.png',
    website: '',
    order: 1,
    isActive: true,
  },
  {
    name: 'Cloffik Ltd',
    image: '/partners/cloffik-logo.png',
    website: '',
    order: 2,
    isActive: true,
  },
  {
    name: 'Imam University',
    image: '/partners/imam-logo.png',
    website: '',
    order: 3,
    isActive: true,
  },
];

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const parseBoolean = (value, fallback = false) => {
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

const isValidUrl = (value) => {
  if (!value) {
    return true;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const toStoredImagePath = (file) => {
  if (!file?.filename) {
    return null;
  }

  return `/uploads/partners/${file.filename}`;
};

const deleteImageIfPresent = async (storedPath) => {
  if (!storedPath || !storedPath.startsWith('/uploads/')) {
    return;
  }

  const relativePath = storedPath.replace(/^\/uploads\/?/, '');
  const absolutePath = path.join(uploadsRoot, relativePath);

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to delete partner logo:', error.message);
    }
  }
};

const validatePartnerPayload = (data = {}, { fallbackOrder = 0 } = {}) => {
  const name = normalizeString(data.name);
  const website = normalizeString(data.website);
  const order = normalizeOrder(data.order, fallbackOrder);
  const isActive = parseBoolean(data.isActive, true);
  const removeImage = parseBoolean(data.removeImage, false);

  if (!name) {
    throw new Error('Partner name is required');
  }

  if (name.length > 160) {
    throw new Error('Partner name is too long');
  }

  if (website.length > 500) {
    throw new Error('Website URL is too long');
  }

  if (!isValidUrl(website)) {
    throw new Error('Website must be a valid URL');
  }

  return {
    name,
    website,
    order,
    isActive,
    removeImage,
  };
};

const markPartnersInitialized = async ({ seededDefaults }) => {
  await PartnerContentState.findOneAndUpdate(
    { key: PARTNER_CONTENT_STATE_KEY },
    {
      $set: {
        isInitialized: true,
        seededDefaults,
        initializedAt: new Date(),
      },
      $setOnInsert: {
        key: PARTNER_CONTENT_STATE_KEY,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
};

const ensureDefaultPartnersInternal = async () => {
  const contentState = await PartnerContentState.findOne({ key: PARTNER_CONTENT_STATE_KEY }).lean();
  if (contentState?.isInitialized) {
    return;
  }

  const existingCount = await Partner.countDocuments();
  if (existingCount === 0) {
    await Partner.insertMany(DEFAULT_PARTNERS);
    await markPartnersInitialized({ seededDefaults: true });
    return;
  }

  await markPartnersInitialized({ seededDefaults: false });
};

export const ensureDefaultPartners = async () => {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = ensureDefaultPartnersInternal()
    .finally(() => {
      initializationPromise = null;
    });

  return initializationPromise;
};

export const getPublicList = async () => {
  await ensureDefaultPartners();

  return Partner.find({ isActive: true })
    .sort({ order: 1, createdAt: 1 });
};

export const getAll = async () => {
  await ensureDefaultPartners();

  return Partner.find()
    .sort({ order: 1, createdAt: 1 });
};

export const getById = async (id) => {
  const partner = await Partner.findById(id);
  if (!partner) {
    throw new Error('Partner not found');
  }

  return partner;
};

export const create = async (data, imageFile) => {
  const count = await Partner.countDocuments();
  const payload = validatePartnerPayload(data, { fallbackOrder: count + 1 });

  const partner = await Partner.create({
    name: payload.name,
    website: payload.website,
    order: payload.order,
    isActive: payload.isActive,
    image: toStoredImagePath(imageFile),
  });

  return partner;
};

export const update = async (id, data, imageFile) => {
  const partner = await Partner.findById(id);
  if (!partner) {
    throw new Error('Partner not found');
  }

  const payload = validatePartnerPayload(data, { fallbackOrder: partner.order });
  const nextImage = toStoredImagePath(imageFile);

  if ((payload.removeImage || nextImage) && partner.image) {
    await deleteImageIfPresent(partner.image);
  }

  partner.name = payload.name;
  partner.website = payload.website;
  partner.order = payload.order;
  partner.isActive = payload.isActive;

  if (nextImage) {
    partner.image = nextImage;
  } else if (payload.removeImage) {
    partner.image = null;
  }

  await partner.save();
  return partner;
};

export const remove = async (id) => {
  const partner = await Partner.findByIdAndDelete(id);
  if (!partner) {
    throw new Error('Partner not found');
  }

  await deleteImageIfPresent(partner.image);
  return partner;
};
