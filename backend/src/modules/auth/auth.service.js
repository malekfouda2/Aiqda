import { createHash, randomBytes } from 'node:crypto';
import User from '../users/user.model.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { verifyToken } from '../../utils/jwt.js';
import { getSocialOnlyLoginMessageForUser } from './socialAuth.service.js';
import { clearAuthenticatedSessionForUser, createAuthenticatedSessionForUser } from './authSession.service.js';
import { sendEmail } from '../../utils/email.js';
import {
  buildInstructorAccountReadyEmail,
  buildPasswordResetConfirmationEmail,
  buildPasswordResetEmail,
  buildWelcomeEmail
} from '../../utils/emailTemplates.js';
import {
  hasAcceptedPlatformNoticeInput,
  PLATFORM_NOTICE_ERROR_MESSAGE,
  PLATFORM_NOTICE_VERSION,
} from '../../config/platformNotice.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_RESPONSE_MESSAGE = 'If account exists for this email, password reset instructions were sent.';

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const normalizeName = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeToken = (value) => (typeof value === 'string' ? value.trim() : '');
const hashResetToken = (token) => createHash('sha256').update(token).digest('hex');
const getFrontendBaseUrl = () => (
  process.env.FRONTEND_URL
  || process.env.APP_URL
  || 'http://localhost:5000'
).replace(/\/$/, '');

export const register = async ({ email, password, name, platformNoticeAccepted, deviceContext }) => {
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

  if (!hasAcceptedPlatformNoticeInput(platformNoticeAccepted)) {
    throw new Error(PLATFORM_NOTICE_ERROR_MESSAGE);
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
    role: 'student',
    platformNoticeAcknowledgement: {
      version: PLATFORM_NOTICE_VERSION,
      acceptedAt: new Date(),
    },
  });

  const { sessionToken, deviceId } = await createAuthenticatedSessionForUser(user, deviceContext);

  const welcomeEmail = buildWelcomeEmail({ fullName: user.name });
  try {
    await sendEmail({
      to: user.email,
      subject: welcomeEmail.subject,
      text: welcomeEmail.text,
      html: welcomeEmail.html,
    });
  } catch (error) {
    console.error('Failed to send welcome email after registration:', error.message);
  }
  
  return { user, sessionToken, deviceId };
};

export const login = async ({ email, password, deviceContext }) => {
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

  if (!user.password) {
    throw new Error(getSocialOnlyLoginMessageForUser(user));
  }

  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    throw new Error('Invalid email or password');
  }

  const { sessionToken, deviceId } = await createAuthenticatedSessionForUser(user, deviceContext);
  
  return { user, sessionToken, deviceId };
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

  const loginUrl = `${(process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5000').replace(/\/$/, '')}/login`;
  const accountReadyEmail = buildInstructorAccountReadyEmail({
    fullName: user.name,
    loginUrl,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: accountReadyEmail.subject,
      text: accountReadyEmail.text,
      html: accountReadyEmail.html,
    });
  } catch (error) {
    console.error('Failed to send instructor account ready email:', error.message);
  }

  return {
    message: 'Your creator account is ready. You can now sign in.',
  };
};

export const requestPasswordReset = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error('Email is required');
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new Error('Please provide a valid email address');
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || !user.isActive) {
    return { message: PASSWORD_RESET_RESPONSE_MESSAGE };
  }

  const resetToken = randomBytes(32).toString('hex');
  const now = new Date();

  user.passwordReset = {
    tokenHash: hashResetToken(resetToken),
    requestedAt: now,
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS),
  };
  await user.save();

  const resetUrl = `${getFrontendBaseUrl()}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const resetEmail = buildPasswordResetEmail({
    fullName: user.name,
    resetUrl,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: resetEmail.subject,
      text: resetEmail.text,
      html: resetEmail.html,
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error.message);
  }

  return { message: PASSWORD_RESET_RESPONSE_MESSAGE };
};

export const resetPassword = async ({ token, password }) => {
  const normalizedToken = normalizeToken(token);

  if (!normalizedToken) {
    throw new Error('Reset token is required');
  }

  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const tokenHash = hashResetToken(normalizedToken);
  const user = await User.findOne({
    'passwordReset.tokenHash': tokenHash,
  });

  if (!user) {
    throw new Error('Password reset link is invalid or has expired');
  }

  const expiresAt = user.passwordReset?.expiresAt ? new Date(user.passwordReset.expiresAt) : null;
  if (!expiresAt || expiresAt <= new Date()) {
    user.passwordReset = null;
    await user.save();
    throw new Error('Password reset link is invalid or has expired');
  }

  user.password = await hashPassword(password);
  user.mustChangePassword = false;
  user.passwordReset = null;
  user.currentSession = null;
  user.currentSessions = [];
  await user.save();

  const confirmationEmail = buildPasswordResetConfirmationEmail({
    fullName: user.name,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: confirmationEmail.subject,
      text: confirmationEmail.text,
      html: confirmationEmail.html,
    });
  } catch (error) {
    console.error('Failed to send password reset confirmation email:', error.message);
  }

  return {
    message: 'Password reset successful. You can now sign in.',
  };
};

export const logout = async (sessionToken) => {
  if (!sessionToken) {
    return;
  }

  let decodedToken = null;
  try {
    decodedToken = verifyToken(sessionToken);
  } catch {
    return;
  }

  if (!decodedToken?.sid) {
    return;
  }

  const user = await User.findById(decodedToken.id);
  if (!user) {
    return;
  }

  await clearAuthenticatedSessionForUser(user, decodedToken);
};
