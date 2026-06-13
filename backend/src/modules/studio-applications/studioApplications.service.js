import StudioApplication from './studioApplication.model.js';
import { sendEmail } from '../../utils/email.js';
import { sendAdminNotificationEmail } from '../../utils/adminNotifications.js';
import {
  buildStudioApplicationReceivedEmail,
  buildStudioApplicationAdminNotificationEmail,
  buildStudioApprovalEmail,
  buildStudioRejectionEmail
} from '../../utils/emailTemplates.js';
import { normalizeExternalUrl } from '../../utils/url.js';

const getStudioMeetingUrl = () => {
  const meetingUrl = process.env.STUDIO_APPLICATION_MEETING_URL;
  if (!meetingUrl) {
    throw new Error('Studio meeting link is not configured. Set STUDIO_APPLICATION_MEETING_URL before approving applications.');
  }
  return meetingUrl;
};

export const create = async (data) => {
  const application = new StudioApplication({
    ...data,
    websitePortfolio: normalizeExternalUrl(data.websitePortfolio, {
      fieldLabel: 'Website or portfolio link',
      required: true,
    }),
  });
  await application.save();

  const receivedEmail = buildStudioApplicationReceivedEmail({
    studioName: application.studioName,
  });

  try {
    await sendEmail({
      to: application.contactEmail,
      subject: receivedEmail.subject,
      text: receivedEmail.text,
      html: receivedEmail.html,
    });
  } catch (error) {
    console.error('Failed to send studio application acknowledgement email:', error.message);
  }

  const adminNotificationEmail = buildStudioApplicationAdminNotificationEmail({
    studioName: application.studioName,
    contactEmail: application.contactEmail,
    contactName: application.contactName,
    country: application.country,
    city: application.city,
    websitePortfolio: application.websitePortfolio,
  });

  try {
    await sendAdminNotificationEmail({
      replyTo: application.contactEmail,
      subject: adminNotificationEmail.subject,
      text: adminNotificationEmail.text,
      html: adminNotificationEmail.html,
    });
  } catch (error) {
    console.error('Failed to send studio application admin notification email:', error.message);
  }

  return application;
};

export const getAll = async (filters) => {
  const query = {};
  if (filters && filters.status) {
    query.status = filters.status;
  }
  return StudioApplication.find(query)
    .populate('reviewedBy', 'name email')
    .sort({ createdAt: -1 });
};

export const getById = async (id) => {
  const application = await StudioApplication.findById(id)
    .populate('reviewedBy', 'name email');
  if (!application) {
    throw new Error('Application not found');
  }
  return application;
};

export const approve = async (id, adminId) => {
  const application = await StudioApplication.findById(id);
  if (!application) {
    throw new Error('Application not found');
  }

  if (application.status !== 'pending') {
    throw new Error('Application has already been reviewed');
  }

  if (!application.contactEmail) {
    throw new Error('This studio application is missing a contact email.');
  }

  const meetingUrl = getStudioMeetingUrl();
  const email = buildStudioApprovalEmail({
    studioName: application.studioName,
    meetingUrl,
  });
  let approvalEmailSentAt = null;
  try {
    await sendEmail({
      to: application.contactEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    approvalEmailSentAt = new Date();
  } catch (error) {
    console.error('Failed to send studio approval email:', error.message);
  }

  application.status = 'approved';
  application.reviewedBy = adminId;
  application.reviewedAt = new Date();
  application.approvalEmailSentAt = approvalEmailSentAt;
  await application.save();

  return application;
};

export const reject = async (id, adminId, reason) => {
  const application = await StudioApplication.findById(id);
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

  const rejectionEmail = buildStudioRejectionEmail({
    studioName: application.studioName,
    reason,
  });
  try {
    await sendEmail({
      to: application.contactEmail,
      subject: rejectionEmail.subject,
      text: rejectionEmail.text,
      html: rejectionEmail.html,
    });
  } catch (error) {
    console.error('Failed to send studio rejection email:', error.message);
  }
  await application.save();

  return application;
};

export const remove = async (id) => {
  const application = await StudioApplication.findByIdAndDelete(id);
  if (!application) {
    throw new Error('Application not found');
  }

  return application;
};
