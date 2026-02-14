import InstructorApplication from './instructorApplication.model.js';
import User from '../users/user.model.js';
import { hashPassword } from '../../utils/password.js';

export const create = async (data) => {
  const application = new InstructorApplication(data);
  await application.save();
  return application;
};

export const getAll = async (filters) => {
  const query = {};
  if (filters && filters.status) {
    query.status = filters.status;
  }
  return InstructorApplication.find(query)
    .populate('reviewedBy', 'name email')
    .sort({ createdAt: -1 });
};

export const getById = async (id) => {
  const application = await InstructorApplication.findById(id)
    .populate('reviewedBy', 'name email');
  if (!application) {
    throw new Error('Application not found');
  }
  return application;
};

export const approve = async (id, adminId) => {
  const application = await InstructorApplication.findById(id);
  if (!application) {
    throw new Error('Application not found');
  }

  if (application.status !== 'pending') {
    throw new Error('Application has already been reviewed');
  }

  application.status = 'approved';
  application.reviewedBy = adminId;
  application.reviewedAt = new Date();
  await application.save();

  let user = await User.findOne({ email: application.email });
  if (user) {
    user.role = 'instructor';
    await user.save();
  } else {
    const hashedPassword = await hashPassword('Temp1234!');
    user = new User({
      email: application.email,
      password: hashedPassword,
      name: application.fullName,
      role: 'instructor'
    });
    await user.save();
  }

  return { application, user };
};

export const reject = async (id, adminId, reason) => {
  const application = await InstructorApplication.findById(id);
  if (!application) {
    throw new Error('Application not found');
  }

  if (application.status !== 'pending') {
    throw new Error('Application has already been reviewed');
  }

  application.status = 'rejected';
  application.reviewedBy = adminId;
  application.reviewedAt = new Date();
  application.rejectionReason = reason;
  await application.save();

  return application;
};
