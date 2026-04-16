import { randomUUID } from 'node:crypto';

import User from '../users/user.model.js';
import { generateToken, verifyToken } from '../../utils/jwt.js';

const SOCIAL_STATE_PURPOSE = 'social-auth-state';
const SOCIAL_COMPLETE_PURPOSE = 'social-auth-complete';
const FRONTEND_SOCIAL_CALLBACK_PATH = '/auth/social/callback';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PROVIDERS = {
  google: {
    key: 'google',
    name: 'Google',
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile'],
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    buildAuthParams: () => ({
      prompt: 'select_account',
    }),
  },
  linkedin: {
    key: 'linkedin',
    name: 'LinkedIn',
    authEndpoint: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoEndpoint: 'https://api.linkedin.com/v2/userinfo',
    scopes: ['openid', 'profile', 'email'],
    clientIdEnv: 'LINKEDIN_OAUTH_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_OAUTH_CLIENT_SECRET',
    buildAuthParams: () => ({}),
  },
};

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeEmail = (value) => normalizeString(value).toLowerCase();

const isProviderConfigured = (provider) => {
  if (!provider) {
    return false;
  }

  return Boolean(process.env[provider.clientIdEnv] && process.env[provider.clientSecretEnv]);
};

const getProvider = (providerKey) => {
  const provider = PROVIDERS[providerKey];
  if (!provider) {
    throw new Error('Unsupported social provider');
  }

  if (!isProviderConfigured(provider)) {
    throw new Error(`Social login is not configured for ${provider.name}`);
  }

  return provider;
};

const getFrontendBaseUrl = (requestOrigin) => {
  const baseUrl = process.env.FRONTEND_URL || requestOrigin || 'http://localhost:5000';
  return baseUrl.replace(/\/$/, '');
};

const buildProviderCallbackUrl = (requestOrigin, providerKey) => {
  return `${requestOrigin.replace(/\/$/, '')}/api/auth/social/${providerKey}/callback`;
};

const normalizeRedirectPath = (value) => {
  const trimmed = normalizeString(value);
  if (!trimmed) {
    return '';
  }

  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '';
  }

  if (trimmed.startsWith('/api/')) {
    return '';
  }

  if (trimmed.startsWith(FRONTEND_SOCIAL_CALLBACK_PATH)) {
    return '';
  }

  return trimmed;
};

const getDefaultRedirectPathForRole = (role) => {
  if (role === 'admin') {
    return '/admin';
  }

  if (role === 'instructor') {
    return '/instructor';
  }

  return '/dashboard';
};

const buildSocialCallbackUrl = (requestOrigin, query = {}) => {
  const callbackUrl = new URL(`${getFrontendBaseUrl(requestOrigin)}${FRONTEND_SOCIAL_CALLBACK_PATH}`);

  Object.entries(query).forEach(([key, value]) => {
    const normalizedValue = normalizeString(value);
    if (normalizedValue) {
      callbackUrl.searchParams.set(key, normalizedValue);
    }
  });

  return callbackUrl.toString();
};

const buildStartPath = (providerKey) => `/api/auth/social/${providerKey}/start`;

const buildSocialOnlyLoginMessage = (user) => {
  const linkedProviders = Object.entries(user.authProviders || {})
    .filter(([, details]) => normalizeString(details?.subject))
    .map(([providerKey]) => PROVIDERS[providerKey]?.name)
    .filter(Boolean);

  if (linkedProviders.length === 0) {
    return 'Password sign-in is not available for this account.';
  }

  if (linkedProviders.length === 1) {
    return `This account uses ${linkedProviders[0]} sign-in. Continue with ${linkedProviders[0]}.`;
  }

  return `This account uses social sign-in. Continue with ${linkedProviders.join(' or ')}.`;
};

