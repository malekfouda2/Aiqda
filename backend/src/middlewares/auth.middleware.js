import { verifyToken } from '../utils/jwt.js';
import User from '../modules/users/user.model.js';
import { hasAcceptedCurrentPlatformNotice, PLATFORM_NOTICE_ERROR_MESSAGE } from '../config/platformNotice.js';
import { getAuthTokenFromRequest } from '../utils/authCookie.js';
import { ADMIN_ROLE, APPLICATION_REVIEW_ROLES, CONTENT_ACCESS_ROLES, INSTRUCTOR_ACCESS_ROLES } from '../utils/roles.js';

const buildRequestUser = (user) => ({
  id: user._id.toString(),
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  platformNoticeAcknowledgement: user.platformNoticeAcknowledgement || null,
});

export const authenticate = async (req, res, next) => {
  const token = getAuthTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select('_id email role isActive platformNoticeAcknowledgement');
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    req.user = buildRequestUser(user);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

export const authenticateOptional = async (req, res, next) => {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return next();
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select('_id email role isActive platformNoticeAcknowledgement');
    req.user = user && user.isActive ? buildRequestUser(user) : null;
  } catch (error) {
    req.user = null;
  }

  next();
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};

export const isAdmin = authorize(ADMIN_ROLE);
export const canReviewApplications = authorize(...APPLICATION_REVIEW_ROLES);
export const isInstructor = authorize(...INSTRUCTOR_ACCESS_ROLES);
export const isStudent = authorize(...CONTENT_ACCESS_ROLES);

export const requirePlatformNoticeAcknowledgement = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (!hasAcceptedCurrentPlatformNotice(req.user.platformNoticeAcknowledgement)) {
    return res.status(403).json({ error: PLATFORM_NOTICE_ERROR_MESSAGE });
  }

  next();
};
