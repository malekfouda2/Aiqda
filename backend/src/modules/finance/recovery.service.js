import FinanceTransaction from './financeTransaction.model.js';
import InstructorEarning from './instructorEarning.model.js';
import { toMinor, FULL_BPS } from './finance.money.js';
import { recordFinanceAudit } from './audit.service.js';

// Handle a refund or chargeback against a payment. Reverses unpaid earnings (void / proportional
// reduction) and turns already-paid earnings into instructor recovery balances. Idempotent-ish:
// a fully-reversed/voided earning is skipped on repeat calls.
// `reversedAmount` is a decimal SAR amount (defaults to the full gross). `kind` is 'refund' | 'chargeback'.
export const handlePaymentReversal = async (payment, { reversedAmount = null, kind = 'refund' } = {}) => {
  const paymentId = payment?._id || payment;
  const parent = await FinanceTransaction.findOne({ payment: paymentId });
  if (!parent) {
    return null; // payment predates the finance module / not a subscription payment
  }

  const reversedMinor = reversedAmount == null ? parent.grossPaidMinor : toMinor(reversedAmount);
  const proportion = parent.grossPaidMinor > 0
    ? Math.min(1, Math.max(0, reversedMinor / parent.grossPaidMinor))
    : 1;
  const isFull = proportion >= 1;

  // Record the reversal as a child finance transaction.
  const reversalType = kind === 'chargeback'
    ? 'chargeback'
    : (isFull ? 'refund' : 'partial_refund');
  await FinanceTransaction.create({
    payment: parent.payment,
    user: parent.user,
    subscription: parent.subscription,
    subscriptionPackage: parent.subscriptionPackage,
    type: reversalType,
    grossPaidMinor: 0,
    refundedMinor: kind === 'chargeback' ? 0 : reversedMinor,
    chargebackMinor: kind === 'chargeback' ? reversedMinor : 0,
    currency: parent.currency,
    status: 'recorded',
    paidAt: new Date(),
    parentTransaction: parent._id,
  });

  parent.refundedMinor += kind === 'chargeback' ? 0 : reversedMinor;
  parent.chargebackMinor += kind === 'chargeback' ? reversedMinor : 0;
  await parent.save();

  const earnings = await InstructorEarning.find({ financeTransaction: parent._id });
  const results = [];
  for (const earning of earnings) {
    if (['voided', 'reversed'].includes(earning.status)) {
      continue;
    }
    const oldStatus = earning.status;

    if (earning.paidMinor > 0) {
      const rec = Math.floor((earning.paidMinor * Math.round(proportion * FULL_BPS)) / FULL_BPS);
      earning.recoveryMinor += rec;
      earning.status = 'reversed';
      earning.voidReason = kind;
    } else if (isFull) {
      earning.status = 'voided';
      earning.voidReason = kind;
      earning.eligibleMinor = 0;
      earning.approvedMinor = 0;
    } else {
      const keepBps = FULL_BPS - Math.round(proportion * FULL_BPS);
      earning.maxPotentialMinor = Math.floor((earning.maxPotentialMinor * keepBps) / FULL_BPS);
      earning.eligibleMinor = Math.floor((earning.eligibleMinor * keepBps) / FULL_BPS);
      earning.approvedMinor = Math.floor((earning.approvedMinor * keepBps) / FULL_BPS);
    }

    await earning.save();
    await recordFinanceAudit({
      actorType: 'system',
      action: `earning.${kind}`,
      targetType: 'InstructorEarning',
      targetId: earning._id,
      oldState: { status: oldStatus },
      newState: { status: earning.status, recoveryMinor: earning.recoveryMinor, proportion },
    });
    results.push(earning);
  }

  return { reversedMinor, proportion, affected: results.length };
};

// Total outstanding (unsettled) recovery balance an instructor still owes.
export const getOutstandingRecoveryMinor = async (instructorId) => {
  const rows = await InstructorEarning.aggregate([
    { $match: { instructor: typeof instructorId === 'string' ? null : instructorId } },
    { $group: { _id: null, total: { $sum: '$recoveryMinor' } } },
  ]);
  return rows[0]?.total || 0;
};
