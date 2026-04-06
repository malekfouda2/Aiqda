const rateLimitStore = new Map();

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getClientKey = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
};

const cleanupExpiredEntries = () => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
};

const cleanupTimer = setInterval(cleanupExpiredEntries, 60 * 1000);
cleanupTimer.unref?.();

export const clearRateLimitStore = () => {
  rateLimitStore.clear();
};

export const createIpRateLimiter = ({
  namespace,
  windowMs,
  max,
  message,
}) => (req, res, next) => {
  const now = Date.now();
  const key = `${namespace}:${getClientKey(req)}`;
  const existingRecord = rateLimitStore.get(key);
  const record = !existingRecord || existingRecord.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : existingRecord;

  record.count += 1;
  rateLimitStore.set(key, record);

  const remaining = Math.max(max - record.count, 0);
  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

  if (record.count > max) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((record.resetAt - now) / 1000))));
    return res.status(429).json({ error: message });
  }

  next();
};

export const authRegisterRateLimit = createIpRateLimiter({
  namespace: 'auth-register',
  windowMs: parsePositiveInteger(process.env.AUTH_REGISTER_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
  max: parsePositiveInteger(process.env.AUTH_REGISTER_RATE_LIMIT_MAX, 5),
  message: 'Too many registration attempts. Please try again later.',
});

export const authLoginRateLimit = createIpRateLimiter({
  namespace: 'auth-login',
  windowMs: parsePositiveInteger(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: parsePositiveInteger(process.env.AUTH_LOGIN_RATE_LIMIT_MAX, 10),
  message: 'Too many login attempts. Please try again later.',
});

export const inviteAcceptRateLimit = createIpRateLimiter({
  namespace: 'invite-accept',
  windowMs: parsePositiveInteger(process.env.INVITE_ACCEPT_RATE_LIMIT_WINDOW_MS, 30 * 60 * 1000),
  max: parsePositiveInteger(process.env.INVITE_ACCEPT_RATE_LIMIT_MAX, 10),
  message: 'Too many invite acceptance attempts. Please try again later.',
});

export const contactSubmissionRateLimit = createIpRateLimiter({
  namespace: 'contact-submit',
  windowMs: parsePositiveInteger(process.env.CONTACT_SUBMISSION_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
  max: parsePositiveInteger(process.env.CONTACT_SUBMISSION_RATE_LIMIT_MAX, 5),
  message: 'Too many contact submissions. Please try again later.',
});

export const instructorApplicationRateLimit = createIpRateLimiter({
  namespace: 'instructor-application',
  windowMs: parsePositiveInteger(process.env.INSTRUCTOR_APPLICATION_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
  max: parsePositiveInteger(process.env.INSTRUCTOR_APPLICATION_RATE_LIMIT_MAX, 5),
  message: 'Too many instructor applications from this IP. Please try again later.',
});

export const studioApplicationRateLimit = createIpRateLimiter({
  namespace: 'studio-application',
  windowMs: parsePositiveInteger(process.env.STUDIO_APPLICATION_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
  max: parsePositiveInteger(process.env.STUDIO_APPLICATION_RATE_LIMIT_MAX, 5),
  message: 'Too many studio applications from this IP. Please try again later.',
});
