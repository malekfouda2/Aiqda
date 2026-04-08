import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import TeamMember from './teamMember.model.js';
import TeamMemberContentState from './teamMemberContentState.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, '../../uploads');
const TEAM_MEMBER_CONTENT_STATE_KEY = 'team-members-defaults-v1';
let initializationPromise = null;

const DEFAULT_TEAM_MEMBERS = [
  {
    name: 'Abdulwahed Alabdlee',
    title: 'Managing Partner & Trainer Consultant',
    order: 1,
    isActive: true,
    achievements: [
      'Currently serving as the Chairman of the Animation Society in Saudi Arabia since 2021.',
      'Honored by the U.S. Embassy in Saudi Arabia for contributing in the Gaming Development Workshop.',
      'Received international awards for outstanding contributions in the film industry.',
      'Co-director of Captain Munch which won several awards: Animatex, Animex Awards, 11th Showreel: Effat International Student Film Festival, Rassam International Short Film Festival.',
    ],
  },
  {
    name: 'Michael Murengezi',
    title: 'Education Partner & Trainer',
    order: 2,
    isActive: true,
    achievements: [
      'Worked as a Story Artist at Triggerfish Studios, Netflix.',
      'Honored by the Animation Society in Saudi Arabia with a trophy for participation.',
      'Director of Captain Munch which won several awards: Animatex, Animex Awards, 11th Showreel: Effat International Student Film Festival, Rassam International Short Film Festival.',
    ],
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

const normalizeAchievements = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => normalizeString(item))
          .filter(Boolean);
      }
    } catch {
      return trimmed
        .split('\n')
        .map((item) => normalizeString(item))
        .filter(Boolean);
    }
  }

  return [];
};

const normalizeOrder = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toStoredImagePath = (file) => {
  if (!file?.filename) {
    return null;
  }

  return `/uploads/team-members/${file.filename}`;
};

const deleteImageIfPresent = async (storedPath) => {
  if (!storedPath) {
    return;
  }

  const relativePath = storedPath.replace(/^\/uploads\/?/, '');
  const absolutePath = path.join(uploadsRoot, relativePath);

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to delete team member image:', error.message);
    }
  }
};

const validateTeamMemberPayload = (data = {}, { fallbackOrder = 0 } = {}) => {
  const name = normalizeString(data.name);
  const title = normalizeString(data.title);
  const achievements = normalizeAchievements(data.achievements);
  const order = normalizeOrder(data.order, fallbackOrder);
  const isActive = parseBoolean(data.isActive, true);
  const removeImage = parseBoolean(data.removeImage, false);

  if (!name) {
    throw new Error('Name is required');
  }

  if (!title) {
    throw new Error('Title is required');
  }

  if (name.length > 120) {
    throw new Error('Name is too long');
  }

  if (title.length > 160) {
    throw new Error('Title is too long');
  }

  if (achievements.length > 8) {
    throw new Error('A maximum of 8 achievements is allowed');
  }

  if (achievements.some((item) => item.length > 500)) {
    throw new Error('Each achievement must be 500 characters or less');
  }

  return {
    name,
    title,
    achievements,
    order,
    isActive,
    removeImage,
  };
};

const markTeamMembersInitialized = async ({ seededDefaults }) => {
  await TeamMemberContentState.findOneAndUpdate(
    { key: TEAM_MEMBER_CONTENT_STATE_KEY },
    {
      $set: {
        isInitialized: true,
        seededDefaults,
        initializedAt: new Date(),
      },
      $setOnInsert: {
        key: TEAM_MEMBER_CONTENT_STATE_KEY,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
};

const ensureDefaultTeamMembersInternal = async () => {
  const contentState = await TeamMemberContentState.findOne({ key: TEAM_MEMBER_CONTENT_STATE_KEY }).lean();
  if (contentState?.isInitialized) {
    return;
  }

  const existingCount = await TeamMember.countDocuments();
  if (existingCount === 0) {
    await TeamMember.insertMany(DEFAULT_TEAM_MEMBERS);
    await markTeamMembersInitialized({ seededDefaults: true });
    return;
  }

  await markTeamMembersInitialized({ seededDefaults: false });
};

export const ensureDefaultTeamMembers = async () => {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = ensureDefaultTeamMembersInternal()
    .finally(() => {
      initializationPromise = null;
    });

  return initializationPromise;
};

export const getPublicList = async () => {
  await ensureDefaultTeamMembers();

  return TeamMember.find({ isActive: true })
    .sort({ order: 1, createdAt: 1 });
};

export const getAll = async () => {
  await ensureDefaultTeamMembers();

  return TeamMember.find()
    .sort({ order: 1, createdAt: 1 });
};

export const getById = async (id) => {
  const teamMember = await TeamMember.findById(id);
  if (!teamMember) {
    throw new Error('Team member not found');
  }

  return teamMember;
};

export const create = async (data, imageFile) => {
  const count = await TeamMember.countDocuments();
  const payload = validateTeamMemberPayload(data, { fallbackOrder: count + 1 });

  const teamMember = await TeamMember.create({
    name: payload.name,
    title: payload.title,
    achievements: payload.achievements,
    order: payload.order,
    isActive: payload.isActive,
    image: toStoredImagePath(imageFile),
  });

  return teamMember;
};

export const update = async (id, data, imageFile) => {
  const teamMember = await TeamMember.findById(id);
  if (!teamMember) {
    throw new Error('Team member not found');
  }

  const payload = validateTeamMemberPayload(data, { fallbackOrder: teamMember.order });
  const nextImage = toStoredImagePath(imageFile);

  if ((payload.removeImage || nextImage) && teamMember.image) {
    await deleteImageIfPresent(teamMember.image);
  }

  teamMember.name = payload.name;
  teamMember.title = payload.title;
  teamMember.achievements = payload.achievements;
  teamMember.order = payload.order;
  teamMember.isActive = payload.isActive;

  if (nextImage) {
    teamMember.image = nextImage;
  } else if (payload.removeImage) {
    teamMember.image = null;
  }

  await teamMember.save();
  return teamMember;
};

export const remove = async (id) => {
  const teamMember = await TeamMember.findByIdAndDelete(id);
  if (!teamMember) {
    throw new Error('Team member not found');
  }

  await deleteImageIfPresent(teamMember.image);
  return teamMember;
};
