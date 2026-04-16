import Payment from './payment.model.js';
import { Subscription } from '../subscriptions/subscription.model.js';
import {
  CHECKOUT_DISCLAIMER_ERROR_MESSAGE,
  hasAcceptedCheckoutDisclaimer,
  REFUND_POLICY_VERSION
} from '../../config/refundPolicy.js';
import { sendEmail } from '../../utils/email.js';
import {
  buildPaymentSubmittedEmail,
  buildPaymentApprovedEmail,
  buildPaymentRejectedEmail
} from '../../utils/emailTemplates.js';

export const submitPayment = async (userId, paymentData) => {
  const { subscriptionId, amount, paymentReference, proofFile, checkoutDisclaimerAccepted } = paymentData;

  const subscription = await Subscription.findOne({
    _id: subscriptionId,
    user: userId,
    status: 'pending'
  }).populate('package');

  if (!subscription) {
    throw new Error('No pending subscription found');
  }

  if (!proofFile) {
    throw new Error('Payment proof is required');
  }

  if (!hasAcceptedCheckoutDisclaimer(checkoutDisclaimerAccepted)) {
    throw new Error(CHECKOUT_DISCLAIMER_ERROR_MESSAGE);
  }

  if (!paymentReference?.trim()) {
    throw new Error('Payment reference is required');
  }

  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('A valid payment amount is required');
  }

  const expectedAmount = Number(subscription.priceAtPurchase ?? subscription.package?.price);
  if (Number.isFinite(expectedAmount) && normalizedAmount !== expectedAmount) {
    throw new Error(`Payment amount must match the package price of ${expectedAmount} SAR`);
  }

  const existingPayment = await Payment.findOne({
    subscription: subscriptionId,
    status: { $in: ['submitted', 'approved'] }
  });

  if (existingPayment) {
    throw new Error('A payment has already been submitted for this subscription');
  }

  const payment = new Payment({
    user: userId,
    subscription: subscriptionId,
    amount: normalizedAmount,
    paymentReference: paymentReference.trim(),
    proofFile,
    checkoutDisclaimerVersion: REFUND_POLICY_VERSION,
    checkoutDisclaimerAcceptedAt: new Date()
  });

  await payment.save();
  const populatedPayment = await payment.populate([
    { path: 'user', select: 'name email' },
    {
      path: 'subscription',
      populate: { path: 'package', select: 'name' }
    }
  ]);

  const submittedEmail = buildPaymentSubmittedEmail({
    recipientName: populatedPayment.user.name,
    packageName: populatedPayment.subscription?.package?.name || 'your subscription',
    amount: normalizedAmount,
    paymentReference: payment.paymentReference,
  });

  try {
    await sendEmail({
      to: populatedPayment.user.email,
      subject: submittedEmail.subject,
      text: submittedEmail.text,
      html: submittedEmail.html,
    });
  } catch (error) {
    console.error('Failed to send payment submission acknowledgement email:', error.message);
  }

  return populatedPayment;
};

export const getUserPayments = async (userId) => {
  return Payment.find({ user: userId })
    .populate('subscription')
    .sort({ createdAt: -1 });
};

export const getAllPayments = async (status) => {
  const query = status ? { status } : {};
  return Payment.find(query)
    .populate('user', 'name email')
    .populate('subscription')
    .sort({ createdAt: -1 });
};

export const getPaymentById = async (paymentId, requester) => {
  const payment = await Payment.findById(paymentId)
    .populate('user', 'name email')
    .populate('subscription');
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (requester.role !== 'admin' && payment.user?._id?.toString() !== requester.id) {
    throw new Error('Access denied. Insufficient permissions.');
  }

  return payment;
};

export const approvePayment = async (paymentId, adminId) => {
  const payment = await Payment.findById(paymentId)
    .populate('subscription')
    .populate('user', 'name email');
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (payment.status !== 'submitted') {
    throw new Error('Payment is not pending review');
  }

  payment.status = 'approved';
  payment.reviewedBy = adminId;
  payment.reviewedAt = new Date();
  await payment.save();

  const subscription = await Subscription.findById(payment.subscription._id).populate('package');
  if (subscription && subscription.status === 'pending') {
    const startDate = new Date();
    const endDate = new Date();
    const accessDurationDays = Number(
      subscription.durationDaysSnapshot ?? subscription.package?.durationDays ?? 30
    ) || 30;
    endDate.setDate(endDate.getDate() + accessDurationDays);

    subscription.status = 'active';
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.approvedBy = adminId;
    subscription.approvedAt = new Date();
    await subscription.save();

    const approvalEmail = buildPaymentApprovedEmail({
      recipientName: payment.user.name,
      packageName: subscription.package?.name || 'your subscription',
      endDate: subscription.endDate?.toLocaleDateString(),
    });
    try {
      await sendEmail({
        to: payment.user.email,
        subject: approvalEmail.subject,
        text: approvalEmail.text,
        html: approvalEmail.html,
      });
    } catch (error) {
      console.error('Failed to send payment approval email:', error.message);
    }
  }

  return payment;
};

export const rejectPayment = async (paymentId, adminId, reason) => {
  const payment = await Payment.findById(paymentId)
    .populate({
      path: 'subscription',
      populate: { path: 'package', select: 'name' }
    })
    .populate('user', 'name email');
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (payment.status !== 'submitted') {
    throw new Error('Payment is not pending review');
  }

  payment.status = 'rejected';
  payment.reviewedBy = adminId;
  payment.reviewedAt = new Date();
  payment.rejectionReason = reason;
  await payment.save();

  const rejectionEmail = buildPaymentRejectedEmail({
    recipientName: payment.user.name,
    packageName: payment.subscription?.package?.name || 'your subscription',
    reason,
  });
  try {
    await sendEmail({
      to: payment.user.email,
      subject: rejectionEmail.subject,
      text: rejectionEmail.text,
      html: rejectionEmail.html,
    });
  } catch (error) {
    console.error('Failed to send payment rejection email:', error.message);
  }

  return payment;
};

export const getBankDetails = () => {
  return {
    bankName: 'Bank Albilad',
    accountName: 'Aiqda Education Platform',
    accountNumber: 'XXXX-XXXX-XXXX-1234',
    iban: 'SA00 0000 0000 0000 0000 0000',
    swiftCode: 'ALBISAKR'
  };
};
