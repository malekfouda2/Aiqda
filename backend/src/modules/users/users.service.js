import User from './user.model.js';
import { hashPassword } from '../../utils/password.js';

const SELF_UPDATE_FIELDS = new Set(['name', 'avatar', 'password']);
const ADMIN_UPDATE_FIELDS = new Set(['name', 'email', 'avatar', 'password', 'isActive']);

const pickAllowedUpdates = (updates, allowedFields) => {
  return Object.entries(updates).reduce((acc, [key, value]) => {
    if (allowedFields.has(key)) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

export const getAllUsers = async (filters = {}) => {
  const query = {};
  if (filters.role) query.role = filters.role;
  if (filters.isActive !== undefined) query.isActive = filters.isActive;
  
  return User.find(query).sort({ createdAt: -1 });
};

export const getUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

export const updateUser = async (userId, updates, requester) => {
  const isSelfUpdate = requester.id === userId;
  const allowedFields = requester.role === 'admin' && !isSelfUpdate
    ? ADMIN_UPDATE_FIELDS
    : SELF_UPDATE_FIELDS;

  const sanitizedUpdates = pickAllowedUpdates(updates, allowedFields);

  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new Error('No valid fields to update');
  }

  if (sanitizedUpdates.password) {
    sanitizedUpdates.password = await hashPassword(sanitizedUpdates.password);
  }
  
  const user = await User.findByIdAndUpdate(userId, sanitizedUpdates, { new: true });
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

export const toggleUserStatus = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  user.isActive = !user.isActive;
  await user.save();
  return user;
};

export const updateUserRole = async (userId, newRole) => {
  if (!['student', 'instructor', 'admin'].includes(newRole)) {
    throw new Error('Invalid role');
  }
  
  const user = await User.findByIdAndUpdate(userId, { role: newRole }, { new: true });
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};
