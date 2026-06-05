import { sendEmail } from './email.js';

export const parseAdminNotificationRecipients = (value = process.env.CONTACT_NOTIFICATION_TO || '') => value
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean);

export const sendAdminNotificationEmail = async ({
  subject,
  text,
  html,
  replyTo,
}) => {
  const recipients = parseAdminNotificationRecipients();
  if (recipients.length === 0) {
    return { delivered: false, recipients: [] };
  }

  await sendEmail({
    to: recipients.join(', '),
    replyTo,
    subject,
    text,
    html,
  });

  return {
    delivered: true,
    recipients,
  };
};
