const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const BRAND = {
  primary: '#ec4899',
  primaryDark: '#db2777',
  teal: '#2dd4bf',
  blue: '#3b82f6',
  ink: '#111827',
  body: '#4b5563',
  muted: '#6b7280',
  surface: '#ffffff',
  surfaceSoft: '#f8fafc',
  border: '#e5e7eb',
};

const getPublicBaseUrl = () => {
  const configured = process.env.APP_URL || process.env.FRONTEND_URL || 'https://aiqda.pro';

  try {
    const url = new URL(configured);
    if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
      return 'https://aiqda.pro';
    }
    return configured.replace(/\/$/, '');
  } catch {
    return 'https://aiqda.pro';
  }
};

const getLogoUrl = () => `${getPublicBaseUrl()}/logo.png`;

const buildParagraphs = (lines = []) => lines
  .filter(Boolean)
  .map((line) => `<p style="margin:0 0 16px;color:${BRAND.body};line-height:1.7;">${escapeHtml(line)}</p>`)
  .join('');

const buildHtmlList = (items = []) => {
  if (!items.length) {
    return '';
  }

  return `
    <ul style="margin:0 0 20px;padding-left:18px;color:${BRAND.body};line-height:1.7;">
      ${items.map((item) => `<li style="margin-bottom:8px;">${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
};

const buildHtmlMessage = ({
  greeting,
  headline,
  bodyLines = [],
  listItems = [],
  ctaLabel,
  ctaUrl,
  footerLines = [],
}) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0;padding:0;background-color:${BRAND.surfaceSoft};font-family:Arial,sans-serif;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:680px;background-color:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:28px;overflow:hidden;">
          <tr>
            <td bgcolor="#ffffff" style="padding:28px 32px 24px;background-color:#ffffff;border-bottom:1px solid ${BRAND.border};">
              <img src="cid:aiqda-logo" alt="Aiqda" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;outline:none;text-decoration:none;" />
              <div style="margin-top:22px;font-size:34px;line-height:1.08;font-weight:800;letter-spacing:-0.03em;color:${BRAND.ink};">
                ${escapeHtml(headline)}
              </div>
              <div style="margin-top:18px;width:118px;height:5px;border-radius:999px;background:${BRAND.primary};background-image:linear-gradient(90deg, ${BRAND.primaryDark} 0%, ${BRAND.primary} 58%, ${BRAND.teal} 100%);"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:${BRAND.ink};line-height:1.7;font-size:16px;">${escapeHtml(greeting)}</p>
              ${buildParagraphs(bodyLines)}
              ${buildHtmlList(listItems)}
              ${ctaLabel && ctaUrl ? `
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 18px;">
                  <tr>
                    <td bgcolor="${BRAND.primary}" style="border-radius:14px;background-color:${BRAND.primary};">
                      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-weight:700;border-radius:14px;background:${BRAND.primary};">
                        ${escapeHtml(ctaLabel)}
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px;color:${BRAND.muted};font-size:13px;line-height:1.6;">If the button does not work, copy and paste this link into your browser:<br>${escapeHtml(ctaUrl)}</p>
              ` : ''}
              ${buildParagraphs(footerLines)}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;border-top:1px solid ${BRAND.border};">
                <tr>
                  <td style="padding-top:18px;">
                    <p style="margin:0;color:${BRAND.ink};line-height:1.7;font-weight:700;">Aiqda Team</p>
                    <p style="margin:8px 0 0;color:${BRAND.muted};font-size:13px;line-height:1.6;">
                      This message was sent from info@aiqda.pro. For platform support, our team monitors contact@aiqda.pro.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
`;

const buildTextMessage = ({
  greeting,
  headline,
  bodyLines = [],
  listItems = [],
  ctaLabel,
  ctaUrl,
  footerLines = [],
}) => {
  const parts = [
    headline,
    '',
    greeting,
    '',
    ...bodyLines,
  ];

  if (listItems.length > 0) {
    parts.push('', ...listItems.map((item) => `- ${item}`));
  }

  if (ctaLabel && ctaUrl) {
    parts.push('', `${ctaLabel}: ${ctaUrl}`);
  }

  if (footerLines.length > 0) {
    parts.push('', ...footerLines);
  }

  parts.push('', 'Aiqda Team');
  return parts.join('\n');
};

const buildEmailTemplate = ({ subject, greeting, headline, bodyLines, listItems, ctaLabel, ctaUrl, footerLines }) => ({
  subject,
  text: buildTextMessage({ greeting, headline, bodyLines, listItems, ctaLabel, ctaUrl, footerLines }),
  html: buildHtmlMessage({ greeting, headline, bodyLines, listItems, ctaLabel, ctaUrl, footerLines }),
});

export const buildInstructorApprovalInviteEmail = ({ fullName, setupLink }) => buildEmailTemplate({
  subject: 'Aiqda Creator Application Approved',
  greeting: `Hello ${fullName},`,
  headline: 'Your Creator Application Was Approved',
  bodyLines: [
    'Your creator application has been approved by the Aiqda team.',
    'Use the link below to set your password and activate your creator account.',
    'This invitation link expires in 7 days.',
  ],
  ctaLabel: 'Set Up Your Creator Account',
  ctaUrl: setupLink,
});

export const buildInstructorApplicationReceivedEmail = ({ fullName }) => buildEmailTemplate({
  subject: 'We Received Your Aiqda Creator Application',
  greeting: `Hello ${fullName},`,
  headline: 'Your Creator Application Is In Review',
  bodyLines: [
    'Thank you for applying to join Aiqda as a creator.',
    'Our team received your application and will review your portfolio, materials, and experience.',
    'We will follow up by email once the review is complete.',
  ],
});

export const buildInstructorExistingAccountApprovalEmail = ({ fullName, loginUrl }) => buildEmailTemplate({
  subject: 'Aiqda Creator Access Activated',
  greeting: `Hello ${fullName},`,
  headline: 'Your Creator Access Is Ready',
  bodyLines: [
    'Your creator application has been approved by the Aiqda team.',
    'We attached creator access to your existing account, so you can sign in with your current password.',
  ],
  ctaLabel: 'Sign In to Aiqda',
  ctaUrl: loginUrl,
});

export const buildInstructorRejectionEmail = ({ fullName, reason }) => buildEmailTemplate({
  subject: 'Update on Your Aiqda Creator Application',
  greeting: `Hello ${fullName},`,
  headline: 'Your Creator Application Was Reviewed',
  bodyLines: [
    'Thank you for applying to join Aiqda as a creator.',
    'At the moment, we are not moving forward with this application.',
    reason ? `Review note: ${reason}` : 'You are welcome to apply again in the future when your profile or portfolio changes.',
  ],
});

export const buildStudioApprovalEmail = ({ studioName, meetingUrl }) => buildEmailTemplate({
  subject: 'Aiqda Studio Application Approved',
  greeting: `Hello ${studioName},`,
  headline: 'Your Studio Application Was Approved',
  bodyLines: [
    'Your studio application has been approved by the Aiqda team.',
    'Please use the scheduling link below to book your meeting with us.',
  ],
  ctaLabel: 'Schedule Your Meeting',
  ctaUrl: meetingUrl,
});

export const buildStudioApplicationReceivedEmail = ({ studioName }) => buildEmailTemplate({
  subject: 'We Received Your Aiqda Studio Application',
  greeting: `Hello ${studioName},`,
  headline: 'Your Studio Application Is In Review',
  bodyLines: [
    'Thank you for your interest in partnering with Aiqda.',
    'Our team received your studio application and will review the details you submitted.',
    'We will contact you by email once the review is complete.',
  ],
});

export const buildStudioRejectionEmail = ({ studioName, reason }) => buildEmailTemplate({
  subject: 'Update on Your Aiqda Studio Application',
  greeting: `Hello ${studioName},`,
  headline: 'Your Studio Application Was Reviewed',
  bodyLines: [
    'Thank you for your interest in partnering with Aiqda.',
    'At the moment, we are not moving forward with this studio application.',
    reason ? `Review note: ${reason}` : 'You are welcome to re-apply in the future if your needs or materials change.',
  ],
});

export const buildConsultationBookingConfirmedEmail = ({ recipientName, consultationTitle, zoomLink }) => buildEmailTemplate({
  subject: 'Your Aiqda Consultation Booking Was Confirmed',
  greeting: `Hello ${recipientName},`,
  headline: 'Your Consultation Is Confirmed',
  bodyLines: [
    `Your booking for "${consultationTitle}" has been confirmed by the Aiqda team.`,
    'Use the link below to access the session details or book your slot.',
  ],
  ctaLabel: 'Open Consultation Link',
  ctaUrl: zoomLink,
});

export const buildConsultationBookingReceivedEmail = ({ recipientName, consultationTitle }) => buildEmailTemplate({
  subject: 'We Received Your Aiqda Consultation Booking',
  greeting: `Hello ${recipientName},`,
  headline: 'Your Consultation Request Is Pending Review',
  bodyLines: [
    `We received your booking request for "${consultationTitle}".`,
    'Our team will review your request and contact you once it has been confirmed or updated.',
  ],
});

export const buildConsultationBookingRejectedEmail = ({ recipientName, consultationTitle, reason }) => buildEmailTemplate({
  subject: 'Update on Your Aiqda Consultation Booking',
  greeting: `Hello ${recipientName},`,
  headline: 'Your Consultation Request Was Reviewed',
  bodyLines: [
    `Your booking for "${consultationTitle}" could not be confirmed at this time.`,
    reason ? `Review note: ${reason}` : 'Please reply to this email or submit another request if you would like us to help with a different option.',
  ],
});

export const buildConsultationBookingCancelledEmail = ({ recipientName, consultationTitle }) => buildEmailTemplate({
  subject: 'Your Aiqda Consultation Booking Was Cancelled',
  greeting: `Hello ${recipientName},`,
  headline: 'Your Consultation Booking Was Cancelled',
  bodyLines: [
    `Your booking for "${consultationTitle}" has been cancelled as requested.`,
    'If you still need support, you can submit a new consultation request at any time.',
  ],
});

export const buildSubscriptionActivatedEmail = ({ recipientName, packageName, endDate }) => buildEmailTemplate({
  subject: 'Your Aiqda Subscription Is Active',
  greeting: `Hello ${recipientName},`,
  headline: 'Your Subscription Is Now Active',
  bodyLines: [
    `Your payment for "${packageName}" was completed successfully.`,
    endDate ? `Your access is active until ${endDate}.` : 'Your access has been activated successfully.',
  ],
});

export const buildSubscriptionRenewedEmail = ({ recipientName, packageName, endDate }) => buildEmailTemplate({
  subject: 'Your Aiqda Subscription Renewed Successfully',
  greeting: `Hello ${recipientName},`,
  headline: 'Your Subscription Was Renewed',
  bodyLines: [
    `Your recurring payment for "${packageName}" was processed successfully.`,
    endDate ? `Your renewed access is active until ${endDate}.` : 'Your renewed access is active now.',
  ],
});

export const buildSubscriptionRenewalFailedEmail = ({
  recipientName,
  packageName,
  reason,
  checkoutUrl,
  graceEndsAt,
  nextRetryAt,
  autoRetryEnabled = false,
}) => buildEmailTemplate({
  subject: 'Your Aiqda Subscription Renewal Needs Attention',
  greeting: `Hello ${recipientName},`,
  headline: 'We Could Not Renew Your Subscription',
  bodyLines: [
    `We attempted to renew "${packageName}" automatically, but the payment could not be completed.`,
    reason ? `Reason: ${reason}` : 'Please update your payment method and complete a new checkout to restore access.',
    graceEndsAt ? `Your subscription is in a grace period until ${graceEndsAt}.` : null,
    autoRetryEnabled && nextRetryAt
      ? `We will retry the saved payment method automatically on ${nextRetryAt}.`
      : 'Please update your payment method and complete a new checkout to restore access.',
  ],
  ctaLabel: checkoutUrl ? 'Open Subscription Page' : null,
  ctaUrl: checkoutUrl || null,
});

export const buildSubscriptionGraceExpiredEmail = ({
  recipientName,
  packageName,
  checkoutUrl,
}) => buildEmailTemplate({
  subject: 'Your Aiqda Subscription Has Expired',
  greeting: `Hello ${recipientName},`,
  headline: 'Your Grace Period Has Ended',
  bodyLines: [
    `We were unable to restore payment for "${packageName}" during the grace period.`,
    'Your subscription access has now expired. You can return to the subscription page to start a new checkout whenever you are ready.',
  ],
  ctaLabel: checkoutUrl ? 'Open Subscription Page' : null,
  ctaUrl: checkoutUrl || null,
});

export const buildSubscriptionCancelledEmail = ({
  recipientName,
  packageName,
  endDate,
  checkoutUrl,
}) => buildEmailTemplate({
  subject: 'Your Aiqda Subscription Was Cancelled',
  greeting: `Hello ${recipientName},`,
  headline: 'Your Subscription Was Cancelled',
  bodyLines: [
    `Your subscription for "${packageName}" has been cancelled.`,
    endDate ? `Access remains available until ${endDate}.` : 'If you need access again, you can start a new checkout from your subscription page.',
  ],
  ctaLabel: checkoutUrl ? 'Open Subscription Page' : null,
  ctaUrl: checkoutUrl || null,
});

export const buildContactMessageAcknowledgementEmail = ({ fullName, subjectLine }) => buildEmailTemplate({
  subject: 'We Received Your Aiqda Message',
  greeting: `Hello ${fullName},`,
  headline: 'Your Message Is With Our Team',
  bodyLines: [
    `Thanks for reaching out to Aiqda about "${subjectLine}".`,
    'Our team will review your message and get back to you as soon as possible, usually within one business day.',
  ],
});

export const buildContactMessageAdminNotificationEmail = ({ fullName, email, phone, subjectLine, message }) => buildEmailTemplate({
  subject: `New Contact Us Message: ${subjectLine}`,
  greeting: 'Hello team,',
  headline: 'A New Contact Message Was Submitted',
  bodyLines: [
    'A new Contact Us submission was received through the public site.',
  ],
  listItems: [
    `Name: ${fullName}`,
    `Email: ${email}`,
    `Phone: ${phone || 'Not provided'}`,
    `Subject: ${subjectLine}`,
    `Message: ${message}`,
  ],
});

export const buildWelcomeEmail = ({ fullName }) => buildEmailTemplate({
  subject: 'Welcome to Aiqda',
  greeting: `Hello ${fullName},`,
  headline: 'Welcome to Aiqda',
  bodyLines: [
    'Your account is ready and you can start exploring chapters, consultations, and development content right away.',
    'We are excited to support your growth journey.',
  ],
});

export const buildPasswordResetEmail = ({ fullName, resetUrl }) => buildEmailTemplate({
  subject: 'Reset Your Aiqda Password',
  greeting: `Hello ${fullName},`,
  headline: 'Password Reset Request',
  bodyLines: [
    'We received a request to reset your Aiqda password.',
    'Use link below to choose a new password. This link expires in 1 hour.',
    'If you did not request this change, you can ignore this email.',
  ],
  ctaLabel: 'Reset Password',
  ctaUrl: resetUrl,
});

export const buildPasswordResetConfirmationEmail = ({ fullName }) => buildEmailTemplate({
  subject: 'Your Aiqda Password Was Reset',
  greeting: `Hello ${fullName},`,
  headline: 'Password Updated',
  bodyLines: [
    'Your Aiqda password was updated successfully.',
    'If you did not make this change, contact support immediately.',
  ],
});

export const buildInstructorAccountReadyEmail = ({ fullName, loginUrl }) => buildEmailTemplate({
  subject: 'Your Aiqda Creator Account Is Ready',
  greeting: `Hello ${fullName},`,
  headline: 'Your Creator Account Is Active',
  bodyLines: [
    'Your password has been set and your creator account is now ready to use.',
    'You can sign in anytime from the link below.',
  ],
  ctaLabel: 'Sign In to Aiqda',
  ctaUrl: loginUrl,
});

export const buildSubscriptionRequestReceivedEmail = ({
  recipientName,
  packageName,
  billingLabel,
  amount,
  currency = 'SAR',
}) => buildEmailTemplate({
  subject: 'We Received Your Aiqda Subscription Request',
  greeting: `Hello ${recipientName},`,
  headline: 'Your Subscription Request Is Pending Payment',
  bodyLines: [
    `We received your request for "${packageName}".`,
    'Please complete the secure checkout flow to activate your access and save your card for future subscription renewals.',
  ],
  listItems: [
    billingLabel ? `Billing term: ${billingLabel}` : null,
    amount != null ? `Amount due: ${amount} ${currency}` : null,
  ].filter(Boolean),
});

export const buildSubscriptionRequestAdminNotificationEmail = ({
  recipientName,
  recipientEmail,
  packageName,
  billingLabel,
  amount,
  currency = 'SAR',
}) => buildEmailTemplate({
  subject: `New Subscription Request: ${packageName}`,
  greeting: 'Hello team,',
  headline: 'A New Subscription Request Was Submitted',
  bodyLines: [
    'A member created a new pending subscription and is expected to complete checkout next.',
  ],
  listItems: [
    `Member: ${recipientName}`,
    `Email: ${recipientEmail}`,
    `Package: ${packageName}`,
    billingLabel ? `Billing term: ${billingLabel}` : null,
    amount != null ? `Expected amount: ${amount} ${currency}` : null,
  ].filter(Boolean),
});

export const buildInstructorApplicationAdminNotificationEmail = ({
  fullName,
  email,
  country,
  city,
  specialization,
  websiteOrPortfolio,
}) => buildEmailTemplate({
  subject: `New Creator Application: ${fullName}`,
  greeting: 'Hello team,',
  headline: 'A New Creator Application Was Submitted',
  bodyLines: [
    'A new creator application was submitted and is ready for review.',
  ],
  listItems: [
    `Name: ${fullName}`,
    `Email: ${email}`,
    country ? `Country: ${country}` : null,
    city ? `City: ${city}` : null,
    specialization ? `Specialization: ${specialization}` : null,
    websiteOrPortfolio ? `Portfolio: ${websiteOrPortfolio}` : null,
  ].filter(Boolean),
});

export const buildStudioApplicationAdminNotificationEmail = ({
  studioName,
  contactEmail,
  contactName,
  country,
  city,
  websitePortfolio,
}) => buildEmailTemplate({
  subject: `New Studio Application: ${studioName}`,
  greeting: 'Hello team,',
  headline: 'A New Studio Application Was Submitted',
  bodyLines: [
    'A studio application was submitted and is ready for review.',
  ],
  listItems: [
    `Studio: ${studioName}`,
    contactName ? `Contact: ${contactName}` : null,
    `Email: ${contactEmail}`,
    country ? `Country: ${country}` : null,
    city ? `City: ${city}` : null,
    websitePortfolio ? `Portfolio: ${websitePortfolio}` : null,
  ].filter(Boolean),
});

export const buildConsultationBookingAdminNotificationEmail = ({
  recipientName,
  recipientEmail,
  consultationTitle,
  amount,
  currency = 'SAR',
  priceType,
  paymentReference,
}) => buildEmailTemplate({
  subject: `New Consultation Booking: ${consultationTitle}`,
  greeting: 'Hello team,',
  headline: 'A New Consultation Booking Was Submitted',
  bodyLines: [
    'A member submitted a new consultation booking request.',
  ],
  listItems: [
    `Member: ${recipientName}`,
    `Email: ${recipientEmail}`,
    `Consultation: ${consultationTitle}`,
    priceType ? `Price type: ${priceType}` : null,
    amount != null ? `Amount: ${amount} ${currency}` : null,
    paymentReference ? `Payment reference: ${paymentReference}` : null,
  ].filter(Boolean),
});
