import User from '../modules/users/user.model.js';
import { hashPassword } from '../utils/password.js';
import { APPLICATIONS_ADMIN_ROLE } from '../utils/roles.js';

const DEFAULT_REVIEWER_NAME = 'Ebaa';
const DEFAULT_REVIEWER_EMAIL = 'ebaa@aiqda.com';
const DEFAULT_DEVELOPMENT_PASSWORD = 'Ebaa12345!';

const isProduction = (env = process.env) => env.NODE_ENV === 'production';
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeEmail = (value) => normalizeString(value).toLowerCase();

export const getEbaaReviewerSeedConfig = (env = process.env) => {
  const name = normalizeString(env.EBAA_REVIEWER_NAME) || DEFAULT_REVIEWER_NAME;
  const email = normalizeEmail(env.EBAA_REVIEWER_EMAIL) || DEFAULT_REVIEWER_EMAIL;
  const password = normalizeString(env.EBAA_REVIEWER_PASSWORD)
    || (isProduction(env) ? '' : DEFAULT_DEVELOPMENT_PASSWORD);

  return {
    name,
    email,
    password,
    role: APPLICATIONS_ADMIN_ROLE,
  };
};

export const ensureSystemUsers = async (env = process.env) => {
  const reviewer = getEbaaReviewerSeedConfig(env);
  const existingUser = await User.findOne({ email: reviewer.email });

  if (!existingUser) {
    const hashedPassword = await hashPassword(reviewer.password);
    const createdUser = await User.create({
      email: reviewer.email,
      password: hashedPassword,
      name: reviewer.name,
      role: reviewer.role,
      isActive: true,
      mustChangePassword: false,
    });

    return {
      reviewer: {
        created: true,
        updated: false,
        email: createdUser.email,
        role: createdUser.role,
      },
    };
  }

  let updated = false;

  if (existingUser.name !== reviewer.name) {
    existingUser.name = reviewer.name;
    updated = true;
  }

  if (existingUser.role !== reviewer.role) {
    existingUser.role = reviewer.role;
    updated = true;
  }

  if (!existingUser.isActive) {
    existingUser.isActive = true;
    updated = true;
  }

  if ((!existingUser.password || existingUser.mustChangePassword) && reviewer.password) {
    existingUser.password = await hashPassword(reviewer.password);
    existingUser.mustChangePassword = false;
    updated = true;
  }

  if (updated) {
    await existingUser.save();
  }

  return {
    reviewer: {
      created: false,
      updated,
      email: existingUser.email,
      role: existingUser.role,
    },
  };
};
