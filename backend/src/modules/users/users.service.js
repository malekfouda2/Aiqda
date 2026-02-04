import User from './user.model.js';
import { hashPassword } from '../../utils/password.js';

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

export const updateUser = async (userId, updates) => {
  if (updates.password) {
    updates.password = await hashPassword(updates.password);
  }
  
  const user = await User.findByIdAndUpdate(userId, updates, { new: true });
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
