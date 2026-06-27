import PayoutBatch from './payoutBatch.model.js';
import InstructorEarning from './instructorEarning.model.js';
import { toMinor } from './finance.money.js';
import { recordFinanceAudit } from './audit.service.js';

const ACTIVE_BATCH_STATUSES = ['draft', 'awaiting_approval', 'approved', 'processing_manually', 'partially_paid'];
const PAYABLE_EARNING_STATUSES = ['approved_for_payout', 'partially_paid'];

const payableOf = (earning) => Math.max(0, (earning.approvedMinor || 0) - (earning.paidMinor || 0));

// Outstanding recovery the instructor still owes, net of amounts already reserved by active batches.
const outstandingRecoveryMinor = async (instructorId) => {
  const earnings = await InstructorEarning.find({ instructor: instructorId, recoveryMinor: { $gt: 0 } })
    .select('recoveryMinor').lean();
  const totalRecovery = earnings.reduce((acc, e) => acc + (e.recoveryMinor || 0), 0);

  const activeBatches = await PayoutBatch.find({
    instructor: instructorId,
    status: { $in: ACTIVE_BATCH_STATUSES },
  }).select('recoveryAppliedMinor').lean();
  const reserved = activeBatches.reduce((acc, b) => acc + (b.recoveryAppliedMinor || 0), 0);

  return Math.max(0, totalRecovery - reserved);
};

// Bulk earning actions for the earnings queue.
export const bulkUpdateEarnings = async (earningIds, action, actor = null, reason = '') => {
  const earnings = await InstructorEarning.find({ _id: { $in: earningIds } });
  const actorId = actor?.id || actor?._id || null;
  const touched = [];

  for (const earning of earnings) {
    const oldStatus = earning.status;
    if (action === 'approve' && earning.status === 'eligible') {
      earning.status = 'approved_for_payout';
      earning.approvedMinor = earning.eligibleMinor;
    } else if (action === 'hold' && ['eligible', 'approved_for_payout'].includes(earning.status)) {
      earning.status = 'on_hold';
      earning.holdReason = reason;
    } else if (action === 'release' && earning.status === 'on_hold') {
      earning.status = 'eligible';
      earning.holdReason = '';
    } else if (action === 'void' && !['paid', 'reversed'].includes(earning.status)) {
      earning.status = 'voided';
      earning.voidReason = reason;
      earning.eligibleMinor = 0;
      earning.approvedMinor = 0;
    } else {
      continue;
    }
    await earning.save();
    await recordFinanceAudit({
      actorType: actor ? 'admin' : 'system',
      actorId,
      action: `earning.${action}`,
      targetType: 'InstructorEarning',
      targetId: earning._id,
      oldState: { status: oldStatus },
      newState: { status: earning.status },
      reason,
    });
    touched.push(earning);
  }
  return touched;
};

// Create a draft payout batch for an instructor from approved, unpaid earnings.
export const createBatch = async (instructorId, earningIds, actor = null) => {
  const candidates = await InstructorEarning.find({
    _id: { $in: earningIds },
    instructor: instructorId,
    status: { $in: PAYABLE_EARNING_STATUSES },
  });

  const selected = [];
  for (const earning of candidates) {
    if (payableOf(earning) <= 0) continue;
    const inActive = await PayoutBatch.exists({
      earnings: earning._id,
      status: { $in: ACTIVE_BATCH_STATUSES },
    });
    if (inActive) continue; // an earning can be in only one active batch
    selected.push(earning);
  }

  if (selected.length === 0) {
    throw new Error('No eligible unpaid earnings to include in a batch.');
  }

  const totalApprovedMinor = selected.reduce((acc, e) => acc + payableOf(e), 0);
  const recovery = await outstandingRecoveryMinor(instructorId);
  const recoveryAppliedMinor = Math.min(recovery, totalApprovedMinor);
  const totalRemainingMinor = totalApprovedMinor - recoveryAppliedMinor;
  const actorId = actor?.id || actor?._id || null;

  const batch = await PayoutBatch.create({
    instructor: instructorId,
    currency: 'SAR',
    totalApprovedMinor,
    totalPaidMinor: 0,
    totalRemainingMinor,
    recoveryAppliedMinor,
    earnings: selected.map((e) => e._id),
    status: 'draft',
    createdBy: actorId,
  });

  for (const earning of selected) {
    earning.payoutBatches.push(batch._id);
    await earning.save();
  }

  await recordFinanceAudit({
    actorType: actor ? 'admin' : 'system',
    actorId,
    action: 'payout.batch_created',
    targetType: 'PayoutBatch',
    targetId: batch._id,
    newState: { totalApprovedMinor, recoveryAppliedMinor, totalRemainingMinor, earnings: selected.length },
  });

  return batch;
};

