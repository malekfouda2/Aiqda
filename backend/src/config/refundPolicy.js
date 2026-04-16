export const REFUND_POLICY_VERSION = 'POL-0015';

export const CHECKOUT_DISCLAIMER_ERROR_MESSAGE =
  'Please accept the refund policy checkout disclaimer before submitting payment.';

export const hasAcceptedCheckoutDisclaimer = (value) => {
  return value === true || value === 'true' || value === '1' || value === 1;
};
