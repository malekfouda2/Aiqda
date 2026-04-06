const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildParagraphs = (lines = []) => lines
  .filter(Boolean)
  .map((line) => `<p style="margin:0 0 16px;color:#4b5563;line-height:1.7;">${escapeHtml(line)}</p>`)
  .join('');

const buildHtmlList = (items = []) => {
  if (!items.length) {
    return '';
  }

  return `
    <ul style="margin:0 0 20px;padding-left:18px;color:#4b5563;line-height:1.7;">
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
  <div style="margin:0;padding:32px 16px;background:#f8fafc;font-family:Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden;">
      <div style="padding:32px;background:linear-gradient(135deg,#eef6ff 0%,#ecfeff 100%);border-bottom:1px solid #e5e7eb;">
        <p style="margin:0 0 10px;color:#0891b2;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Aiqda</p>
        <h1 style="margin:0;color:#111827;font-size:28px;line-height:1.2;">${escapeHtml(headline)}</h1>
      </div>
      <div style="padding:32px;">
        <p style="margin:0 0 16px;color:#111827;line-height:1.7;">${escapeHtml(greeting)}</p>
        ${buildParagraphs(bodyLines)}
        ${buildHtmlList(listItems)}
        ${ctaLabel && ctaUrl ? `
          <div style="margin:28px 0;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 22px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:14px;font-weight:700;">
              ${escapeHtml(ctaLabel)}
            </a>
          </div>
          <p style="margin:0 0 16px;color:#6b7280;font-size:13px;line-height:1.6;">If the button does not work, copy and paste this link into your browser:<br>${escapeHtml(ctaUrl)}</p>
        ` : ''}
        ${buildParagraphs(footerLines)}
        <p style="margin:20px 0 0;color:#111827;line-height:1.7;">Aiqda Team</p>
      </div>
    </div>
  </div>
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
  subject: 'Aiqda Instructor Application Approved',
  greeting: `Hello ${fullName},`,
  headline: 'Your Instructor Application Was Approved',
  bodyLines: [
    'Your instructor application has been approved by the Aiqda team.',
    'Use the link below to set your password and activate your instructor account.',
    'This invitation link expires in 7 days.',
  ],
  ctaLabel: 'Set Up Your Instructor Account',
  ctaUrl: setupLink,
});

export const buildInstructorApplicationReceivedEmail = ({ fullName }) => buildEmailTemplate({
  subject: 'We Received Your Aiqda Instructor Application',
  greeting: `Hello ${fullName},`,
  headline: 'Your Instructor Application Is In Review',
  bodyLines: [
    'Thank you for applying to join Aiqda as an instructor.',
    'Our team received your application and will review your portfolio, materials, and experience.',
    'We will follow up by email once the review is complete.',
  ],
});

export const buildInstructorExistingAccountApprovalEmail = ({ fullName, loginUrl }) => buildEmailTemplate({
  subject: 'Aiqda Instructor Access Activated',
  greeting: `Hello ${fullName},`,
  headline: 'Your Instructor Access Is Ready',
  bodyLines: [
    'Your instructor application has been approved by the Aiqda team.',
    'We attached instructor access to your existing account, so you can sign in with your current password.',
  ],
  ctaLabel: 'Sign In to Aiqda',
  ctaUrl: loginUrl,
});

export const buildInstructorRejectionEmail = ({ fullName, reason }) => buildEmailTemplate({
  subject: 'Update on Your Aiqda Instructor Application',
  greeting: `Hello ${fullName},`,
  headline: 'Your Instructor Application Was Reviewed',
  bodyLines: [
    'Thank you for applying to join Aiqda as an instructor.',
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

export const buildPaymentApprovedEmail = ({ recipientName, packageName, endDate }) => buildEmailTemplate({
  subject: 'Your Aiqda Payment Was Approved',
  greeting: `Hello ${recipientName},`,
  headline: 'Your Subscription Is Now Active',
  bodyLines: [
    `Your payment for "${packageName}" was approved successfully.`,
    endDate ? `Your access is active until ${endDate}.` : 'Your access has been activated successfully.',
  ],
});

export const buildPaymentSubmittedEmail = ({ recipientName, packageName, amount, paymentReference }) => buildEmailTemplate({
  subject: 'We Received Your Aiqda Payment Submission',
  greeting: `Hello ${recipientName},`,
  headline: 'Your Payment Is Pending Review',
  bodyLines: [
    `We received your payment submission for "${packageName}".`,
    'Our team will review the payment proof and update your subscription once the review is complete.',
  ],
  listItems: [
    amount != null ? `Amount: ${amount} SAR` : null,
    paymentReference ? `Reference: ${paymentReference}` : null,
  ].filter(Boolean),
});

export const buildPaymentRejectedEmail = ({ recipientName, packageName, reason }) => buildEmailTemplate({
  subject: 'Update on Your Aiqda Payment Review',
  greeting: `Hello ${recipientName},`,
  headline: 'Your Payment Needs Attention',
  bodyLines: [
    `We reviewed your payment for "${packageName}" and could not approve it yet.`,
    reason ? `Review note: ${reason}` : 'Please submit a new payment proof or contact support if you need help.',
  ],
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