const buildProviderLinkPayload = (profile) => ({
  subject: profile.subject,
  email: profile.email,
  linkedAt: new Date(),
});

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const exchangeAuthorizationCode = async ({ provider, code, requestOrigin }) => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env[provider.clientIdEnv],
    client_secret: process.env[provider.clientSecretEnv],
    redirect_uri: buildProviderCallbackUrl(requestOrigin, provider.key),
  });

  const response = await fetch(provider.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const payload = await parseJsonSafely(response);
  if (!response.ok || !payload?.access_token) {
    throw new Error(`${provider.name} sign-in could not be completed. Please try again.`);
  }

  return payload;
};

const fetchProviderProfile = async ({ provider, accessToken }) => {
  const response = await fetch(provider.userInfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const payload = await parseJsonSafely(response);
  if (!response.ok || !payload) {
    throw new Error(`${provider.name} sign-in could not be completed. Please try again.`);
  }

  const email = normalizeEmail(payload.email);
  const name = normalizeString(payload.name) || [normalizeString(payload.given_name), normalizeString(payload.family_name)]
    .filter(Boolean)
    .join(' ');
  const profile = {
    provider: provider.key,
    subject: normalizeString(payload.sub),
    email,
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    name: name || (email ? email.split('@')[0] : ''),
    avatar: normalizeString(payload.picture) || null,
  };

  if (!profile.subject) {
    throw new Error(`${provider.name} did not return a valid account identifier.`);
  }

  if (!profile.email || !EMAIL_REGEX.test(profile.email)) {
    throw new Error(`${provider.name} did not return a usable email address for this account.`);
  }

  if (!profile.emailVerified) {
    throw new Error(`Please use a ${provider.name} account with a verified email address.`);
  }

  if (!profile.name) {
    profile.name = 'Aiqda Learner';
  }

  return profile;
};

const upsertUserFromSocialProfile = async (profile) => {
  let user = await User.findOne({ [`authProviders.${profile.provider}.subject`]: profile.subject });

  if (!user) {
    user = await User.findOne({ email: profile.email });
  }

  if (user) {
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    if (user.mustChangePassword) {
      throw new Error('Account setup is still pending. Use your invitation link to finish setting your password.');
    }

    user.authProviders = user.authProviders || {};
    user.authProviders[profile.provider] = buildProviderLinkPayload(profile);

    if (!user.avatar && profile.avatar) {
      user.avatar = profile.avatar;
    }

    if (!normalizeString(user.name) && profile.name) {
      user.name = profile.name;
    }

    await user.save();
    return user;
  }

  user = new User({
    email: profile.email,
    password: null,
    name: profile.name,
    role: 'student',
    avatar: profile.avatar,
    isActive: true,
    mustChangePassword: false,
    authProviders: {
      [profile.provider]: buildProviderLinkPayload(profile),
    },
  });

  await user.save();
  return user;
};

const buildCompletionToken = ({ userId, redirectPath }) => generateToken(
  {
    id: userId,
    purpose: SOCIAL_COMPLETE_PURPOSE,
    redirectPath: normalizeRedirectPath(redirectPath),
  },
  { expiresIn: '10m' }
);

const buildStateToken = ({ providerKey, redirectPath }) => generateToken(
  {
    purpose: SOCIAL_STATE_PURPOSE,
    provider: providerKey,
    redirectPath: normalizeRedirectPath(redirectPath),
    nonce: randomUUID(),
  },
  { expiresIn: '10m' }
);

const readStateToken = (stateToken, providerKey) => {
  if (!stateToken) {
    throw new Error('Sign-in session could not be verified. Please try again.');
  }

  let decoded;
  try {
    decoded = verifyToken(stateToken);
  } catch {
    throw new Error('Sign-in session could not be verified. Please try again.');
  }

  if (decoded.purpose !== SOCIAL_STATE_PURPOSE || decoded.provider !== providerKey) {
    throw new Error('Sign-in session could not be verified. Please try again.');
  }

  return decoded;
};

const mapProviderCallbackError = (provider, errorCode, errorDescription) => {
  const normalizedCode = normalizeString(errorCode);
  if (!normalizedCode) {
    return 'Unable to complete social sign-in. Please try again.';
  }

  if (['access_denied', 'user_cancelled_authorize', 'user_cancelled_login'].includes(normalizedCode)) {
    return `${provider.name} sign-in was cancelled.`;
  }

  const description = normalizeString(errorDescription);
  if (description) {
    return `${provider.name} sign-in failed: ${description}`;
  }

  return `${provider.name} sign-in failed. Please try again.`;
};

export const getAvailableSocialProviders = () => {
  return Object.values(PROVIDERS)
    .filter(isProviderConfigured)
    .map((provider) => ({
      key: provider.key,
      name: provider.name,
      startPath: buildStartPath(provider.key),
    }));
};

export const getSocialLoginStartUrl = ({ providerKey, redirectPath = '', requestOrigin }) => {
  const provider = getProvider(providerKey);
  const stateToken = buildStateToken({
    providerKey,
    redirectPath,
  });

  const authorizationUrl = new URL(provider.authEndpoint);
  authorizationUrl.searchParams.set('client_id', process.env[provider.clientIdEnv]);
  authorizationUrl.searchParams.set('redirect_uri', buildProviderCallbackUrl(requestOrigin, provider.key));
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', provider.scopes.join(' '));
  authorizationUrl.searchParams.set('state', stateToken);

  Object.entries(provider.buildAuthParams()).forEach(([key, value]) => {
    authorizationUrl.searchParams.set(key, value);
  });

  return authorizationUrl.toString();
};

export const handleSocialLoginCallback = async ({
  providerKey,
  requestOrigin,
  query = {},
}) => {
  const provider = getProvider(providerKey);

  if (query.error) {
    return {
      redirectUrl: buildSocialCallbackUrl(requestOrigin, {
        error: mapProviderCallbackError(provider, query.error, query.error_description),
      }),
    };
  }

  try {
    const statePayload = readStateToken(query.state, providerKey);
    const authorizationCode = normalizeString(query.code);
    if (!authorizationCode) {
      throw new Error('No authorization code was returned by the provider.');
    }

    const tokenPayload = await exchangeAuthorizationCode({
      provider,
      code: authorizationCode,
      requestOrigin,
    });

    const providerProfile = await fetchProviderProfile({
      provider,
      accessToken: tokenPayload.access_token,
    });

    const user = await upsertUserFromSocialProfile(providerProfile);
    const completionToken = buildCompletionToken({
      userId: user._id.toString(),
      redirectPath: statePayload.redirectPath || '',
    });

    return {
      redirectUrl: buildSocialCallbackUrl(requestOrigin, {
        token: completionToken,
      }),
    };
  } catch (error) {
    return {
      redirectUrl: buildSocialCallbackUrl(requestOrigin, {
        error: error.message || `${provider.name} sign-in failed. Please try again.`,
      }),
    };
  }
};

export const completeSocialLogin = async ({ token }) => {
  if (!token) {
    throw new Error('Social login token is required');
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    throw new Error('Social login session is invalid or has expired');
  }

  if (decoded.purpose !== SOCIAL_COMPLETE_PURPOSE) {
    throw new Error('Social login session is invalid or has expired');
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    throw new Error('Unable to complete social login for this account');
  }

  if (user.mustChangePassword) {
    throw new Error('Account setup is still pending. Use your invitation link to finish setting your password.');
  }

  const appToken = generateToken({ id: user._id, email: user.email, role: user.role });

  return {
    user,
    token: appToken,
    redirectPath: normalizeRedirectPath(decoded.redirectPath) || getDefaultRedirectPathForRole(user.role),
  };
};

export const getSocialOnlyLoginMessageForUser = (user) => buildSocialOnlyLoginMessage(user);
