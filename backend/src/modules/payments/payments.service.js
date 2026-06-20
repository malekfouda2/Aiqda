import Payment from './payment.model.js';
import User from '../users/user.model.js';
import { Subscription } from '../subscriptions/subscription.model.js';
import ConsultationBooking from '../consultations/consultationBooking.model.js';
import Consultation from '../consultations/consultation.model.js';
import {
  CHECKOUT_DISCLAIMER_ERROR_MESSAGE,
  hasAcceptedCheckoutDisclaimer,
  REFUND_POLICY_VERSION
} from '../../config/refundPolicy.js';
import { sendEmail } from '../../utils/email.js';
import { sendAdminNotificationEmail } from '../../utils/adminNotifications.js';
import {
  buildSubscriptionActivatedEmail,
  buildSubscriptionCancelledEmail,
  buildSubscriptionGraceExpiredEmail,
  buildSubscriptionRenewedEmail,
  buildSubscriptionRenewalFailedEmail,
  buildConsultationBookingAdminNotificationEmail,
  buildConsultationBookingCancelledEmail,
  buildConsultationBookingConfirmedEmail,
  buildConsultationBookingReceivedEmail,
  buildConsultationBookingRejectedEmail,
} from '../../utils/emailTemplates.js';
import { deleteUploadPathIfExists } from '../../utils/uploadPaths.js';
import {
  assertTapConfigured,
  createTapCharge,
  createTapRefund,
  createTapSavedCardToken,
  getTapApplePayCssUrl,
  getTapApplePayDomain,
  getTapApplePayEnvironment,
  getTapApplePaySdkUrl,
  getSubscriptionCurrency,
  getTapCardSdkUrl,
  getTapMerchantId,
  getTapPublicKey,
  isTapApplePayConfigured,
  mapTapChargeStatus,
  normalizeCurrency,
  retrieveTapCharge,
  verifyTapChargeHashString,
} from './tap.service.js';

const PENDING_PAYMENT_STATUSES = ['submitted', 'initiated'];
const SUCCESSFUL_PAYMENT_STATUSES = ['approved', 'captured'];
const FAILURE_STATUSES = ['rejected', 'failed', 'cancelled'];
const ACTIVE_ACCESS_STATUSES = ['active', 'grace_period', 'cancel_scheduled'];
const DEFAULT_GRACE_PERIOD_DAYS = 7;
const DEFAULT_RENEWAL_RETRY_DELAYS_HOURS = [12, 36, 72];
const DEFAULT_BILLING_PROFILE_SETUP_AMOUNT = 1;
const DEFAULT_REFUND_WINDOW_HOURS = 24;

const parsePositiveInteger = (value, fallback) => {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
};

const getRenewalRetryDelaysHours = () => {
  const configured = String(process.env.SUBSCRIPTION_RENEWAL_RETRY_DELAYS_HOURS || '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  return configured.length > 0 ? configured : DEFAULT_RENEWAL_RETRY_DELAYS_HOURS;
};

const getRenewalRetryLimit = () => parsePositiveInteger(
  process.env.SUBSCRIPTION_RENEWAL_MAX_RETRIES,
  getRenewalRetryDelaysHours().length
);

const getGracePeriodDays = () => parsePositiveInteger(
  process.env.SUBSCRIPTION_RENEWAL_GRACE_PERIOD_DAYS,
  DEFAULT_GRACE_PERIOD_DAYS
);

const getRefundWindowHours = () => parsePositiveInteger(
  process.env.PAYMENT_REFUND_WINDOW_HOURS,
  DEFAULT_REFUND_WINDOW_HOURS
);

const getBillingProfileSetupAmount = () => {
  const normalized = Number(process.env.TAP_BILLING_PROFILE_SETUP_AMOUNT || DEFAULT_BILLING_PROFILE_SETUP_AMOUNT);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : DEFAULT_BILLING_PROFILE_SETUP_AMOUNT;
};

const getBillingProfileSetupCurrency = () => normalizeCurrency(
  process.env.TAP_BILLING_PROFILE_SETUP_CURRENCY || getSubscriptionCurrency()
);

const populatePaymentQuery = (query) => query
  .populate('user', 'name email')
  .populate({
    path: 'consultationBooking',
    populate: { path: 'consultation', select: 'title duration mode priceType currency' },
  })
  .populate({
    path: 'subscription',
    populate: { path: 'package', select: 'name durationDays' },
  });

const toObjectIdString = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value.toString === 'function') {
    return value.toString();
  }

  return null;
};

const normalizeCountryCode = (value = '') => String(value).replace(/[^\d]/g, '').trim();

const normalizePhoneNumber = (value = '') => String(value).replace(/[^\d]/g, '').trim();

const splitFullName = (fullName = '') => {
  const normalizedName = String(fullName).trim();
  if (!normalizedName) {
    return { firstName: 'Aiqda', lastName: 'Member' };
  }

  const [firstName, ...rest] = normalizedName.split(/\s+/);
  return {
    firstName: firstName || 'Aiqda',
    lastName: rest.join(' ') || 'Member',
  };
};

const getBackendBaseUrl = () => (
  process.env.BACKEND_PUBLIC_URL
  || process.env.APP_URL
  || process.env.PUBLIC_BASE_URL
  || process.env.FRONTEND_URL
  || ''
).replace(/\/$/, '');

const getFrontendBaseUrl = () => (
  process.env.FRONTEND_URL
  || process.env.APP_URL
  || process.env.BACKEND_PUBLIC_URL
  || process.env.PUBLIC_BASE_URL
  || ''
).replace(/\/$/, '');

const buildTapWebhookUrl = () => {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    throw new Error('A public app URL is required to receive Tap webhooks.');
  }

  return `${baseUrl}/api/payments/tap/webhook`;
};

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/$/, '');

const buildTapRedirectUrl = (subscriptionId, frontendBaseUrl = null) => {
  const baseUrl = normalizeBaseUrl(frontendBaseUrl) || getFrontendBaseUrl();
  if (!baseUrl) {
    throw new Error('FRONTEND_URL or APP_URL is required for Tap redirect handling.');
  }

  const params = new URLSearchParams({
    tap_redirect: '1',
    subscriptionId: subscriptionId,
  });

  return `${baseUrl}/dashboard/subscription?${params.toString()}`;
};

const buildTapConsultationRedirectUrl = (consultationId, bookingId, frontendBaseUrl = null) => {
  const baseUrl = normalizeBaseUrl(frontendBaseUrl) || getFrontendBaseUrl();
  if (!baseUrl) {
    throw new Error('FRONTEND_URL or APP_URL is required for Tap redirect handling.');
  }

  const params = new URLSearchParams({
    tap_redirect: '1',
    consultationBookingId: bookingId,
  });

  return `${baseUrl}/consultations/${consultationId}?${params.toString()}`;
};

const buildTapBillingProfileRedirectUrl = (frontendBaseUrl = null) => {
  const baseUrl = normalizeBaseUrl(frontendBaseUrl) || getFrontendBaseUrl();
  if (!baseUrl) {
    throw new Error('FRONTEND_URL or APP_URL is required for Tap redirect handling.');
  }

  const params = new URLSearchParams({
    tap_redirect: '1',
    billingProfileSetup: '1',
  });

  return `${baseUrl}/dashboard/subscription?${params.toString()}`;
};

