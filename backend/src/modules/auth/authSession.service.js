import { randomUUID } from 'node:crypto';
import { generateToken, verifyToken } from '../../utils/jwt.js';
import { getDeviceIdFromRequest } from '../../utils/authCookie.js';

const DEFAULT_MAX_AUTH_DEVICES = 2;
const DEFAULT_ACTIVE_SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

export const DEVICE_LIMIT_ERROR_MESSAGE = 'This account can only be used on up to 2 devices. Please sign in from one of your approved devices.';
export const CONCURRENT_SESSION_ERROR_MESSAGE = 'This account is already active on another device. Please sign out there first and try again.';

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getMaxAuthDevices = () => parsePositiveInteger(process.env.MAX_AUTH_DEVICES, DEFAULT_MAX_AUTH_DEVICES);
const getActiveSessionIdleTimeoutMs = () => parsePositiveInteger(
  process.env.AUTH_ACTIVE_SESSION_IDLE_TIMEOUT_MS,
  DEFAULT_ACTIVE_SESSION_IDLE_TIMEOUT_MS
);

const normalizeDeviceId = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const normalizeUserAgent = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 512);
};

const normalizeIpAddress = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 128);
};

const toDate = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getTokenExpiryDate = (token) => {
  const decoded = verifyToken(token);

  if (!decoded?.exp) {
    return null;
  }

  return new Date(decoded.exp * 1000);
};

const isSessionExpired = (session, now = new Date()) => {
  const expiresAt = toDate(session?.expiresAt);
  return !expiresAt || expiresAt <= now;
};

const isSessionActivelyInUse = (session, now = new Date()) => {
  if (!session?.sessionId || isSessionExpired(session, now)) {
    return false;
  }

  const lastSeenAt = toDate(session.lastSeenAt) || toDate(session.startedAt);
  if (!lastSeenAt) {
    return false;
  }

  return now.getTime() - lastSeenAt.getTime() <= getActiveSessionIdleTimeoutMs();
};

const findAuthorizedDevice = (user, deviceId) => {
  if (!Array.isArray(user.authorizedDevices) || !deviceId) {
    return null;
  }

  return user.authorizedDevices.find((entry) => entry.deviceId === deviceId) || null;
};

const upsertAuthorizedDevice = (user, deviceId, metadata = {}, now = new Date()) => {
  if (!Array.isArray(user.authorizedDevices)) {
    user.authorizedDevices = [];
  }

  let deviceRecord = findAuthorizedDevice(user, deviceId);

  if (!deviceRecord) {
    deviceRecord = {
      deviceId,
      firstSeenAt: now,
    };
    user.authorizedDevices.push(deviceRecord);
  }

  deviceRecord.lastSeenAt = now;
  deviceRecord.lastLoginAt = now;

  const normalizedUserAgent = normalizeUserAgent(metadata.userAgent);
  if (normalizedUserAgent) {
    deviceRecord.lastUserAgent = normalizedUserAgent;
  }

  const normalizedIpAddress = normalizeIpAddress(metadata.ipAddress);
  if (normalizedIpAddress) {
    deviceRecord.lastIpAddress = normalizedIpAddress;
  }
};

const clearExpiredSessionIfNeeded = (user, now = new Date()) => {
  if (user?.currentSession?.sessionId && isSessionExpired(user.currentSession, now)) {
    user.currentSession = null;
    return true;
  }

  return false;
};

export const buildDeviceContextFromRequest = (req) => ({
  deviceId: normalizeDeviceId(getDeviceIdFromRequest(req))
    || normalizeDeviceId(req?.deviceId)
    || '',
  userAgent: normalizeUserAgent(req?.get?.('user-agent') || req?.headers?.['user-agent']),
  ipAddress: normalizeIpAddress(req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress),
});

export const createAuthenticatedSessionForUser = async (user, deviceContext = {}) => {
  const now = new Date();
  clearExpiredSessionIfNeeded(user, now);

  const knownDeviceId = normalizeDeviceId(deviceContext.deviceId);
  const existingDevice = findAuthorizedDevice(user, knownDeviceId);

  if (!existingDevice && Array.isArray(user.authorizedDevices) && user.authorizedDevices.length >= getMaxAuthDevices()) {
    throw new Error(DEVICE_LIMIT_ERROR_MESSAGE);
  }

  if (user.currentSession?.sessionId && user.currentSession.deviceId !== knownDeviceId && isSessionActivelyInUse(user.currentSession, now)) {
    throw new Error(CONCURRENT_SESSION_ERROR_MESSAGE);
  }

  const deviceId = existingDevice ? existingDevice.deviceId : (knownDeviceId || randomUUID());
  upsertAuthorizedDevice(user, deviceId, deviceContext, now);

  const sessionId = randomUUID();
  const sessionToken = generateToken({
    id: user._id,
    email: user.email,
    role: user.role,
    sid: sessionId,
    did: deviceId,
  });

  user.currentSession = {
    sessionId,
    deviceId,
    startedAt: now,
    lastSeenAt: now,
    expiresAt: getTokenExpiryDate(sessionToken),
  };

  await user.save();

  return {
    sessionToken,
    deviceId,
  };
};

export const validateAuthenticatedSessionForUser = async (user, decodedToken) => {
  if (!decodedToken?.sid) {
    return true;
  }

  const now = new Date();
  const session = user.currentSession;

  if (!session?.sessionId || session.sessionId !== decodedToken.sid) {
    return false;
  }

  if (decodedToken.did && session.deviceId !== decodedToken.did) {
    return false;
  }

  if (isSessionExpired(session, now)) {
    user.currentSession = null;
    await user.save();
    return false;
  }

  const lastSeenAt = toDate(session.lastSeenAt);
  if (!lastSeenAt || now.getTime() - lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS) {
    session.lastSeenAt = now;

    const authorizedDevice = findAuthorizedDevice(user, session.deviceId);
    if (authorizedDevice) {
      authorizedDevice.lastSeenAt = now;
    }

    await user.save();
  }

  return true;
};

export const clearAuthenticatedSessionForUser = async (user, decodedToken) => {
  if (!user?.currentSession?.sessionId || !decodedToken?.sid) {
    return;
  }

  if (user.currentSession.sessionId !== decodedToken.sid) {
    return;
  }

  user.currentSession = null;
  await user.save();
};
