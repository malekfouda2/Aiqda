import User from '../users/user.model.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { generateToken, verifyToken } from '../../utils/jwt.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const normalizeName = (value) => (typeof value === 'string' ? value.trim() : '');

export const register = async ({ email, password, name }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizeName(name);

  if (!normalizedName) {
    throw new Error('Name is required');
  }

  if (!normalizedEmail) {
    throw new Error('Email is required');
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new Error('Please provide a valid email address');
  }

  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new Error('Email already registered');
  }

  const hashedPassword = await hashPassword(password);
  const user = new User({
    email: normalizedEmail,
    password: hashedPassword,
    name: normalizedName,
    role: 'student'
  });

  await user.save();
  const token = generateToken({ id: user._id, email: user.email, role: user.role });
  
  return { user, token };
};

export const login = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error('Email is required');
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new Error('Please provide a valid email address');
  }

  if (!password) {
    throw new Error('Password is required');
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    throw new Error('Account is deactivated');
  }

  if (user.mustChangePassword) {
    throw new Error('Account setup is still pending. Use your invitation link to finish setting your password.');
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

export const acceptInstructorInvite = async ({ token, password }) => {
  if (!token) {
    throw new Error('Invite token is required');
  }

  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const decoded = verifyToken(token);
  if (decoded.purpose !== 'instructor-setup') {
    throw new Error('Invalid invite token');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new Error('User not found');
  }

  if (!user.mustChangePassword) {
    throw new Error('This invite link has already been used');
  }

  user.password = await hashPassword(password);
  user.mustChangePassword = false;
  user.isActive = true;
  await user.save();

  return {
    message: 'Your instructor account is ready. You can now sign in.',
  };
};
