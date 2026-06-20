import Redis from 'ioredis';

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

const createMemoryRateLimitStore = () => {
  const records = new Map();

  const cleanupExpiredEntries = () => {
    const now = Date.now();
    for (const [key, record] of records.entries()) {
      if (record.resetAt <= now) {
        records.delete(key);
      }
    }
  };

  const cleanupTimer = setInterval(cleanupExpiredEntries, 60 * 1000);
  cleanupTimer.unref?.();

  return {
    async increment(namespace, clientKey, windowMs) {
      const now = Date.now();
      const key = `${namespace}:${clientKey}`;
      const existingRecord = records.get(key);
      const record = !existingRecord || existingRecord.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : existingRecord;

      record.count += 1;
      records.set(key, record);

      return {
        count: record.count,
        resetAt: record.resetAt,
      };
    },

    async decrement(namespace, clientKey) {
      const key = `${namespace}:${clientKey}`;
      const existingRecord = records.get(key);
      if (!existingRecord) {
        return;
      }

      existingRecord.count = Math.max(existingRecord.count - 1, 0);
      if (existingRecord.count === 0) {
        records.delete(key);
        return;
      }

      records.set(key, existingRecord);
    },

    async clear() {
      records.clear();
    },
  };
};

let redisClientPromise = null;

const getRedisClient = async () => {
  if (redisClientPromise) {
    return redisClientPromise;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required for the Redis-backed rate limiter.');
  }

  const client = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  client.defineCommand('incrementRateLimitWindow', {
    numberOfKeys: 1,
    lua: `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
      end
      local ttl = redis.call('PTTL', KEYS[1])
      if ttl < 0 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
        ttl = tonumber(ARGV[1])
      end
      return { current, ttl }
    `,
  });

  redisClientPromise = client.connect().then(() => client).catch((error) => {
    redisClientPromise = null;
    client.disconnect();
    throw error;
  });

  return redisClientPromise;
};

const createRedisRateLimitStore = () => ({
  async increment(namespace, clientKey, windowMs) {
    const client = await getRedisClient();
    const key = `aiqda:rate-limit:${namespace}:${clientKey}`;
    const [count, ttlMs] = await client.incrementRateLimitWindow(key, String(windowMs));
    const normalizedTtlMs = Number(ttlMs);
    const resetAt = Date.now() + (Number.isFinite(normalizedTtlMs) && normalizedTtlMs > 0 ? normalizedTtlMs : windowMs);

    return {
      count: Number(count),
      resetAt,
    };
  },

  async decrement(namespace, clientKey) {
    const client = await getRedisClient();
    const key = `aiqda:rate-limit:${namespace}:${clientKey}`;
    const nextCount = await client.decr(key);
    if (nextCount <= 0) {
      await client.del(key);
    }
  },

  async clear() {
    // Tests use the in-memory store. Redis-backed environments should expire keys naturally.
  },
});

const shouldUseRedisRateLimitStore = () => {
  if (process.env.RATE_LIMIT_STORE === 'memory') {
    return false;
  }

  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  return Boolean(process.env.REDIS_URL);
};

const memoryRateLimitStore = createMemoryRateLimitStore();
const redisRateLimitStore = createRedisRateLimitStore();

const getRateLimitStore = () => (
  shouldUseRedisRateLimitStore() ? redisRateLimitStore : memoryRateLimitStore
);

export const clearRateLimitStore = async () => {
  await getRateLimitStore().clear();
};

export const createIpRateLimiter = ({
  namespace,
  windowMs,
  max,
  message,
  shouldCountRequest = () => true,
}) => async (req, res, next) => {
  try {
    const now = Date.now();
    const clientKey = getClientKey(req);
    const store = getRateLimitStore();
    const record = await store.increment(namespace, clientKey, windowMs);
    const remaining = Math.max(max - record.count, 0);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

    if (record.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((record.resetAt - now) / 1000))));
      return res.status(429).json({ error: message });
    }

    res.once('finish', () => {
      if (shouldCountRequest(req, res)) {
        return;
      }

      store.decrement(namespace, clientKey).catch((error) => {
        console.error('[rate-limit] Failed to restore request slot:', error);
      });
    });

    next();
  } catch (error) {
    console.error('[rate-limit] Failed to process request limit:', error);
    res.status(503).json({ error: 'Rate limit service is temporarily unavailable.' });
  }
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

export const passwordResetRequestRateLimit = createIpRateLimiter({
  namespace: 'password-reset-request',
  windowMs: parsePositiveInteger(process.env.PASSWORD_RESET_REQUEST_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: parsePositiveInteger(process.env.PASSWORD_RESET_REQUEST_RATE_LIMIT_MAX, 5),
  message: 'Too many password reset requests. Please try again later.',
});

export const passwordResetConfirmRateLimit = createIpRateLimiter({
  namespace: 'password-reset-confirm',
  windowMs: parsePositiveInteger(process.env.PASSWORD_RESET_CONFIRM_RATE_LIMIT_WINDOW_MS, 30 * 60 * 1000),
  max: parsePositiveInteger(process.env.PASSWORD_RESET_CONFIRM_RATE_LIMIT_MAX, 10),
  message: 'Too many password reset attempts. Please try again later.',
});

export const inviteAcceptRateLimit = createIpRateLimiter({
  namespace: 'invite-accept',
  windowMs: parsePositiveInteger(process.env.INVITE_ACCEPT_RATE_LIMIT_WINDOW_MS, 30 * 60 * 1000),
  max: parsePositiveInteger(process.env.INVITE_ACCEPT_RATE_LIMIT_MAX, 10),
  message: 'Too many invite acceptance attempts. Please try again later.',
});

export const authSocialRateLimit = createIpRateLimiter({
  namespace: 'auth-social',
  windowMs: parsePositiveInteger(process.env.AUTH_SOCIAL_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: parsePositiveInteger(process.env.AUTH_SOCIAL_RATE_LIMIT_MAX, 20),
  message: 'Too many social sign-in attempts. Please try again later.',
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
  shouldCountRequest: (_req, res) => res.statusCode >= 200 && res.statusCode < 300,
});

export const studioApplicationRateLimit = createIpRateLimiter({
  namespace: 'studio-application',
  windowMs: parsePositiveInteger(process.env.STUDIO_APPLICATION_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
  max: parsePositiveInteger(process.env.STUDIO_APPLICATION_RATE_LIMIT_MAX, 5),
  message: 'Too many studio applications from this IP. Please try again later.',
  shouldCountRequest: (_req, res) => res.statusCode >= 200 && res.statusCode < 300,
});
