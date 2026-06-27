import mongoose from 'mongoose';

// The instructor earning ledger. One row per (payment, chapter, instructor). Amounts integer minor units.
const instructorEarningSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  financeTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinanceTransaction',
    required: true,
  },
  chapterEntitlement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChapterEntitlement',
    required: true,
  },
  grossBasisMinor: { type: Number, required: true, default: 0 },
  poolCapBpsSnapshot: { type: Number, default: 3000 },
  allocationBpsSnapshot: { type: Number, default: 0 },
  maxPotentialMinor: { type: Number, required: true, default: 0 },
  eligibleMinor: { type: Number, default: 0 },
  approvedMinor: { type: Number, default: 0 },
  paidMinor: { type: Number, default: 0 },
  recoveryMinor: { type: Number, default: 0 },
  completionBpsAtEligibility: { type: Number, default: 0 },
  completedRequired: { type: Number, default: 0 },
  totalRequired: { type: Number, default: 0 },
  eligibilityAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['pending_completion', 'eligible', 'on_hold', 'approved_for_payout', 'partially_paid', 'paid', 'voided', 'reversed'],
    default: 'pending_completion',
  },
  holdReason: { type: String, default: '' },
  voidReason: { type: String, default: '' },
  payoutBatches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayoutBatch',
  }],
}, { timestamps: true });

instructorEarningSchema.index({ financeTransaction: 1, course: 1, instructor: 1 }, { unique: true });
instructorEarningSchema.index({ instructor: 1, status: 1 });
instructorEarningSchema.index({ user: 1, course: 1, status: 1 });

export default mongoose.model('InstructorEarning', instructorEarningSchema);
