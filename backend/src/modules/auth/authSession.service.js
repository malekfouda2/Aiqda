import { randomUUID } from 'node:crypto';
import { generateToken, verifyToken } from '../../utils/jwt.js';
import { getDeviceIdFromRequest } from '../../utils/authCookie.js';
import { isBackofficeRole } from '../../utils/roles.js';

const DEFAULT_MAX_AUTH_DEVICES = 2;
const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

export const DEVICE_LIMIT_ERROR_MESSAGE = 'This account can only be used on up to 2 devices. Please sign in from one of your approved devices.';

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getMaxAuthDevices = () => parsePositiveInteger(process.env.MAX_AUTH_DEVICES, DEFAULT_MAX_AUTH_DEVICES);

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

const hasUnlimitedConcurrentAccess = (user) => isBackofficeRole(user?.role);

const normalizeCurrentSessions = (user, now = new Date()) => {
  const sessions = Array.isArray(user.currentSessions) ? user.currentSessions : [];
  const uniqueSessions = [];
  const seenSessionIds = new Set();

  sessions.forEach((session) => {
    if (!session?.sessionId || seenSessionIds.has(session.sessionId) || isSessionExpired(session, now)) {
      return;
    }

    seenSessionIds.add(session.sessionId);
    uniqueSessions.push(session);
  });

  const legacySession = user.currentSession;
  if (legacySession?.sessionId && !seenSessionIds.has(legacySession.sessionId) && !isSessionExpired(legacySession, now)) {
    uniqueSessions.push(legacySession);
  }

  user.currentSessions = uniqueSessions;

  if (legacySession?.sessionId && (
    seenSessionIds.has(legacySession.sessionId)
    || isSessionExpired(legacySession, now)
    || uniqueSessions.some((session) => session.sessionId === legacySession.sessionId)
  )) {
    user.currentSession = null;
  }

  return user.currentSessions;
};

const findSessionById = (user, sessionId, now = new Date()) => {
  if (!sessionId) {
    return null;
  }

  const sessions = normalizeCurrentSessions(user, now);
  return sessions.find((session) => session.sessionId === sessionId) || null;
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
  const knownDeviceId = normalizeDeviceId(deviceContext.deviceId);

  if (hasUnlimitedConcurrentAccess(user)) {
    const deviceId = knownDeviceId || randomUUID();
    const sessionToken = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    return {
      sessionToken,
      deviceId,
    };
  }

  normalizeCurrentSessions(user, now);
  const existingDevice = findAuthorizedDevice(user, knownDeviceId);

  if (!existingDevice && Array.isArray(user.authorizedDevices) && user.authorizedDevices.length >= getMaxAuthDevices()) {
    throw new Error(DEVICE_LIMIT_ERROR_MESSAGE);
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

  user.currentSessions = user.currentSessions.filter((session) => session.deviceId !== deviceId);
  user.currentSessions.push({
    sessionId,
    deviceId,
    startedAt: now,
    lastSeenAt: now,
    expiresAt: getTokenExpiryDate(sessionToken),
  });

  user.currentSession = null;
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
  const session = findSessionById(user, decodedToken.sid, now);

  if (!session) {
    return false;
  }

  if (decodedToken.did && session.deviceId !== decodedToken.did) {
    return false;
  }

  if (isSessionExpired(session, now)) {
    user.currentSessions = (user.currentSessions || []).filter((entry) => entry.sessionId !== session.sessionId);
    if (user.currentSession?.sessionId === session.sessionId) {
      user.currentSession = null;
    }
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
  if (!decodedToken?.sid) {
    return;
  }

  const hadLegacySession = user.currentSession?.sessionId === decodedToken.sid;
  const existingCount = Array.isArray(user.currentSessions) ? user.currentSessions.length : 0;
  user.currentSessions = normalizeCurrentSessions(user).filter((session) => session.sessionId !== decodedToken.sid);

  if (hadLegacySession) {
    user.currentSession = null;
  }

  if (user.currentSessions.length === existingCount && !hadLegacySession) {
    return;
  }

  await user.save();
};