export const approveBatch = async (batchId, actor = null) => {
  const batch = await PayoutBatch.findById(batchId);
  if (!batch) throw new Error('Payout batch not found.');
  if (!['draft', 'awaiting_approval'].includes(batch.status)) {
    throw new Error('Only draft batches can be approved.');
  }
  batch.status = 'approved';
  batch.approvedBy = actor?.id || actor?._id || null;
  await batch.save();
  await recordFinanceAudit({
    actorType: 'admin',
    actorId: batch.approvedBy,
    action: 'payout.batch_approved',
    targetType: 'PayoutBatch',
    targetId: batch._id,
  });
  return batch;
};

// Record a manual settlement (full or partial) against an approved batch.
export const settleBatch = async (batchId, {
  paidAmount = null, settlementMethod = 'bank_transfer', settlementReference = '', proofFile = null, notes = '',
} = {}, actor = null) => {
  const batch = await PayoutBatch.findById(batchId).populate('earnings');
  if (!batch) throw new Error('Payout batch not found.');
  if (!['approved', 'processing_manually', 'partially_paid'].includes(batch.status)) {
    throw new Error('Batch must be approved before settlement.');
  }

  const payNowMinor = paidAmount == null ? batch.totalRemainingMinor : toMinor(paidAmount);
  if (payNowMinor <= 0 || payNowMinor > batch.totalRemainingMinor) {
    throw new Error('Invalid settlement amount.');
  }

  // Distribute the payment across the batch's earnings, in order, up to each earning's payable.
  let remainingToApply = payNowMinor;
  for (const earning of batch.earnings) {
    if (remainingToApply <= 0) break;
    const payable = payableOf(earning);
    if (payable <= 0) continue;
    const applied = Math.min(payable, remainingToApply);
    earning.paidMinor += applied;
    remainingToApply -= applied;
    earning.status = payableOf(earning) <= 0 ? 'paid' : 'partially_paid';
    await earning.save();
  }

  batch.totalPaidMinor += payNowMinor;
  batch.totalRemainingMinor -= payNowMinor;
  batch.settlementMethod = settlementMethod;
  batch.settlementReference = settlementReference;
  batch.proofFile = proofFile;
  batch.notes = notes;
  batch.settlementAt = new Date();
  batch.markedPaidBy = actor?.id || actor?._id || null;
  batch.status = batch.totalRemainingMinor <= 0 ? 'paid' : 'partially_paid';

  // On full settlement, clear the recovery this batch reserved.
  if (batch.status === 'paid' && batch.recoveryAppliedMinor > 0) {
    let toClear = batch.recoveryAppliedMinor;
    const recoveryEarnings = await InstructorEarning.find({
      instructor: batch.instructor, recoveryMinor: { $gt: 0 },
    });
    for (const earning of recoveryEarnings) {
      if (toClear <= 0) break;
      const clear = Math.min(earning.recoveryMinor, toClear);
      earning.recoveryMinor -= clear;
      toClear -= clear;
      await earning.save();
    }
  }

  await batch.save();
  await recordFinanceAudit({
    actorType: 'admin',
    actorId: batch.markedPaidBy,
    action: 'payout.batch_settled',
    targetType: 'PayoutBatch',
    targetId: batch._id,
    newState: { paidMinor: payNowMinor, status: batch.status },
  });
  return batch;
};

export const cancelBatch = async (batchId, actor = null) => {
  const batch = await PayoutBatch.findById(batchId);
  if (!batch) throw new Error('Payout batch not found.');
  if (['paid', 'cancelled', 'voided'].includes(batch.status)) {
    throw new Error('Batch cannot be cancelled.');
  }
  batch.status = 'cancelled';
  await batch.save();
  await InstructorEarning.updateMany(
    { _id: { $in: batch.earnings } },
    { $pull: { payoutBatches: batch._id } },
  );
  await recordFinanceAudit({
    actorType: 'admin',
    actorId: actor?.id || actor?._id || null,
    action: 'payout.batch_cancelled',
    targetType: 'PayoutBatch',
    targetId: batch._id,
  });
  return batch;
};

export const listBatches = async (instructorId = null) => {
  const query = {};
  if (instructorId) query.instructor = instructorId;
  return PayoutBatch.find(query)
    .populate('instructor', 'name email')
    .sort({ createdAt: -1 })
    .lean();
};