const buildSubscriptionDashboardUrl = () => {
  const baseUrl = getFrontendBaseUrl();
  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}/dashboard/subscription`;
};

const buildTapCustomerPayload = (user, phoneDetails) => {
  const { firstName, lastName } = splitFullName(user.name);

  if (user.tapCustomerId) {
    return {
      id: user.tapCustomerId,
    };
  }

  return {
    first_name: firstName,
    last_name: lastName,
    email: user.email,
    phone: {
      country_code: phoneDetails.countryCode,
      number: phoneDetails.number,
    },
  };
};

const normalizePhoneInput = (user, phoneCountryCode, phoneNumber) => {
  const countryCode = normalizeCountryCode(phoneCountryCode || user.phone?.countryCode || '');
  const number = normalizePhoneNumber(phoneNumber || user.phone?.number || '');

  if (!countryCode || !number) {
    throw new Error('A valid phone country code and phone number are required to save the card for subscriptions.');
  }

  return { countryCode, number };
};

const getExpectedSubscriptionAmount = (subscription) => {
  const expectedAmount = Number(subscription.priceAtPurchase ?? subscription.package?.price);
  return Number.isFinite(expectedAmount) ? expectedAmount : null;
};

const getSubscriptionAccessDurationDays = (subscription) => (
  Number(subscription?.durationDaysSnapshot ?? subscription?.package?.durationDays ?? 30) || 30
);

const getGracePeriodEndDate = (fromDate = new Date()) => {
  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + getGracePeriodDays());
  return nextDate;
};

const getScheduledRetryAt = (failureCount, fromDate = new Date()) => {
  const retryDelays = getRenewalRetryDelaysHours();
  const delayHours = retryDelays[Math.max(0, Math.min(failureCount - 1, retryDelays.length - 1))];
  if (!delayHours) {
    return null;
  }

  return new Date(fromDate.getTime() + (delayHours * 60 * 60 * 1000));
};

const getSubscriptionAccessCutoffDate = (subscription) => {
  if (subscription?.status === 'grace_period') {
    return subscription.gracePeriodEndsAt || null;
  }

  return subscription?.endDate || null;
};

const hasCurrentSubscriptionAccess = (subscription, now = new Date()) => {
  if (!subscription || !ACTIVE_ACCESS_STATUSES.includes(subscription.status)) {
    return false;
  }

  const cutoffDate = getSubscriptionAccessCutoffDate(subscription);
  return Boolean(cutoffDate) && cutoffDate > now;
};

const shouldKeepAutomaticRetries = (failureCount) => failureCount < getRenewalRetryLimit();

const clearRenewalRecoveryState = (subscription) => {
  subscription.gracePeriodEndsAt = null;
  subscription.nextRenewalRetryAt = null;
  subscription.renewalFailureReason = null;
  subscription.renewalFailureCount = 0;
  subscription.renewalProcessingAt = null;
};

const buildRenewalCycleKey = (subscription) => {
  const anchor = subscription?.endDate instanceof Date
    ? subscription.endDate
    : new Date(subscription?.endDate || Date.now());

  return `${subscription._id.toString()}:${anchor.toISOString()}`;
};

const isSuccessfulPaymentStatus = (status) => SUCCESSFUL_PAYMENT_STATUSES.includes(status);

const isPendingPaymentStatus = (status) => PENDING_PAYMENT_STATUSES.includes(status);

const normalizePaymentFilter = (status) => {
  if (!status || status === 'all') {
    return {};
  }

  switch (status) {
    case 'pending':
      return { status: { $in: PENDING_PAYMENT_STATUSES } };
    case 'successful':
      return { status: { $in: SUCCESSFUL_PAYMENT_STATUSES } };
    case 'unsuccessful':
      return { status: { $in: FAILURE_STATUSES } };
    default:
      return { status };
  }
};

const updateSubscriptionAutoRenewState = (subscription, {
  enabled,
  reason = null,
  at = new Date(),
} = {}) => {
  subscription.autoRenewEnabled = Boolean(enabled);
  subscription.autoRenewDisabledReason = enabled ? null : reason;
  subscription.autoRenewDisabledAt = enabled ? null : at;

  if (enabled) {
    subscription.nextRenewalRetryAt = null;
    subscription.renewalFailureReason = null;
    subscription.renewalFailureCount = 0;
  }
};

const isRefundedPayment = (payment = {}) => (
  payment.refundStatus === 'refunded'
  && Number(payment.refundAmount || 0) > 0
);

const getNetPaymentAmount = (payment = {}) => {
  const grossAmount = Number(payment.amount || 0);
  const refundedAmount = isRefundedPayment(payment) ? Number(payment.refundAmount || 0) : 0;
  return Math.max(0, grossAmount - refundedAmount);
};

const isRefundEligible = (payment, now = new Date()) => {
  if (!payment || !isSuccessfulPaymentStatus(payment.status) || isRefundedPayment(payment)) {
    return false;
  }

  const createdAt = payment.createdAt instanceof Date ? payment.createdAt : new Date(payment.createdAt || 0);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  return (now.getTime() - createdAt.getTime()) <= (getRefundWindowHours() * 60 * 60 * 1000);
};

const sendSubscriptionActivationEmail = async ({ payment, subscription, renewal = false }) => {
  if (!payment.user?.email) {
    return;
  }

  const emailTemplate = (renewal ? buildSubscriptionRenewedEmail : buildSubscriptionActivatedEmail)({
    recipientName: payment.user.name,
    packageName: subscription.package?.name || 'your subscription',
    endDate: subscription.endDate?.toLocaleDateString(),
  });

  try {
    await sendEmail({
      to: payment.user.email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });
  } catch (error) {
    console.error('Failed to send subscription activation email:', error.message);
  }
};

const sendSubscriptionRenewalFailureEmail = async ({ payment, subscription, reason }) => {
  if (!payment?.user?.email) {
    return;
  }

  const failureEmail = buildSubscriptionRenewalFailedEmail({
    recipientName: payment.user.name,
    packageName: subscription?.package?.name || 'your subscription',
    reason,
    checkoutUrl: buildSubscriptionDashboardUrl(),
    graceEndsAt: subscription?.gracePeriodEndsAt?.toLocaleDateString() || null,
    nextRetryAt: subscription?.nextRenewalRetryAt?.toLocaleString() || null,
    autoRetryEnabled: Boolean(subscription?.autoRenewEnabled && subscription?.nextRenewalRetryAt),
  });

  try {
    await sendEmail({
      to: payment.user.email,
      subject: failureEmail.subject,
      text: failureEmail.text,
      html: failureEmail.html,
    });
  } catch (error) {
    console.error('Failed to send subscription renewal failure email:', error.message);
  }
};

const sendSubscriptionGraceExpiredEmail = async ({ payment, subscription }) => {
  if (!payment?.user?.email) {
    return;
  }

  const expirationEmail = buildSubscriptionGraceExpiredEmail({
    recipientName: payment.user.name,
    packageName: subscription?.package?.name || 'your subscription',
    checkoutUrl: buildSubscriptionDashboardUrl(),
  });

  try {
    await sendEmail({
      to: payment.user.email,
      subject: expirationEmail.subject,
      text: expirationEmail.text,
      html: expirationEmail.html,
    });
  } catch (error) {
    console.error('Failed to send subscription grace expiration email:', error.message);
  }
};

const sendConsultationBookingReceivedEmail = async (booking) => {
  if (!booking?.user?.email) {
    return;
  }

  const receivedEmail = buildConsultationBookingReceivedEmail({
    recipientName: booking.user.name,
    consultationTitle: booking.consultation?.title || 'your consultation',
  });

  try {
    await sendEmail({
      to: booking.user.email,
      subject: receivedEmail.subject,
      text: receivedEmail.text,
      html: receivedEmail.html,
    });
  } catch (error) {
    console.error('Failed to send consultation booking acknowledgement email:', error.message);
  }
};

const sendConsultationBookingAdminNotification = async (booking, payment = null) => {
  if (!booking?.user?.email) {
    return;
  }

  const adminNotificationEmail = buildConsultationBookingAdminNotificationEmail({
    recipientName: booking.user.name,
    recipientEmail: booking.user.email,
    consultationTitle: booking.consultation?.title || 'Consultation',
    amount: booking.amount,
    currency: booking.currency || payment?.currency || booking.consultation?.currency || getSubscriptionCurrency(),
    priceType: booking.priceType,
    paymentReference: payment?.paymentReference || payment?.tapChargeId || booking.paymentReference,
  });

  try {
    await sendAdminNotificationEmail({
      replyTo: booking.user.email,
      subject: adminNotificationEmail.subject,
      text: adminNotificationEmail.text,
      html: adminNotificationEmail.html,
    });
  } catch (error) {
    console.error('Failed to send consultation booking admin notification email:', error.message);
  }
};

const sendConsultationBookingCancelledEmailMessage = async (booking) => {
  if (!booking?.user?.email) {
    return;
  }

  const cancellationEmail = buildConsultationBookingCancelledEmail({
    recipientName: booking.user.name,
    consultationTitle: booking.consultation?.title || 'your consultation',
  });

  try {
    await sendEmail({
      to: booking.user.email,
      subject: cancellationEmail.subject,
      text: cancellationEmail.text,
      html: cancellationEmail.html,
    });
  } catch (error) {
    console.error('Failed to send consultation cancellation email:', error.message);
  }
};

const sendConsultationBookingRejectedEmailMessage = async (booking, reason) => {
  if (!booking?.user?.email) {
    return;
  }

  const rejectionEmail = buildConsultationBookingRejectedEmail({
    recipientName: booking.user.name,
    consultationTitle: booking.consultation?.title || 'your consultation',
    reason,
  });

  try {
    await sendEmail({
      to: booking.user.email,
      subject: rejectionEmail.subject,
      text: rejectionEmail.text,
      html: rejectionEmail.html,
    });
  } catch (error) {
    console.error('Failed to send consultation rejection email:', error.message);
  }
};

const sendConsultationBookingConfirmedEmailMessage = async (booking) => {
  if (!booking?.user?.email) {
    return;
  }

  const confirmationEmail = buildConsultationBookingConfirmedEmail({
    recipientName: booking.user.name,
    consultationTitle: booking.consultation?.title || 'your consultation',
    zoomLink: booking.zoomLink,
  });

  try {
    await sendEmail({
      to: booking.user.email,
      subject: confirmationEmail.subject,
      text: confirmationEmail.text,
      html: confirmationEmail.html,
    });
  } catch (error) {
    console.error('Failed to send consultation confirmation email:', error.message);
  }
};

const markPaymentRefundState = async (payment, {
  refundStatus,
  refundAmount = null,
  refundCurrency = null,
  refundReason = null,
  refundedBy = null,
  tapRefundId = null,
  tapRefundStatus = null,
  refundSnapshot = null,
} = {}) => {
  payment.refundStatus = refundStatus;
  payment.refundAmount = refundAmount;
  payment.refundCurrency = refundCurrency;
  payment.refundReason = refundReason;
  payment.refundedBy = refundedBy || null;
  payment.tapRefundId = tapRefundId;
  payment.tapRefundStatus = tapRefundStatus;
  payment.refundSnapshot = refundSnapshot;
  payment.refundedAt = refundStatus === 'refunded' ? new Date() : null;
  await payment.save();
  return payment;
};

const revokeSubscriptionAccessAfterRefund = async (payment) => {
  const paymentRecord = payment?.subscription
    ? payment
    : await populatePaymentQuery(Payment.findById(payment?._id || payment));

  if (!paymentRecord?.subscription || getNetPaymentAmount(paymentRecord) > 0) {
    return paymentRecord;
  }

  const subscription = await Subscription.findById(
    paymentRecord.subscription._id || paymentRecord.subscription
  ).populate('package user');

  if (!subscription) {
    return paymentRecord;
  }

  const now = paymentRecord.refundedAt || new Date();

  subscription.status = 'cancelled';
  subscription.endDate = now;
  subscription.gracePeriodEndsAt = null;
  subscription.nextRenewalRetryAt = null;
  subscription.renewalFailureReason = null;
  subscription.renewalFailureCount = 0;
  subscription.renewalProcessingAt = null;
  subscription.cancelScheduledAt = now;
  subscription.cancelEffectiveAt = now;
  subscription.cancelReason = 'refunded';
  updateSubscriptionAutoRenewState(subscription, {
    enabled: false,
    reason: 'admin',
    at: now,
  });

  await subscription.save();

  return paymentRecord;
};

export const refundSuccessfulPayment = async (paymentId, {
  reason,
  refundedBy = null,
  amount = null,
} = {}) => {
  const payment = await populatePaymentQuery(Payment.findById(paymentId));
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (!isSuccessfulPaymentStatus(payment.status)) {
    throw new Error('Only successful payments can be refunded.');
  }

  if (isRefundedPayment(payment)) {
    return payment;
  }

  const refundAmount = Number(amount ?? payment.amount ?? 0);
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw new Error('A valid refund amount is required.');
  }

  await markPaymentRefundState(payment, {
    refundStatus: 'pending',
    refundAmount,
    refundCurrency: payment.currency,
    refundReason: reason,
    refundedBy,
  });

  try {
    const refund = await createTapRefund({
      charge_id: payment.tapChargeId,
      amount: refundAmount,
      currency: payment.currency,
      reason: reason || 'Refund requested by Aiqda.',
    });

    await markPaymentRefundState(payment, {
      refundStatus: 'refunded',
      refundAmount,
      refundCurrency: payment.currency,
      refundReason: reason,
      refundedBy,
      tapRefundId: refund.id || null,
      tapRefundStatus: refund.status || null,
      refundSnapshot: refund,
    });
    await revokeSubscriptionAccessAfterRefund(payment);
  } catch (error) {
    await markPaymentRefundState(payment, {
      refundStatus: 'failed',
      refundAmount,
      refundCurrency: payment.currency,
      refundReason: error.message || reason,
      refundedBy,
    });
    throw error;
  }

  return populatePaymentQuery(Payment.findById(payment._id));
};

const activateOrRenewSubscriptionFromPayment = async (payment, activationSource) => {
  const paymentRecord = payment.user && payment.subscription
    ? payment
    : await populatePaymentQuery(
      Payment.findById(payment._id || payment)
    );

  if (!paymentRecord?.subscription) {
    return paymentRecord;
  }

  const subscription = await Subscription.findById(paymentRecord.subscription._id).populate('package');
  if (!subscription) {
    return paymentRecord;
  }

  const now = new Date();
  const accessDurationDays = getSubscriptionAccessDurationDays(subscription);

  if (subscription.status === 'pending') {
    const startDate = now;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + accessDurationDays);

    subscription.status = 'active';
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.currency = paymentRecord.currency || subscription.currency || getSubscriptionCurrency();
    subscription.activatedAt = startDate;
    subscription.activationSource = activationSource;
    clearRenewalRecoveryState(subscription);

    if (paymentRecord.provider === 'tap' && paymentRecord.tapPaymentAgreementId) {
      updateSubscriptionAutoRenewState(subscription, { enabled: true, at: now });
    }

    await subscription.save();

    await sendSubscriptionActivationEmail({
      payment: paymentRecord,
      subscription,
      renewal: false,
    });

    return populatePaymentQuery(Payment.findById(paymentRecord._id));
  }

  if (!['active', 'grace_period', 'expired'].includes(subscription.status)) {
    return paymentRecord;
  }

  const renewalAnchor = paymentRecord.paymentType === 'recovery' && subscription.endDate
    ? subscription.endDate
    : (subscription.endDate && subscription.endDate > now ? subscription.endDate : now);
  const nextEndDate = new Date(renewalAnchor);
  nextEndDate.setDate(nextEndDate.getDate() + accessDurationDays);

  subscription.status = 'active';
  subscription.startDate = subscription.startDate || now;
  subscription.endDate = nextEndDate;
  subscription.currency = paymentRecord.currency || subscription.currency || getSubscriptionCurrency();
  subscription.lastRenewalAttemptAt = now;
  subscription.lastRenewalAt = now;
  subscription.activationSource = activationSource;
  clearRenewalRecoveryState(subscription);

  if (paymentRecord.provider === 'tap' && paymentRecord.tapPaymentAgreementId) {
    updateSubscriptionAutoRenewState(subscription, { enabled: true, at: now });
  }

  await subscription.save();

  await sendSubscriptionActivationEmail({
    payment: paymentRecord,
    subscription,
    renewal: true,
  });

  return populatePaymentQuery(Payment.findById(paymentRecord._id));
};

const updateUserTapBillingProfile = async (userId, charge, phoneDetails) => {
  const user = await User.findById(userId);
  if (!user) {
    return;
  }

  if (phoneDetails?.countryCode || phoneDetails?.number) {
    user.phone = {
      countryCode: phoneDetails.countryCode || user.phone?.countryCode || '',
      number: phoneDetails.number || user.phone?.number || '',
    };
  }

  if (charge.customer?.id) {
    user.tapCustomerId = charge.customer.id;
  }

  if (charge.card?.id) {
    user.tapCardId = charge.card.id;
  }

  if (charge.payment_agreement?.id) {
    user.tapPaymentAgreementId = charge.payment_agreement.id;
  }

  if (charge.card?.brand) {
    user.tapCardBrand = charge.card.brand;
  }

  if (charge.card?.last_four || charge.card?.last4) {
    user.tapCardLastFour = charge.card.last_four || charge.card.last4;
  }

  if (charge.card?.funding || charge.source?.payment_type) {
    user.tapCardFunding = charge.card?.funding || charge.source?.payment_type || null;
  }

  if (user.isModified()) {
    user.tapBillingProfileUpdatedAt = new Date();
    await user.save();
  }
};

const clearUserTapBillingProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  user.tapCardId = null;
  user.tapPaymentAgreementId = null;
  user.tapCardBrand = null;
  user.tapCardFunding = null;
  user.tapCardLastFour = null;
  user.tapBillingProfileUpdatedAt = new Date();
  await user.save();

  return user.toJSON().billingProfile;
};

const finalizeFailedRenewalFromPayment = async (payment, reason) => {
  const paymentRecord = payment.user && payment.subscription
    ? payment
    : await populatePaymentQuery(
      Payment.findById(payment._id || payment)
    );

  if (!paymentRecord?.subscription) {
    return paymentRecord;
  }

  const subscription = await Subscription.findById(paymentRecord.subscription._id).populate('package');
  if (!subscription) {
    return paymentRecord;
  }

  const now = new Date();
  const nextFailureCount = Number(subscription.renewalFailureCount || 0) + 1;
  const keepAutomaticRetries = shouldKeepAutomaticRetries(nextFailureCount);

  subscription.lastRenewalAttemptAt = now;
  subscription.renewalFailureReason = reason || paymentRecord.failureReason || paymentRecord.tapResponseMessage || 'Recurring payment failed.';
  subscription.renewalFailureCount = nextFailureCount;
  subscription.renewalProcessingAt = null;

  if (subscription.endDate && subscription.endDate <= now) {
    subscription.status = 'grace_period';
    subscription.gracePeriodEndsAt = subscription.gracePeriodEndsAt || getGracePeriodEndDate(now);
  }

  if (keepAutomaticRetries) {
    subscription.nextRenewalRetryAt = getScheduledRetryAt(nextFailureCount, now);
    subscription.autoRenewEnabled = true;
    subscription.autoRenewDisabledAt = null;
    subscription.autoRenewDisabledReason = null;
  } else {
    subscription.nextRenewalRetryAt = null;
    updateSubscriptionAutoRenewState(subscription, {
      enabled: false,
      reason: 'payment_failed',
      at: now,
    });
  }

  await subscription.save();

  await sendSubscriptionRenewalFailureEmail({
    payment: paymentRecord,
    subscription,
    reason: subscription.renewalFailureReason,
  });

  return populatePaymentQuery(Payment.findById(paymentRecord._id));
};

const finalizeConsultationBookingFromPayment = async (payment, failureReason = null) => {
  const paymentRecord = payment.user && payment.consultationBooking
    ? payment
    : await populatePaymentQuery(
      Payment.findById(payment._id || payment)
    );

  if (!paymentRecord?.consultationBooking) {
    return paymentRecord;
  }

  const booking = await ConsultationBooking.findById(paymentRecord.consultationBooking._id || paymentRecord.consultationBooking)
    .populate('consultation user');
  if (!booking) {
    return paymentRecord;
  }

  if (isSuccessfulPaymentStatus(paymentRecord.status)) {
    booking.status = 'pending';
    booking.paymentFailureReason = null;
    booking.paymentReference = paymentRecord.paymentReference || paymentRecord.tapChargeId || booking.paymentReference;
    booking.paidAt = new Date();
    await booking.save();
    await sendConsultationBookingReceivedEmail(booking);
    await sendConsultationBookingAdminNotification(booking, paymentRecord);
  } else {
    booking.status = 'payment_failed';
    booking.paymentFailureReason = failureReason || paymentRecord.failureReason || paymentRecord.tapResponseMessage || 'The consultation payment could not be completed.';
    await booking.save();
  }

  return populatePaymentQuery(Payment.findById(paymentRecord._id));
};

const finalizeBillingProfileSetupPayment = async (payment) => {
  const paymentRecord = payment.user
    ? payment
    : await populatePaymentQuery(Payment.findById(payment._id || payment));

  if (!paymentRecord) {
    return null;
  }

  if (isSuccessfulPaymentStatus(paymentRecord.status) && !isRefundedPayment(paymentRecord)) {
    try {
      await refundSuccessfulPayment(paymentRecord._id, {
        reason: 'Automatic refund after saved payment method setup.',
      });
    } catch (error) {
      paymentRecord.failureReason = paymentRecord.failureReason || error.message;
      await paymentRecord.save();
    }
  }

  return populatePaymentQuery(Payment.findById(paymentRecord._id));
};

const applyTapChargeSnapshotToPayment = async (payment, charge, {
  verifiedWebhook = false,
  activationSource = 'tap_capture',
  phoneDetails = null,
} = {}) => {
  const previousStatus = payment.status;
  const nextStatus = mapTapChargeStatus(charge.status);

  payment.status = nextStatus;
  payment.provider = 'tap';
  payment.currency = charge.currency || payment.currency || getSubscriptionCurrency();
  payment.tapChargeId = charge.id || payment.tapChargeId;
  payment.tapChargeStatus = charge.status || payment.tapChargeStatus;
  payment.paymentReference = charge.reference?.payment || payment.paymentReference;
  payment.tapTransactionReference = charge.reference?.transaction || payment.tapTransactionReference;
  payment.tapOrderReference = charge.reference?.order || payment.tapOrderReference;
  payment.tapGatewayReference = charge.reference?.gateway || payment.tapGatewayReference;
  payment.tapResponseCode = charge.response?.code || payment.tapResponseCode;
  payment.tapResponseMessage = charge.response?.message || payment.tapResponseMessage;
  payment.tapRedirectUrl = charge.transaction?.url || charge.redirect?.url || payment.tapRedirectUrl;
  payment.tapCustomerId = charge.customer?.id || payment.tapCustomerId;
  payment.tapCardId = charge.card?.id || charge.payment_agreement?.contract?.id || payment.tapCardId;
  payment.tapPaymentAgreementId = charge.payment_agreement?.id || payment.tapPaymentAgreementId;
  payment.checkoutMethod = payment.paymentType === 'renewal'
    ? 'saved_card'
    : (charge.source?.payment_method || charge.source?.type || '').toLowerCase().includes('apple')
      ? 'apple_pay'
      : payment.checkoutMethod;
  payment.failureReason = nextStatus === 'failed' || nextStatus === 'cancelled'
    ? (charge.response?.message || payment.failureReason)
    : null;
  payment.chargeSnapshot = charge;

  if (verifiedWebhook) {
    payment.tapWebhookVerifiedAt = new Date();
  }

  await payment.save();

  await updateUserTapBillingProfile(payment.user, charge, phoneDetails);

  if (payment.paymentType === 'renewal' && nextStatus === 'initiated') {
    payment.status = 'failed';
    payment.failureReason = charge.response?.message || 'Recurring renewal requires customer action and cannot continue automatically.';
    payment.tapResponseMessage = payment.failureReason;
    await payment.save();
    return finalizeFailedRenewalFromPayment(payment, payment.failureReason);
  }

  if (payment.paymentType === 'billing_profile_setup' && isSuccessfulPaymentStatus(nextStatus)) {
    return finalizeBillingProfileSetupPayment(payment);
  }

  if (payment.paymentType === 'consultation') {
    if (!isSuccessfulPaymentStatus(previousStatus) && isSuccessfulPaymentStatus(nextStatus)) {
      return finalizeConsultationBookingFromPayment(payment);
    }

    if (nextStatus === 'failed' || nextStatus === 'cancelled') {
      return finalizeConsultationBookingFromPayment(
        payment,
        payment.failureReason || payment.tapResponseMessage
      );
    }
  }

  if (!isSuccessfulPaymentStatus(previousStatus) && isSuccessfulPaymentStatus(nextStatus)) {
    return activateOrRenewSubscriptionFromPayment(payment, activationSource);
  }

  if (
    ['renewal', 'recovery'].includes(payment.paymentType)
    && (nextStatus === 'failed' || nextStatus === 'cancelled')
  ) {
    return finalizeFailedRenewalFromPayment(payment, payment.failureReason || payment.tapResponseMessage);
  }

  return populatePaymentQuery(Payment.findById(payment._id));
};

const findPaymentForTapCharge = async (charge, userId = null) => {
  const queries = [];

  if (charge?.id) {
    queries.push({ tapChargeId: charge.id });
  }

  const paymentIdFromMetadata = charge?.metadata?.udf1;
  if (paymentIdFromMetadata) {
    queries.push({ _id: paymentIdFromMetadata });
  }

  const transactionReference = String(charge?.reference?.transaction || '');
  if (transactionReference.startsWith('payment_')) {
    queries.push({ _id: transactionReference.replace(/^payment_/, '') });
  }

  const orderReference = String(charge?.reference?.order || '');
  if (orderReference.startsWith('subscription_')) {
    queries.push({ subscription: orderReference.replace(/^subscription_/, '') });
  }
  if (orderReference.startsWith('consultation_')) {
    queries.push({ consultationBooking: orderReference.replace(/^consultation_/, '') });
  }

  for (const query of queries) {
    const scopedQuery = userId ? { ...query, user: userId } : query;
    const payment = await Payment.findOne(scopedQuery);
    if (payment) {
      return payment;
    }
  }

  return null;
};

const buildTapChargePayload = ({
  payment,
  user,
  tokenId,
  phoneDetails,
  description,
  orderReference,
  redirectUrl,
  metadata = {},
}) => ({
  amount: payment.amount,
  currency: payment.currency,
  customer_initiated: true,
  threeDSecure: true,
  save_card: true,
  description,
  metadata: {
    udf1: payment._id.toString(),
    udf3: user._id.toString(),
    ...metadata,
  },
  reference: {
    transaction: `payment_${payment._id}`,
    order: orderReference,
    idempotent: payment._id.toString(),
  },
  customer: buildTapCustomerPayload(user, phoneDetails),
  merchant: getTapMerchantId() ? { id: getTapMerchantId() } : undefined,
  source: {
    id: tokenId,
  },
  post: {
    url: buildTapWebhookUrl(),
  },
  redirect: {
    url: redirectUrl,
  },
});

const buildSubscriptionTapChargePayload = ({
  payment,
  subscription,
  packageName,
  user,
  tokenId,
  phoneDetails,
  description,
  frontendBaseUrl,
}) => buildTapChargePayload({
  payment,
  user,
  tokenId,
  phoneDetails,
  description: description || `Aiqda subscription for ${packageName}`,
  orderReference: `subscription_${subscription._id}`,
  redirectUrl: buildTapRedirectUrl(subscription._id.toString(), frontendBaseUrl),
  metadata: {
    udf2: subscription._id.toString(),
  },
});

const buildConsultationTapChargePayload = ({
  payment,
  booking,
  consultationTitle,
  user,
  tokenId,
  phoneDetails,
  frontendBaseUrl,
}) => buildTapChargePayload({
  payment,
  user,
  tokenId,
  phoneDetails,
  description: `Aiqda consultation booking for ${consultationTitle}`,
  orderReference: `consultation_${booking._id}`,
  redirectUrl: buildTapConsultationRedirectUrl(
    booking.consultation?._id?.toString?.() || booking.consultation.toString(),
    booking._id.toString(),
    frontendBaseUrl
  ),
  metadata: {
    udf2: booking._id.toString(),
    udf5: 'consultation',
  },
});

const buildBillingProfileSetupChargePayload = ({
  payment,
  user,
  tokenId,
  phoneDetails,
  frontendBaseUrl,
}) => buildTapChargePayload({
  payment,
  user,
  tokenId,
  phoneDetails,
  description: 'Aiqda saved payment method setup',
  orderReference: `billing_profile_${user._id}`,
  redirectUrl: buildTapBillingProfileRedirectUrl(frontendBaseUrl),
  metadata: {
    udf5: 'billing_profile_setup',
  },
});

const buildTapRecurringChargePayload = ({
  payment,
  subscription,
  packageName,
  user,
  tokenId,
  renewalCycleKey,
}) => ({
  amount: payment.amount,
  currency: payment.currency,
  customer_initiated: false,
  threeDSecure: false,
  save_card: false,
  description: `Aiqda subscription renewal for ${packageName}`,
  metadata: {
    udf1: payment._id.toString(),
    udf2: subscription._id.toString(),
    udf3: user._id.toString(),
    udf4: renewalCycleKey,
  },
  reference: {
    transaction: `payment_${payment._id}`,
    order: `subscription_${subscription._id}`,
    idempotent: renewalCycleKey,
  },
  customer: {
    id: user.tapCustomerId,
  },
  merchant: getTapMerchantId() ? { id: getTapMerchantId() } : undefined,
  source: {
    id: tokenId,
  },
  payment_agreement: {
    id: user.tapPaymentAgreementId,
  },
  post: {
    url: buildTapWebhookUrl(),
  },
});

const buildSavedCardSubscriptionChargePayload = ({
  payment,
  subscription,
  packageName,
  user,
  tokenId,
  isRecoveryCheckout = false,
}) => ({
  amount: payment.amount,
  currency: payment.currency,
  customer_initiated: false,
  threeDSecure: false,
  save_card: false,
  description: isRecoveryCheckout
    ? `Aiqda subscription recovery for ${packageName}`
    : `Aiqda subscription for ${packageName}`,
  metadata: {
    udf1: payment._id.toString(),
    udf2: subscription._id.toString(),
    udf3: user._id.toString(),
    udf5: 'saved_card_subscription',
  },
  reference: {
    transaction: `payment_${payment._id}`,
    order: `subscription_${subscription._id}`,
    idempotent: payment._id.toString(),
  },
  customer: {
    id: user.tapCustomerId,
  },
  merchant: getTapMerchantId() ? { id: getTapMerchantId() } : undefined,
  source: {
    id: tokenId,
  },
  payment_agreement: {
    id: user.tapPaymentAgreementId,
  },
  post: {
    url: buildTapWebhookUrl(),
  },
});

export const createTapSubscriptionCharge = async (userId, paymentData) => {
  assertTapConfigured();

  const {
    subscriptionId,
    tokenId,
    useSavedPaymentMethod,
    checkoutMethod,
    phoneCountryCode,
    phoneNumber,
    checkoutDisclaimerAccepted,
    frontendBaseUrl,
  } = paymentData;

  if (!subscriptionId) {
    throw new Error('Subscription id is required.');
  }

  const wantsSavedPaymentMethod = useSavedPaymentMethod === true || useSavedPaymentMethod === 'true';

  if (!wantsSavedPaymentMethod && !tokenId?.trim()) {
    throw new Error('A secure payment token is required.');
  }

  if (!hasAcceptedCheckoutDisclaimer(checkoutDisclaimerAccepted)) {
    throw new Error(CHECKOUT_DISCLAIMER_ERROR_MESSAGE);
  }

  const [subscription, user] = await Promise.all([
    Subscription.findOne({
      _id: subscriptionId,
      user: userId,
      status: { $in: ['pending', 'grace_period'] }
    }).populate('package'),
    User.findById(userId).select('name email phone tapCustomerId tapCardId tapPaymentAgreementId'),
  ]);

  if (!subscription) {
    throw new Error('No subscription is available for checkout right now.');
  }

  if (!user) {
    throw new Error('User not found');
  }

  const allowedCheckoutMethod = wantsSavedPaymentMethod
    ? 'saved_card'
    : (checkoutMethod === 'apple_pay' ? 'apple_pay' : 'card');
  const isRecoveryCheckout = subscription.status === 'grace_period';
  const existingPayment = await Payment.findOne(
    isRecoveryCheckout
      ? {
          subscription: subscriptionId,
          paymentType: 'recovery',
          status: { $in: ['initiated'] },
        }
      : {
          subscription: subscriptionId,
          $or: [
            {
              provider: 'tap',
              status: { $in: ['initiated'] },
            },
            {
              status: { $in: SUCCESSFUL_PAYMENT_STATUSES },
            },
          ],
        }
  );

  if (existingPayment) {
    if (!isRecoveryCheckout && isSuccessfulPaymentStatus(existingPayment.status)) {
      throw new Error('A successful payment already exists for this subscription.');
    }

    throw new Error('A payment is already in progress for this subscription.');
  }

  const phoneDetails = wantsSavedPaymentMethod
    ? null
    : normalizePhoneInput(user, phoneCountryCode, phoneNumber);
  const expectedAmount = getExpectedSubscriptionAmount(subscription);
  if (expectedAmount === null || expectedAmount <= 0) {
    throw new Error('This subscription does not have a valid payable amount.');
  }

  if (wantsSavedPaymentMethod && (!user.tapCustomerId || !user.tapCardId || !user.tapPaymentAgreementId)) {
    throw new Error('No saved payment method is available for this membership right now.');
  }

  const payment = await Payment.create({
    user: userId,
    subscription: subscriptionId,
    amount: expectedAmount,
    currency: subscription.currency || getSubscriptionCurrency(),
    provider: 'tap',
    status: 'initiated',
    customerInitiated: !wantsSavedPaymentMethod,
    threeDSecure: !wantsSavedPaymentMethod,
    saveCard: !wantsSavedPaymentMethod,
    paymentType: isRecoveryCheckout ? 'recovery' : 'initial',
    checkoutMethod: allowedCheckoutMethod,
    checkoutDisclaimerVersion: REFUND_POLICY_VERSION,
    checkoutDisclaimerAcceptedAt: new Date(),
  });

  try {
    const charge = wantsSavedPaymentMethod
      ? await (async () => {
          const savedCardToken = await createTapSavedCardToken({
            cardId: user.tapCardId,
            customerId: user.tapCustomerId,
          });

          return createTapCharge(
            buildSavedCardSubscriptionChargePayload({
              payment,
              subscription,
              packageName: subscription.package?.name || 'your membership',
              user,
              tokenId: savedCardToken.id,
              isRecoveryCheckout,
            })
          );
        })()
      : await createTapCharge(
          buildSubscriptionTapChargePayload({
            payment,
            subscription,
            packageName: subscription.package?.name || 'Aiqda subscription',
            user,
            tokenId: tokenId.trim(),
            phoneDetails,
            frontendBaseUrl,
            description: isRecoveryCheckout
              ? `Aiqda subscription recovery for ${subscription.package?.name || 'your membership'}`
              : `Aiqda subscription for ${subscription.package?.name || 'your membership'}`,
          })
        );

    const syncedPayment = await applyTapChargeSnapshotToPayment(payment, charge, {
      activationSource: wantsSavedPaymentMethod ? 'tap_saved_card_charge' : 'tap_charge',
      phoneDetails,
    });

    return {
      payment: syncedPayment,
      chargeId: charge.id || null,
      chargeStatus: charge.status || null,
      redirectUrl: charge.transaction?.url || charge.redirect?.url || null,
    };
  } catch (error) {
    payment.status = 'failed';
    payment.failureReason = error.message;
    payment.tapResponseMessage = error.message;
    await payment.save();
    throw error;
  }
};

export const createTapBillingProfileSetupCharge = async (userId, paymentData) => {
  assertTapConfigured();

  const {
    tokenId,
    checkoutMethod,
    phoneCountryCode,
    phoneNumber,
    checkoutDisclaimerAccepted,
    frontendBaseUrl,
  } = paymentData;

  if (!tokenId?.trim()) {
    throw new Error('A secure payment token is required.');
  }

  if (!hasAcceptedCheckoutDisclaimer(checkoutDisclaimerAccepted)) {
    throw new Error(CHECKOUT_DISCLAIMER_ERROR_MESSAGE);
  }

  const user = await User.findById(userId).select('name email phone tapCustomerId');
  if (!user) {
    throw new Error('User not found');
  }

  const phoneDetails = normalizePhoneInput(user, phoneCountryCode, phoneNumber);
  const payment = await Payment.create({
    user: userId,
    amount: getBillingProfileSetupAmount(),
    currency: getBillingProfileSetupCurrency(),
    provider: 'tap',
    status: 'initiated',
    customerInitiated: true,
    threeDSecure: true,
    saveCard: true,
    paymentType: 'billing_profile_setup',
    checkoutMethod: checkoutMethod === 'apple_pay' ? 'apple_pay' : 'card',
    checkoutDisclaimerVersion: REFUND_POLICY_VERSION,
    checkoutDisclaimerAcceptedAt: new Date(),
  });

  try {
    const charge = await createTapCharge(
      buildBillingProfileSetupChargePayload({
        payment,
        user,
        tokenId: tokenId.trim(),
        phoneDetails,
        frontendBaseUrl,
      })
    );

    const syncedPayment = await applyTapChargeSnapshotToPayment(payment, charge, {
      activationSource: 'tap_charge',
      phoneDetails,
    });

    return {
      payment: syncedPayment,
      chargeId: charge.id || null,
      chargeStatus: charge.status || null,
      redirectUrl: charge.transaction?.url || charge.redirect?.url || null,
    };
  } catch (error) {
    payment.status = 'failed';
    payment.failureReason = error.message;
    payment.tapResponseMessage = error.message;
    await payment.save();
    throw error;
  }
};

export const createTapConsultationCharge = async (userId, paymentData) => {
  assertTapConfigured();

  const {
    consultationId,
    tokenId,
    checkoutMethod,
    phoneCountryCode,
    phoneNumber,
    checkoutDisclaimerAccepted,
  } = paymentData;

  if (!consultationId) {
    throw new Error('Consultation id is required.');
  }

  if (!tokenId?.trim()) {
    throw new Error('A secure payment token is required.');
  }

  if (!hasAcceptedCheckoutDisclaimer(checkoutDisclaimerAccepted)) {
    throw new Error(CHECKOUT_DISCLAIMER_ERROR_MESSAGE);
  }

  const [user, consultation] = await Promise.all([
    User.findById(userId).select('name email phone tapCustomerId'),
    Consultation.findById(consultationId),
  ]);

  if (!user) {
    throw new Error('User not found');
  }

  if (!consultation || consultation.isActive === false) {
    throw new Error('Consultation not found');
  }

  if (consultation.priceType !== 'fixed') {
    throw new Error('This consultation does not require upfront payment.');
  }

  const existingOpenBooking = await ConsultationBooking.findOne({
    consultation: consultationId,
    user: userId,
    status: { $in: ['payment_pending', 'pending', 'confirmed'] },
  });
  if (existingOpenBooking) {
    throw new Error('A consultation booking is already in progress for this session.');
  }

  const phoneDetails = normalizePhoneInput(user, phoneCountryCode, phoneNumber);
  const booking = await ConsultationBooking.create({
    consultation: consultationId,
    user: userId,
    priceType: consultation.priceType,
    amount: consultation.price,
    currency: consultation.currency || getSubscriptionCurrency(),
    status: 'payment_pending',
  });

  const payment = await Payment.create({
    user: userId,
    consultationBooking: booking._id,
    amount: consultation.price,
    currency: consultation.currency || getSubscriptionCurrency(),
    provider: 'tap',
    status: 'initiated',
    customerInitiated: true,
    threeDSecure: true,
    saveCard: false,
    paymentType: 'consultation',
    checkoutMethod: checkoutMethod === 'apple_pay' ? 'apple_pay' : 'card',
    checkoutDisclaimerVersion: REFUND_POLICY_VERSION,
    checkoutDisclaimerAcceptedAt: new Date(),
  });

  try {
    const populatedBooking = await ConsultationBooking.findById(booking._id).populate('consultation');
    const charge = await createTapCharge(
      buildConsultationTapChargePayload({
        payment,
        booking: populatedBooking,
        consultationTitle: populatedBooking.consultation?.title || 'consultation',
        user,
        tokenId: tokenId.trim(),
        phoneDetails,
      })
    );

    const syncedPayment = await applyTapChargeSnapshotToPayment(payment, charge, {
      activationSource: 'tap_charge',
      phoneDetails,
    });

    return {
      payment: syncedPayment,
      bookingId: booking._id.toString(),
      chargeId: charge.id || null,
      chargeStatus: charge.status || null,
      redirectUrl: charge.transaction?.url || charge.redirect?.url || null,
    };
  } catch (error) {
    booking.status = 'payment_failed';
    booking.paymentFailureReason = error.message;
    await booking.save();
    payment.status = 'failed';
    payment.failureReason = error.message;
    payment.tapResponseMessage = error.message;
    await payment.save();
    throw error;
  }
};

const expireSubscriptionAfterGrace = async (subscription, payment = null) => {
  const populatedSubscription = subscription.package
    ? subscription
    : await Subscription.findById(subscription._id || subscription).populate('package');

  if (!populatedSubscription) {
    return null;
  }

  populatedSubscription.status = 'expired';
  populatedSubscription.nextRenewalRetryAt = null;
  populatedSubscription.gracePeriodEndsAt = null;
  populatedSubscription.renewalProcessingAt = null;
  updateSubscriptionAutoRenewState(populatedSubscription, {
    enabled: false,
    reason: 'payment_failed',
    at: new Date(),
  });
  await populatedSubscription.save();

  if (payment) {
    await sendSubscriptionGraceExpiredEmail({
      payment,
      subscription: populatedSubscription,
    });
  }

  return populatedSubscription;
};

const claimSubscriptionForRenewal = async (subscriptionId) => {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - (15 * 60 * 1000));

  return Subscription.findOneAndUpdate(
    {
      _id: subscriptionId,
      autoRenewEnabled: true,
      $and: [
        {
          $or: [
            {
              status: 'active',
              endDate: { $lte: now },
            },
            {
              status: 'grace_period',
              gracePeriodEndsAt: { $gt: now },
              nextRenewalRetryAt: { $lte: now },
            },
          ],
        },
        {
          $or: [
            { renewalProcessingAt: null },
            { renewalProcessingAt: { $exists: false } },
            { renewalProcessingAt: { $lt: staleCutoff } },
          ],
        },
      ],
    },
    {
      $set: {
        renewalProcessingAt: now,
        lastRenewalAttemptAt: now,
      },
    },
    { new: true }
  ).populate('package');
};

export const processTapSubscriptionRenewal = async (subscriptionId) => {
  assertTapConfigured();

  const subscription = await claimSubscriptionForRenewal(subscriptionId);
  if (!subscription) {
    return null;
  }

  const user = await User.findById(subscription.user).select(
    'name email phone tapCustomerId tapCardId tapPaymentAgreementId'
  );

  if (!user) {
    subscription.renewalProcessingAt = null;
    subscription.renewalFailureReason = 'The subscription owner account was not found.';
    subscription.renewalFailureCount = Number(subscription.renewalFailureCount || 0) + 1;
    subscription.status = 'expired';
    subscription.nextRenewalRetryAt = null;
    subscription.gracePeriodEndsAt = null;
    updateSubscriptionAutoRenewState(subscription, {
      enabled: false,
      reason: 'payment_failed',
    });
    await subscription.save();
    return null;
  }

  if (!user.tapCustomerId || !user.tapCardId || !user.tapPaymentAgreementId) {
    subscription.renewalProcessingAt = null;
    subscription.renewalFailureReason = 'No saved payment method is available for renewal.';
    subscription.renewalFailureCount = Number(subscription.renewalFailureCount || 0) + 1;
    subscription.status = 'grace_period';
    subscription.gracePeriodEndsAt = subscription.gracePeriodEndsAt || getGracePeriodEndDate(new Date());
    subscription.nextRenewalRetryAt = null;
    updateSubscriptionAutoRenewState(subscription, {
      enabled: false,
      reason: 'payment_failed',
    });
    await subscription.save();
    await sendSubscriptionRenewalFailureEmail({
      payment: { user },
      subscription,
      reason: subscription.renewalFailureReason,
    });
    return null;
  }

  const renewalCycleKey = buildRenewalCycleKey(subscription);
  const existingRenewalPayment = await Payment.findOne({
    subscription: subscription._id,
    renewalCycleKey,
  });

  if (existingRenewalPayment) {
    subscription.renewalProcessingAt = null;
    await subscription.save();

    if (isSuccessfulPaymentStatus(existingRenewalPayment.status)) {
      return activateOrRenewSubscriptionFromPayment(existingRenewalPayment, 'tap_renewal_recovery');
    }

    if (existingRenewalPayment.status === 'failed' || existingRenewalPayment.status === 'cancelled') {
      return finalizeFailedRenewalFromPayment(
        existingRenewalPayment,
        existingRenewalPayment.failureReason || existingRenewalPayment.tapResponseMessage
      );
    }

    return populatePaymentQuery(Payment.findById(existingRenewalPayment._id));
  }

  const renewalAmount = getExpectedSubscriptionAmount(subscription);
  if (renewalAmount === null || renewalAmount <= 0) {
    subscription.renewalProcessingAt = null;
    subscription.renewalFailureReason = 'This subscription no longer has a valid renewal amount.';
    subscription.renewalFailureCount = Number(subscription.renewalFailureCount || 0) + 1;
    subscription.status = 'grace_period';
    subscription.gracePeriodEndsAt = subscription.gracePeriodEndsAt || getGracePeriodEndDate(new Date());
    subscription.nextRenewalRetryAt = null;
    updateSubscriptionAutoRenewState(subscription, {
      enabled: false,
      reason: 'payment_failed',
    });
    await subscription.save();
    await sendSubscriptionRenewalFailureEmail({
      payment: { user },
      subscription,
      reason: subscription.renewalFailureReason,
    });
    return null;
  }

  const payment = await Payment.create({
    user: user._id,
    subscription: subscription._id,
    amount: renewalAmount,
    currency: subscription.currency || getSubscriptionCurrency(),
    provider: 'tap',
    status: 'initiated',
    customerInitiated: false,
    threeDSecure: false,
    saveCard: false,
    paymentType: 'renewal',
    checkoutMethod: 'saved_card',
    renewalCycleKey,
    checkoutDisclaimerVersion: REFUND_POLICY_VERSION,
    checkoutDisclaimerAcceptedAt: new Date(),
  });

  try {
    const token = await createTapSavedCardToken({
      cardId: user.tapCardId,
      customerId: user.tapCustomerId,
    });

    const charge = await createTapCharge(
      buildTapRecurringChargePayload({
        payment,
        subscription,
        packageName: subscription.package?.name || 'Aiqda subscription',
        user,
        tokenId: token.id,
        renewalCycleKey,
      })
    );

    return applyTapChargeSnapshotToPayment(payment, charge, {
      activationSource: 'tap_renewal',
    });
  } catch (error) {
    payment.status = 'failed';
    payment.failureReason = error.message;
    payment.tapResponseMessage = error.message;
    await payment.save();
    return finalizeFailedRenewalFromPayment(payment, error.message);
  } finally {
    await Subscription.findByIdAndUpdate(subscription._id, {
      $set: { renewalProcessingAt: null },
    });
  }
};

export const processDueTapSubscriptionRenewals = async ({
  limit = Number(process.env.SUBSCRIPTION_RENEWAL_BATCH_SIZE || 20),
} = {}) => {
  const now = new Date();
  const expiringGraceSubscriptions = await Subscription.find({
    status: 'grace_period',
    gracePeriodEndsAt: { $lte: now },
  })
    .limit(limit)
    .populate('package')
    .populate('user', 'name email');

  for (const graceSubscription of expiringGraceSubscriptions) {
    const latestPayment = await populatePaymentQuery(
      Payment.findOne({ subscription: graceSubscription._id }).sort({ createdAt: -1 })
    );
    await expireSubscriptionAfterGrace(graceSubscription, latestPayment);
  }

  const dueSubscriptions = await Subscription.find({
    autoRenewEnabled: true,
    $or: [
      {
        status: 'active',
        endDate: { $lte: now },
      },
      {
        status: 'grace_period',
        gracePeriodEndsAt: { $gt: now },
        nextRenewalRetryAt: { $lte: now },
      },
    ],
  })
    .sort({ endDate: 1, nextRenewalRetryAt: 1, _id: 1 })
    .limit(limit)
    .select('_id');

  const results = {
    processed: 0,
    renewed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const dueSubscription of dueSubscriptions) {
    const payment = await processTapSubscriptionRenewal(dueSubscription._id);
    if (!payment) {
      results.skipped += 1;
      continue;
    }

    results.processed += 1;
    if (payment.status === 'captured' || payment.status === 'approved') {
      results.renewed += 1;
    } else {
      results.failed += 1;
    }
  }

  return results;
};

export const syncTapChargeForUser = async (userId, chargeId) => {
  const charge = await retrieveTapCharge(chargeId);
  const payment = await findPaymentForTapCharge(charge, userId);

  if (!payment) {
    throw new Error('Payment not found');
  }

  return applyTapChargeSnapshotToPayment(payment, charge, {
    activationSource: 'tap_redirect',
  });
};

export const processTapWebhook = async (chargePayload, hashString) => {
  const isSecure = await verifyTapChargeHashString(chargePayload, hashString);
  if (!isSecure) {
    throw new Error('Invalid Tap webhook signature.');
  }

  const payment = await findPaymentForTapCharge(chargePayload);
  if (!payment) {
    return null;
  }

  return applyTapChargeSnapshotToPayment(payment, chargePayload, {
    verifiedWebhook: true,
    activationSource: 'tap_webhook',
  });
};

export const getTapCheckoutConfig = () => {
  assertTapConfigured();

  return {
    publicKey: getTapPublicKey(),
    merchantId: getTapMerchantId() || null,
    sdkUrl: getTapCardSdkUrl(),
    currency: getSubscriptionCurrency(),
    billingProfileSetup: {
      amount: getBillingProfileSetupAmount(),
      currency: getBillingProfileSetupCurrency(),
    },
    applePay: {
      enabled: isTapApplePayConfigured(),
      merchantId: getTapMerchantId() || null,
      domain: getTapApplePayDomain() || null,
      environment: getTapApplePayEnvironment(),
      sdkUrl: getTapApplePaySdkUrl(),
      cssUrl: getTapApplePayCssUrl(),
    },
  };
};

export const getUserPayments = async (userId) => {
  return populatePaymentQuery(
    Payment.find({ user: userId }).sort({ createdAt: -1 })
  );
};

export const getAllPayments = async (status) => {
  return populatePaymentQuery(
    Payment.find(normalizePaymentFilter(status)).sort({ createdAt: -1 })
  );
};

export const getPaymentById = async (paymentId, requester) => {
  const payment = await populatePaymentQuery(
    Payment.findById(paymentId)
  );

  if (!payment) {
    throw new Error('Payment not found');
  }

  if (requester.role !== 'admin' && payment.user?._id?.toString() !== requester.id) {
    throw new Error('Access denied. Insufficient permissions.');
  }

  return payment;
};

export const removeTapBillingProfile = async (userId) => {
  const [billingProfile, currentSubscriptions] = await Promise.all([
    clearUserTapBillingProfile(userId),
    Subscription.find({
      user: userId,
      status: { $in: ['active', 'grace_period'] },
    }),
  ]);

  const now = new Date();
  await Promise.all(currentSubscriptions.map(async (subscription) => {
    subscription.autoRenewEnabled = false;
    subscription.autoRenewDisabledAt = now;
    subscription.autoRenewDisabledReason = 'member';
    subscription.nextRenewalRetryAt = null;
    await subscription.save();
  }));

  return billingProfile;
};

export const removePayment = async (paymentId) => {
  const payment = await Payment.findById(paymentId).populate('subscription');
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (
    isSuccessfulPaymentStatus(payment.status)
    && payment.paymentType !== 'renewal'
    && payment.subscription?.status === 'active'
  ) {
    payment.subscription.status = 'pending';
    payment.subscription.startDate = null;
    payment.subscription.endDate = null;
    payment.subscription.gracePeriodEndsAt = null;
    payment.subscription.approvedBy = null;
    payment.subscription.approvedAt = null;
    payment.subscription.activatedAt = null;
    payment.subscription.activationSource = null;
    payment.subscription.nextRenewalRetryAt = null;
    payment.subscription.autoRenewEnabled = false;
    payment.subscription.autoRenewDisabledAt = null;
    payment.subscription.autoRenewDisabledReason = null;
    await payment.subscription.save();
  }

  await payment.deleteOne();
  await deleteUploadPathIfExists(payment.proofFile);

  return payment;
};
