import { verifyToken } from '../utils/jwt.js';
import User from '../modules/users/user.model.js';
import { hasAcceptedCurrentPlatformNotice, PLATFORM_NOTICE_ERROR_MESSAGE } from '../config/platformNotice.js';

const buildRequestUser = (user) => ({
  id: user._id.toString(),
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  platformNoticeAcknowledgement: user.platformNoticeAcknowledgement || null,
});

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

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
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

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

export const isAdmin = authorize('admin');
export const isInstructor = authorize('instructor', 'admin');
export const isStudent = authorize('student', 'instructor', 'admin');

export const requirePlatformNoticeAcknowledgement = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (!hasAcceptedCurrentPlatformNotice(req.user.platformNoticeAcknowledgement)) {
    return res.status(403).json({ error: PLATFORM_NOTICE_ERROR_MESSAGE });
  }

  next();
};
