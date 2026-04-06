import 'dotenv/config';
import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production.');
  }

  return 'aiqda-secret-key-change-in-production';
};

export const generateToken = (payload, options = {}) => {
  const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
};

export const verifyToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};
