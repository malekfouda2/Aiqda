const DEFAULT_DEV_JWT_SECRET = 'aiqda-secret-key-change-in-production';

const isProduction = (env = process.env) => env.NODE_ENV === 'production';

const isValidUrl = (value) => {
  if (!value) {
    return false;
  }

  try {
    new URL(value);
    return true;
  } catch (error) {
    return false;
  }
};

const isTruthyFlag = (value) => value === 'true';

const validateEmailList = (value) => {
  if (!value) {
    return true;
  }

  const emails = value.split(',').map((email) => email.trim()).filter(Boolean);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emails.length > 0 && emails.every((email) => emailRegex.test(email));
};

export const validateRuntimeConfig = (env = process.env) => {
  const errors = [];

  if (!env.MONGODB_URI) {
    errors.push('MONGODB_URI is required.');
  }

  if (!env.JWT_SECRET && isProduction(env)) {
    errors.push('JWT_SECRET is required in production.');
  }

  if (env.JWT_SECRET && env.JWT_SECRET === DEFAULT_DEV_JWT_SECRET && isProduction(env)) {
    errors.push('JWT_SECRET must not use the development fallback value in production.');
  }

  if (env.JWT_SECRET && env.JWT_SECRET.length < 24 && isProduction(env)) {
    errors.push('JWT_SECRET must be at least 24 characters in production.');
  }

  if (isProduction(env) && !env.FRONTEND_URL) {
    errors.push('FRONTEND_URL is required in production for invite and notification links.');
  }

  if (env.FRONTEND_URL && !isValidUrl(env.FRONTEND_URL)) {
    errors.push('FRONTEND_URL must be a valid URL.');
  }

  if (isProduction(env) && !env.STUDIO_APPLICATION_MEETING_URL) {
    errors.push('STUDIO_APPLICATION_MEETING_URL is required in production.');
  }

  if (env.STUDIO_APPLICATION_MEETING_URL && !isValidUrl(env.STUDIO_APPLICATION_MEETING_URL)) {
    errors.push('STUDIO_APPLICATION_MEETING_URL must be a valid URL.');
  }

  if (isProduction(env)) {
    const requiredEmailVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'];
    for (const key of requiredEmailVars) {
      if (!env[key]) {
        errors.push(`${key} is required in production for transactional email delivery.`);
      }
    }
  }

  if (env.SMTP_PORT && !Number.isFinite(Number(env.SMTP_PORT))) {
    errors.push('SMTP_PORT must be a valid number.');
  }

  if (env.CONTACT_NOTIFICATION_TO && !validateEmailList(env.CONTACT_NOTIFICATION_TO)) {
    errors.push('CONTACT_NOTIFICATION_TO must contain one or more valid comma-separated email addresses.');
  }

  const autoSeedEnabled = isTruthyFlag(env.AUTO_SEED_DEMO_DATA) || isTruthyFlag(env.AUTO_SEED_CONSULTATIONS);
  const allowProductionAutoSeed = isTruthyFlag(env.ALLOW_PRODUCTION_AUTO_SEED);

  if (isProduction(env) && autoSeedEnabled && !allowProductionAutoSeed) {
    errors.push('AUTO_SEED_DEMO_DATA and AUTO_SEED_CONSULTATIONS must stay disabled in production unless ALLOW_PRODUCTION_AUTO_SEED=true is explicitly set.');
  }

  if (errors.length > 0) {
    throw new Error(`Runtime configuration is invalid:\n- ${errors.join('\n- ')}`);
  }

  return true;
};
