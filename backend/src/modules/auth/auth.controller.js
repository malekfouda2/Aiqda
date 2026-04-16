import * as authService from './auth.service.js';
import * as socialAuthService from './socialAuth.service.js';

const isAuthValidationError = (message) => [
  'Name is required',
  'Email is required',
  'Password is required',
  'Password must be at least 8 characters',
  'Please provide a valid email address',
  'Social login token is required',
  'Social login session is invalid or has expired',
].includes(message);

const isSocialProviderError = (message) => [
  'Unsupported social provider',
  'Social login is not configured for Google',
  'Social login is not configured for LinkedIn',
].includes(message);

const getRequestOrigin = (req) => `${req.protocol}://${req.get('host')}`;
const getFrontendBaseUrl = (req) => (process.env.FRONTEND_URL || getRequestOrigin(req)).replace(/\/$/, '');

export const register = async (req, res) => {
  try {
    const { email, password, name, role, platformNoticeAccepted } = req.body;
    const result = await authService.register({ email, password, name, role, platformNoticeAccepted });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.json(result);
  } catch (error) {
    res.status(isAuthValidationError(error.message) ? 400 : 401).json({ error: error.message });
  }
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
    const result = await socialAuthService.completeSocialLogin(req.body);
    res.json(result);
  } catch (error) {
    res.status(isAuthValidationError(error.message) ? 400 : 401).json({ error: error.message });
  }
};
