import Payment from './payment.model.js';
import { Subscription } from '../subscriptions/subscription.model.js';

export const submitPayment = async (userId, paymentData) => {
  const { subscriptionId, amount, paymentReference, proofFile } = paymentData;

  const subscription = await Subscription.findOne({
    _id: subscriptionId,
    user: userId,
    status: 'pending'
  });

  if (!subscription) {
    throw new Error('No pending subscription found');
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
    amount,
    paymentReference,
    proofFile
  });

  await payment.save();
  return payment.populate(['user', 'subscription']);
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

export const getPaymentById = async (paymentId) => {
  const payment = await Payment.findById(paymentId)
    .populate('user', 'name email')
    .populate('subscription');
  if (!payment) {
    throw new Error('Payment not found');
  }
  return payment;
};

export const approvePayment = async (paymentId, adminId) => {
  const payment = await Payment.findById(paymentId).populate('subscription');
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
    endDate.setDate(endDate.getDate() + subscription.package.durationDays);

    subscription.status = 'active';
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.approvedBy = adminId;
    subscription.approvedAt = new Date();
    await subscription.save();
  }

  return payment;
};

export const rejectPayment = async (paymentId, adminId, reason) => {
  const payment = await Payment.findById(paymentId);
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
