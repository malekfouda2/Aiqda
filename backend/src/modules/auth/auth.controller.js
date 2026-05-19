import * as authService from './auth.service.js';
import * as socialAuthService from './socialAuth.service.js';
import { buildDeviceContextFromRequest, DEVICE_LIMIT_ERROR_MESSAGE } from './authSession.service.js';
import { clearAuthCookie, getAuthTokenFromRequest, setAuthCookie, setDeviceCookie } from '../../utils/authCookie.js';

const isAuthValidationError = (message) => [
  'Name is required',
  'Email is required',
  'Password is required',
  'Password must be at least 8 characters',
  'Please provide a valid email address',
  'Social login token is required',
  'Social login session is invalid or has expired',
].includes(message);

const isAuthAccessRestrictionError = (message) => [
  DEVICE_LIMIT_ERROR_MESSAGE,
].includes(message);

const isSocialProviderError = (message) => [
  'Unsupported social provider',
  'Social login is not configured for Google',
  'Social login is not configured for LinkedIn',
].includes(message);

const normalizeConfiguredOrigin = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
};

const getFirstForwardedValue = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.split(',')[0]?.trim() || '';
};

const getCloudflareForwardedProtocol = (req) => {
  const visitorHeader = req.get('cf-visitor');
  if (!visitorHeader) {
    return '';
  }

  try {
    const parsed = JSON.parse(visitorHeader);
    return typeof parsed?.scheme === 'string' ? parsed.scheme.trim() : '';
  } catch {
    return '';
  }
};

const getRequestOrigin = (req) => {
  const configuredOrigin = normalizeConfiguredOrigin(
    process.env.APP_URL
    || process.env.BACKEND_PUBLIC_URL
    || process.env.PUBLIC_BASE_URL
  );

  if (configuredOrigin) {
    return configuredOrigin;
  }

  const forwardedProtocol = getFirstForwardedValue(req.get('x-forwarded-proto'))
    || getCloudflareForwardedProtocol(req)
    || req.protocol;
  const forwardedHost = getFirstForwardedValue(req.get('x-forwarded-host')) || req.get('host');

  return `${forwardedProtocol}://${forwardedHost}`;
};
const getFrontendBaseUrl = (req) => (process.env.FRONTEND_URL || getRequestOrigin(req)).replace(/\/$/, '');

export const register = async (req, res) => {
  try {
    const { email, password, name, role, platformNoticeAccepted } = req.body;
    const result = await authService.register({
      email,
      password,
      name,
      role,
      platformNoticeAccepted,
      deviceContext: buildDeviceContextFromRequest(req),
    });
    setAuthCookie(req, res, result.sessionToken);
    setDeviceCookie(req, res, result.deviceId);
    res.status(201).json({ user: result.user });
  } catch (error) {
    res.status(isAuthAccessRestrictionError(error.message) ? 403 : 400).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({
      email,
      password,
      deviceContext: buildDeviceContextFromRequest(req),
    });
    setAuthCookie(req, res, result.sessionToken);
    setDeviceCookie(req, res, result.deviceId);
    res.json({ user: result.user });
  } catch (error) {
    if (isAuthValidationError(error.message)) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (isAuthAccessRestrictionError(error.message)) {
      res.status(403).json({ error: error.message });
      return;
    }

    res.status(401).json({ error: error.message });
  }
};

export const logout = async (req, res) => {
  await authService.logout(getAuthTokenFromRequest(req));
  clearAuthCookie(req, res);
  res.status(204).send();
};

export const getProfile = async (req, res) => {
  try {
    const user = await authService.getProfile(req.user.id);
    res.json(user);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const acceptInstructorInvite = async (req, res) => {
  try {
    const result = await authService.acceptInstructorInvite(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getSocialProviders = async (req, res) => {
  res.json(socialAuthService.getAvailableSocialProviders());
};

export const startSocialLogin = async (req, res) => {
  try {
    const authorizationUrl = socialAuthService.getSocialLoginStartUrl({
      providerKey: req.params.provider,
      redirectPath: req.query.redirect,
      requestOrigin: getRequestOrigin(req),
    });

    res.redirect(302, authorizationUrl);
  } catch (error) {
    const statusCode = isSocialProviderError(error.message) ? 400 : 500;
    res.status(statusCode).json({ error: error.message });
  }
};

export const handleSocialCallback = async (req, res) => {
  try {
    const { redirectUrl } = await socialAuthService.handleSocialLoginCallback({
      providerKey: req.params.provider,
      requestOrigin: getRequestOrigin(req),
      query: req.query,
    });

    res.redirect(302, redirectUrl);
  } catch (error) {
    const fallbackMessage = isSocialProviderError(error.message)
      ? error.message
      : 'Social sign-in could not be completed. Please try again.';

    res.redirect(
      302,
      `${getFrontendBaseUrl(req)}/auth/social/callback?error=${encodeURIComponent(fallbackMessage)}`
    );
  }
};

export const completeSocialLogin = async (req, res) => {
  try {
    const result = await socialAuthService.completeSocialLogin({
      ...req.body,
      deviceContext: buildDeviceContextFromRequest(req),
    });
    setAuthCookie(req, res, result.sessionToken);
    setDeviceCookie(req, res, result.deviceId);
    res.json({
      user: result.user,
      redirectPath: result.redirectPath,
    });
  } catch (error) {
    if (isAuthValidationError(error.message)) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (isAuthAccessRestrictionError(error.message)) {
      res.status(403).json({ error: error.message });
      return;
    }

    res.status(401).json({ error: error.message });
  }
};
