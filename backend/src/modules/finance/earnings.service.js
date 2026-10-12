import Payment from '../payments/payment.model.js';
import { Subscription } from '../subscriptions/subscription.model.js';
import FinanceTransaction from './financeTransaction.model.js';
import { toMinor, applyBps, INSTRUCTOR_POOL_BPS } from './finance.money.js';
import { recordFinanceAudit } from './audit.service.js';

const SUCCESS_STATUSES = ['approved', 'captured'];

const mapTransactionType = (paymentType) => {
  if (paymentType === 'renewal' || paymentType === 'recovery') return 'renewal';
  return 'initial';
};

// Best-effort gateway fee from the stored Tap snapshot. Tap does not reliably expose a
// per-charge fee, so this returns 0 (estimated=false) when nothing is found. The pool is
// never reduced by this value; it is informational only.
const extractGatewayFeeMinor = (payment) => {
  const snap = payment?.chargeSnapshot;
  const candidate = snap?.fee ?? snap?.response?.fee ?? snap?.fees ?? null;
  if (candidate == null) return { gatewayFeeMinor: 0, gatewayFeeEstimated: false };
  return { gatewayFeeMinor: toMinor(candidate), gatewayFeeEstimated: false };
};

// Idempotently record a successful subscription payment in the finance ledger. This only books
// the money: creator earnings are created later, when a member completes 80% of a chapter
// (eligibility.service.js), and are funded from the member's latest payment at that moment.
// Safe to call multiple times (webhook/renewal retries): one root FinanceTransaction per payment.
export const generateEarningsForPayment = async (paymentInput) => {
  const paymentId = paymentInput?._id || paymentInput;
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) return null;
  if (!payment.subscription) return null; // only subscription payments fund instructors
  if (!SUCCESS_STATUSES.includes(payment.status)) return null;

  const grossMinor = toMinor(payment.amount);
  if (grossMinor <= 0) return null; // skip free/zero-value payments

  const existing = await FinanceTransaction.findOne({ payment: payment._id, parentTransaction: null });
  if (existing) {
    return existing;
  }

  const subscription = await Subscription.findById(payment.subscription).lean();
  if (!subscription?.package) return null;

  let transaction;
  try {
    transaction = await FinanceTransaction.create({
      payment: payment._id,
      user: payment.user,
      subscription: payment.subscription,
      subscriptionPackage: subscription.package,
      type: mapTransactionType(payment.paymentType),
      grossPaidMinor: grossMinor,
      discountMinor: 0,
      ...extractGatewayFeeMinor(payment),
      currency: payment.currency || 'SAR',
      status: 'recorded',
      paidAt: payment.createdAt || new Date(),
      entitlementStart: subscription.startDate || null,
      entitlementEnd: subscription.endDate || null,
      tapChargeId: payment.tapChargeId || null,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return FinanceTransaction.findOne({ payment: payment._id, parentTransaction: null });
    }
    throw error;
  }

  await recordFinanceAudit({
    actorType: 'system',
    action: 'payment.recorded',
    targetType: 'FinanceTransaction',
    targetId: transaction._id,
    newState: { grossMinor, poolMinor: applyBps(grossMinor, INSTRUCTOR_POOL_BPS) },
    relatedRef: payment._id?.toString(),
  });

  return transaction;
};
