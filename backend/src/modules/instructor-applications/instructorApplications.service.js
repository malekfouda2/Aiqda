import InstructorApplication from './instructorApplication.model.js';
import User from '../users/user.model.js';
import { hashPassword } from '../../utils/password.js';
import { generateToken } from '../../utils/jwt.js';
import { sendEmail } from '../../utils/email.js';
import {
  buildInstructorApprovalInviteEmail,
  buildInstructorApplicationReceivedEmail,
  buildInstructorExistingAccountApprovalEmail,
  buildInstructorRejectionEmail
} from '../../utils/emailTemplates.js';
import crypto from 'crypto';

const getInstructorSetupBaseUrl = () => {
  const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5000';
  return baseUrl.replace(/\/$/, '');
};

const buildInstructorSetupLink = (token) => {
  return `${getInstructorSetupBaseUrl()}/instructor-setup?token=${encodeURIComponent(token)}`;
};

export const create = async (data) => {
  const application = new InstructorApplication(data);
  await application.save();

  const receivedEmail = buildInstructorApplicationReceivedEmail({
    fullName: application.fullName,
  });

  try {
    await sendEmail({
      to: application.email,
      subject: receivedEmail.subject,
      text: receivedEmail.text,
      html: receivedEmail.html,
    });
  } catch (error) {
    console.error('Failed to send instructor application acknowledgement email:', error.message);
  }

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

  let setupLink = null;
  let user = await User.findOne({ email: application.email });
  if (user) {
    if (user.role === 'admin') {
      throw new Error('This email is already attached to an admin account and cannot be converted automatically.');
    }

    user.role = 'instructor';
    await user.save();

    const loginUrl = `${getInstructorSetupBaseUrl()}/login`;
    const approvalEmail = buildInstructorExistingAccountApprovalEmail({
      fullName: application.fullName,
      loginUrl,
    });
    await sendEmail({
      to: application.email,
      subject: approvalEmail.subject,
      text: approvalEmail.text,
      html: approvalEmail.html,
    });
  } else {
    const temporaryPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await hashPassword(temporaryPassword);
    user = new User({
      email: application.email,
      password: hashedPassword,
      name: application.fullName,
      role: 'instructor',
      mustChangePassword: true,
    });
    await user.save();

    const inviteToken = generateToken(
      {
        id: user._id,
        purpose: 'instructor-setup',
      },
      { expiresIn: '7d' }
    );

    setupLink = buildInstructorSetupLink(inviteToken);
    const approvalEmail = buildInstructorApprovalInviteEmail({
      fullName: application.fullName,
      setupLink,
    });
    await sendEmail({
      to: application.email,
      subject: approvalEmail.subject,
      text: approvalEmail.text,
      html: approvalEmail.html,
    });
  }

  application.status = 'approved';
  application.reviewedBy = adminId;
  application.reviewedAt = new Date();
  await application.save();

  return { application, user, setupLink };
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

  const rejectionEmail = buildInstructorRejectionEmail({
    fullName: application.fullName,
    reason,
  });
  await sendEmail({
    to: application.email,
    subject: rejectionEmail.subject,
    text: rejectionEmail.text,
    html: rejectionEmail.html,
  });
  await application.save();

  return application;
};
