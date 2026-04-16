export const refundPolicyMeta = {
  reference: 'POL-0015',
  effectiveDate: 'April 12, 2026',
};

export const refundPolicySections = [
  {
    title: '1. Introduction',
    paragraphs: [
      'Aiqda ("Platform") is committed to providing a transparent and fair refund process in accordance with applicable regulations of the Kingdom of Saudi Arabia, including consumer protection standards issued by the Ministry of Commerce.',
    ],
  },
  {
    title: '2. Nature of Service',
    bullets: [
      'Paid access to a digital library of pre-recorded content.',
      'Upon initiating a purchase, access to content is granted immediately.',
      'The payment is authorized at checkout and finalized after 24 hours.',
    ],
  },
  {
    title: '3. 24-Hour Refund Eligibility',
    paragraphs: [
      'Users may request a full refund within 24 hours of initiating payment.',
    ],
    bullets: [
      'During this 24-hour period, the transaction remains eligible for cancellation.',
      'No final charge is considered completed until the 24-hour period has passed.',
    ],
  },
  {
    title: '4. Non-Refundable Conditions',
    bullets: [
      'Requests submitted after 24 hours from the initial transaction.',
      'Abuse or repeated misuse of the refund policy.',
    ],
  },
  {
    title: '5. Payment Model',
    bullets: [
      'Access to Aiqda is provided through electronic payments only.',
      'Cash or offline payment methods are not accepted.',
      'There are no automatic renewals or recurring billing.',
      'Each purchase is treated as an independent transaction.',
      'Payments are authorized immediately and finalized after 24 hours.',
    ],
  },
  {
    title: '6. Exceptional Cases',
    paragraphs: [
      'Aiqda may review refund or compensation requests in exceptional circumstances, including:',
    ],
    bullets: [
      'Verified technical issues preventing access to the platform.',
      'Duplicate or incorrect billing transactions.',
      'In such cases, Aiqda may, at its sole discretion, resolve the issue, provide compensation, or issue a refund.',
    ],
  },
  {
    title: '7. Refund Processing',
    bullets: [
      'Approved refunds are processed within 7 to 15 business days.',
      'Refunds are issued via the original electronic payment method only.',
      'Processing time may vary depending on financial institutions.',
    ],
  },
  {
    title: '8. Abuse Prevention',
    paragraphs: [
      'Aiqda reserves the right to suspend or restrict accounts if a user is found to be abusing the refund policy through repeated or fraudulent requests.',
    ],
  },
  {
    title: '9. Acceptance of Policy',
    paragraphs: [
      'By initiating a payment, the user explicitly acknowledges and agrees to this Refund Policy, including the electronic payment requirement and delayed payment finalization structure.',
    ],
  },
];

export const CHECKOUT_DISCLAIMER_VERSION = refundPolicyMeta.reference;
export const CHECKOUT_DISCLAIMER_EFFECTIVE_DATE = refundPolicyMeta.effectiveDate;
export const CHECKOUT_DISCLAIMER_LABEL = 'I Understand and Agree';

export const CHECKOUT_DISCLAIMER_PARAGRAPHS = [
  'By completing this purchase, you acknowledge and agree that Aiqda provides immediate access to a digital library of pre-recorded content upon payment authorization, and that access is granted instantly with no delay or staged delivery.',
  'You understand that Aiqda operates as a digital content access platform, and that all purchases made are for access to digital content only.',
  'You acknowledge that payments on Aiqda are conducted through electronic methods only, and that your payment will be authorized at the time of purchase and finalized after a 24-hour period, during which you remain eligible to request a full refund.',
  'You understand that refund requests must be submitted within 24 hours of initiating the transaction, and that requests submitted after this period will not be eligible for refund under normal conditions.',
  'You further understand that all purchases on Aiqda are one-time transactions with no automatic renewals or recurring charges.',
  'You agree that any refund requests are subject to Aiqda\'s review and approval process, and that exceptional cases, including technical issues or billing errors, may be handled at Aiqda\'s discretion through resolution, compensation, or refund where applicable.',
  'You acknowledge that approved refunds will be processed within 7 to 15 business days and will be issued using the original electronic payment method, subject to processing times imposed by financial institutions.',
  'By proceeding, you confirm that you have read, understood, and agreed to Aiqda\'s Refund Policy in full, including the electronic payment requirement and delayed payment finalization structure.',
];
