import ContactMessage from './contactMessage.model.js';
import { sendEmail } from '../../utils/email.js';
import {
  buildContactMessageAcknowledgementEmail,
  buildContactMessageAdminNotificationEmail
} from '../../utils/emailTemplates.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const parseNotificationRecipients = (value = process.env.CONTACT_NOTIFICATION_TO || '') => value
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean);

const validateContactMessagePayload = (data = {}) => {
  const fullName = normalizeString(data.fullName);
  const email = normalizeString(data.email).toLowerCase();
  const phone = normalizeString(data.phone);
  const subject = normalizeString(data.subject);
  const message = normalizeString(data.message);

  if (!fullName) {
    throw new Error('Full name is required');
  }

  if (!email) {
    throw new Error('Email is required');
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new Error('Please provide a valid email address');
  }

  if (!subject) {
    throw new Error('Subject is required');
  }

  if (!message) {
    throw new Error('Message is required');
  }

  if (fullName.length > 120) {
    throw new Error('Full name is too long');
  }

  if (subject.length > 160) {
    throw new Error('Subject is too long');
  }

  if (phone.length > 40) {
    throw new Error('Phone number is too long');
  }

  if (message.length > 5000) {
    throw new Error('Message is too long');
  }

  return {
    fullName,
    email,
    phone,
    subject,
    message
  };
};

export const create = async (data) => {
  const payload = validateContactMessagePayload(data);
  const contactMessage = new ContactMessage(payload);
  await contactMessage.save();

  const acknowledgementEmail = buildContactMessageAcknowledgementEmail({
    fullName: payload.fullName,
    subjectLine: payload.subject,
  });

  try {
    await sendEmail({
      to: payload.email,
      subject: acknowledgementEmail.subject,
      text: acknowledgementEmail.text,
      html: acknowledgementEmail.html,
    });
  } catch (error) {
    console.error('Failed to send contact acknowledgement email:', error.message);
  }

  const notificationRecipients = parseNotificationRecipients();
  if (notificationRecipients.length > 0) {
    const adminNotificationEmail = buildContactMessageAdminNotificationEmail({
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      subjectLine: payload.subject,
      message: payload.message,
    });

    try {
      await sendEmail({
        to: notificationRecipients.join(', '),
        replyTo: payload.email,
        subject: adminNotificationEmail.subject,
        text: adminNotificationEmail.text,
        html: adminNotificationEmail.html,
      });
    } catch (error) {
      console.error('Failed to send contact notification email:', error.message);
    }
  }

  return contactMessage;
};

export const getAll = async (filters = {}) => {
  const query = {};

  if (filters.status === 'read') {
    query.isRead = true;
  }

  if (filters.status === 'unread') {
    query.isRead = false;
  }

  return ContactMessage.find(query)
    .populate('readBy', 'name email')
    .sort({ isRead: 1, createdAt: -1 });
};

export const getById = async (id) => {
  const contactMessage = await ContactMessage.findById(id)
    .populate('readBy', 'name email');

  if (!contactMessage) {
    throw new Error('Contact message not found');
  }

  return contactMessage;
};

export const markAsRead = async (id, adminId) => {
  const contactMessage = await ContactMessage.findById(id);

  if (!contactMessage) {
    throw new Error('Contact message not found');
  }

  contactMessage.isRead = true;
  contactMessage.readAt = new Date();
  contactMessage.readBy = adminId;
  await contactMessage.save();

  return getById(id);
};

export const markAsUnread = async (id) => {
  const contactMessage = await ContactMessage.findById(id);

  if (!contactMessage) {
    throw new Error('Contact message not found');
  }

  contactMessage.isRead = false;
  contactMessage.readAt = null;
  contactMessage.readBy = null;
  await contactMessage.save();

  return contactMessage;
};

export const remove = async (id) => {
  const contactMessage = await ContactMessage.findByIdAndDelete(id);

  if (!contactMessage) {
    throw new Error('Contact message not found');
  }

  return contactMessage;
};
