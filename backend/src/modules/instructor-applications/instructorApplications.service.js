import InstructorApplication from './instructorApplication.model.js';
import path from 'path';
import User from '../users/user.model.js';
import { hashPassword } from '../../utils/password.js';
import { generateToken } from '../../utils/jwt.js';
import { sendEmail } from '../../utils/email.js';
import { sendAdminNotificationEmail } from '../../utils/adminNotifications.js';
import {
  CREATOR_AGREEMENT_ERROR_MESSAGE,
  CREATOR_TERMS_VERSION,
  hasAcceptedCreatorAgreement
} from '../../config/creatorTerms.js';
import {
  buildInstructorApprovalInviteEmail,
  buildInstructorApplicationReceivedEmail,
  buildInstructorApplicationAdminNotificationEmail,
  buildInstructorExistingAccountApprovalEmail,
  buildInstructorRejectionEmail
} from '../../utils/emailTemplates.js';
import crypto from 'crypto';
import { normalizeExternalUrl } from '../../utils/url.js';
import { deleteUploadPathIfExists, ensureUploadPathExists } from '../../utils/uploadPaths.js';
import { isBackofficeRole } from '../../utils/roles.js';
import { notify } from '../notifications/notify.js';

const getInstructorSetupBaseUrl = () => {
  const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5000';
  return baseUrl.replace(/\/$/, '');
};

const buildInstructorSetupLink = (token) => {
  return `${getInstructorSetupBaseUrl()}/creator-setup?token=${encodeURIComponent(token)}`;
};

export const create = async (data) => {
  if (!hasAcceptedCreatorAgreement(data.creatorAgreementAccepted)) {
    throw new Error(CREATOR_AGREEMENT_ERROR_MESSAGE);
  }

  const normalizedData = {
    ...data,
    websiteOrPortfolio: normalizeExternalUrl(data.websiteOrPortfolio, {
      fieldLabel: 'Website or portfolio link',
      required: false,
    }),
    creatorTermsVersion: CREATOR_TERMS_VERSION,
    creatorTermsAcceptedAt: new Date(),
  };

  delete normalizedData.creatorAgreementAccepted;

  const application = new InstructorApplication(normalizedData);
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

  const adminNotificationEmail = buildInstructorApplicationAdminNotificationEmail({
    fullName: application.fullName,
    email: application.email,
    country: application.country,
    city: application.city,
    specialization: Array.isArray(application.specialization)
      ? application.specialization.join(', ')
      : application.specialization,
    websiteOrPortfolio: application.websiteOrPortfolio,
  });

  try {
    await sendAdminNotificationEmail({
      replyTo: application.email,
      subject: adminNotificationEmail.subject,
      text: adminNotificationEmail.text,
      html: adminNotificationEmail.html,
    });
  } catch (error) {
    console.error('Failed to send instructor application admin notification email:', error.message);
  }

  await notify.admins({
    type: 'application.creator_submitted',
    title: 'New creator application',
    titleAr: 'طلب صانع محتوى جديد',
    message: `${application.fullName} applied to become a creator.`,
    messageAr: `${application.fullName} تقدّم ليصبح صانع محتوى.`,
    link: '/admin/creator-applications',
    metadata: { applicationId: application._id },
  });

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

export const getApplicationFileDownload = async (id, field) => {
  if (!['cvFile', 'courseMaterialsFile'].includes(field)) {
    throw new Error('Invalid application file field');
  }

  const application = await InstructorApplication.findById(id).select(`${field} fullName`);
  if (!application) {
    throw new Error('Application not found');
  }

  const storedPath = application[field];
  if (!storedPath) {
    throw new Error('Application file not found');
  }

  const extension = path.extname(storedPath) || '';

  return {
    absolutePath: await ensureUploadPathExists(storedPath),
    downloadName: field === 'cvFile'
      ? `instructor-cv-${application._id}${extension}`
      : `course-materials-${application._id}${extension}`,
  };
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
    if (isBackofficeRole(user.role)) {
      throw new Error('This email is already attached to an admin account and cannot be converted automatically.');
    }

    user.role = 'instructor';
    await user.save();

    const loginUrl = `${getInstructorSetupBaseUrl()}/login`;
    const approvalEmail = buildInstructorExistingAccountApprovalEmail({
      fullName: application.fullName,
      loginUrl,
    });
    try {
      await sendEmail({
        to: application.email,
        subject: approvalEmail.subject,
        text: approvalEmail.text,
        html: approvalEmail.html,
      });
    } catch (error) {
      console.error('Failed to send instructor approval email to existing account:', error.message);
    }
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
    try {
      await sendEmail({
        to: application.email,
        subject: approvalEmail.subject,
        text: approvalEmail.text,
        html: approvalEmail.html,
      });
    } catch (error) {
      console.error('Failed to send instructor approval invite email:', error.message);
    }
  }

  application.status = 'approved';
  application.reviewedBy = adminId;
  application.reviewedAt = new Date();
  await application.save();

  await notify.user(user._id, {
    type: 'application.creator_approved',
    title: 'Your creator application was approved',
    titleAr: 'تمت الموافقة على طلب صانع المحتوى',
    message: 'Welcome aboard! You can now create and submit content as a creator.',
    messageAr: 'مرحبًا بك! يمكنك الآن إنشاء المحتوى وإرساله كصانع محتوى.',
    link: '/creator',
    metadata: { applicationId: application._id },
  });

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
  try {
    await sendEmail({
      to: application.email,
      subject: rejectionEmail.subject,
      text: rejectionEmail.text,
      html: rejectionEmail.html,
    });
  } catch (error) {
    console.error('Failed to send instructor rejection email:', error.message);
  }
  await application.save();

  const applicantUser = await User.findOne({ email: application.email }).select('_id').lean();
  if (applicantUser) {
    await notify.user(applicantUser._id, {
      type: 'application.creator_rejected',
      title: 'Update on your creator application',
      titleAr: 'تحديث بخصوص طلب صانع المحتوى',
      message: reason
        ? `Your creator application was not approved: ${reason}`
        : 'Your creator application was not approved at this time.',
      messageAr: reason
        ? `لم تتم الموافقة على طلب صانع المحتوى: ${reason}`
        : 'لم تتم الموافقة على طلب صانع المحتوى في الوقت الحالي.',
      link: '/dashboard',
      metadata: { applicationId: application._id },
    });
  }

  return application;
};

export const remove = async (id) => {
  const application = await InstructorApplication.findById(id);
  if (!application) {
    throw new Error('Application not found');
  }

  await application.deleteOne();

  await Promise.allSettled([
    deleteUploadPathIfExists(application.cvFile),
    deleteUploadPathIfExists(application.courseMaterialsFile),
  ]);

  return application;
};
