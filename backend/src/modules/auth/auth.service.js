import User from '../users/user.model.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { generateToken } from '../../utils/jwt.js';

export const register = async ({ email, password, name }) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error('Email already registered');
  }

  const hashedPassword = await hashPassword(password);
  const user = new User({
    email,
    password: hashedPassword,
    name,
    role: 'student'
  });

  await user.save();
  const token = generateToken({ id: user._id, email: user.email, role: user.role });
  
  return { user, token };
};

export const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    throw new Error('Account is deactivated');
  }

  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    throw new Error('Invalid email or password');
  }

  const token = generateToken({ id: user._id, email: user.email, role: user.role });
  
  return { user, token };
};

export const getProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};
