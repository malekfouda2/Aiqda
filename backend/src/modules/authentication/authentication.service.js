import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import Authentication from './authentication.model.js';
import { normalizeExternalUrl } from '../../utils/url.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, '../../uploads');

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

const toStoredImagePath = (file) => {
  if (!file?.filename) {
    return null;
  }

  return `/uploads/authentication/${file.filename}`;
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
      console.error('Failed to delete authentication logo:', error.message);
    }
  }
};

const validatePayload = (data = {}, { fallbackOrder = 0 } = {}) => {
  const name = normalizeString(data.name);
  const website = normalizeExternalUrl(data.website, {
    fieldLabel: 'Website URL',
    required: false,
    maxLength: 500,
  });
  const order = normalizeOrder(data.order, fallbackOrder);
  const isActive = parseBoolean(data.isActive, true);
  const removeImage = parseBoolean(data.removeImage, false);

  if (!name) {
    throw new Error('Authentication name is required');
  }

  if (name.length > 160) {
    throw new Error('Authentication name is too long');
  }

  return { name, website, order, isActive, removeImage };
};

export const getPublicList = async () => (
  Authentication.find({ isActive: true }).sort({ order: 1, createdAt: 1 })
);

export const getAll = async () => (
  Authentication.find().sort({ order: 1, createdAt: 1 })
);

export const getById = async (id) => {
  const item = await Authentication.findById(id);
  if (!item) {
    throw new Error('Authentication item not found');
  }
  return item;
};

export const create = async (data, imageFile) => {
  const count = await Authentication.countDocuments();
  const payload = validatePayload(data, { fallbackOrder: count + 1 });

  return Authentication.create({
    name: payload.name,
    website: payload.website,
    order: payload.order,
    isActive: payload.isActive,
    image: toStoredImagePath(imageFile),
  });
};

export const update = async (id, data, imageFile) => {
  const item = await Authentication.findById(id);
  if (!item) {
    throw new Error('Authentication item not found');
  }

  const payload = validatePayload(data, { fallbackOrder: item.order });
  const nextImage = toStoredImagePath(imageFile);

  if ((payload.removeImage || nextImage) && item.image) {
    await deleteImageIfPresent(item.image);
  }

  item.name = payload.name;
  item.website = payload.website;
  item.order = payload.order;
  item.isActive = payload.isActive;

  if (nextImage) {
    item.image = nextImage;
  } else if (payload.removeImage) {
    item.image = null;
  }

  await item.save();
  return item;
};

export const remove = async (id) => {
  const item = await Authentication.findByIdAndDelete(id);
  if (!item) {
    throw new Error('Authentication item not found');
  }

  await deleteImageIfPresent(item.image);
  return item;
};
