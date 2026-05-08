const DEFAULT_AUTH_COOKIE_NAME = 'aiqda_auth';
const DEFAULT_AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_DEVICE_COOKIE_NAME = 'aiqda_device';
const DEFAULT_DEVICE_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeSameSite = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';

  if (normalized === 'strict' || normalized === 'none') {
    return normalized;
  }

  return 'lax';
};

const parseCookieHeader = (cookieHeader) => {
  if (typeof cookieHeader !== 'string' || !cookieHeader.trim()) {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) {
        return cookies;
      }

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (!name) {
        return cookies;
      }

      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }

      return cookies;
    }, {});
};

const getAuthCookieName = () => process.env.AUTH_COOKIE_NAME || DEFAULT_AUTH_COOKIE_NAME;
const getDeviceCookieName = () => process.env.DEVICE_COOKIE_NAME || DEFAULT_DEVICE_COOKIE_NAME;

const buildCookieOptions = () => {
  const options = {
    sameSite: normalizeSameSite(process.env.AUTH_COOKIE_SAME_SITE),
    secure: process.env.AUTH_COOKIE_SECURE === 'true' || (
      process.env.AUTH_COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production'
    ),
    path: '/',
  };

  if (process.env.AUTH_COOKIE_DOMAIN) {
    options.domain = process.env.AUTH_COOKIE_DOMAIN;
  }

  return options;
};

export const getAuthTokenFromRequest = (req) => {
  const cookies = parseCookieHeader(req.headers.cookie);
  const cookieToken = cookies[getAuthCookieName()];
  if (cookieToken) {
    return cookieToken;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  return '';
};

export const getDeviceIdFromRequest = (req) => {
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[getDeviceCookieName()] || '';
};

export const setAuthCookie = (req, res, token) => {
  res.cookie(getAuthCookieName(), token, {
    ...buildCookieOptions(req),
    httpOnly: true,
    maxAge: parsePositiveInteger(process.env.AUTH_COOKIE_MAX_AGE_MS, DEFAULT_AUTH_COOKIE_MAX_AGE_MS),
  });
};

export const setDeviceCookie = (req, res, deviceId) => {
  res.cookie(getDeviceCookieName(), deviceId, {
    ...buildCookieOptions(req),
    httpOnly: true,
    maxAge: parsePositiveInteger(process.env.DEVICE_COOKIE_MAX_AGE_MS, DEFAULT_DEVICE_COOKIE_MAX_AGE_MS),
  });
};

export const clearAuthCookie = (req, res) => {
  res.clearCookie(getAuthCookieName(), {
    ...buildCookieOptions(req),
    httpOnly: true,
  });
};
