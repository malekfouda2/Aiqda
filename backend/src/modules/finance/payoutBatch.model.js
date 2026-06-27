import mongoose from 'mongoose';

// A manual payout batch for one instructor. Amounts integer minor units. History is immutable.
const payoutBatchSchema = new mongoose.Schema({
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  currency: { type: String, default: 'SAR' },
  totalApprovedMinor: { type: Number, default: 0 },
  totalPaidMinor: { type: Number, default: 0 },
  totalRemainingMinor: { type: Number, default: 0 },
  recoveryAppliedMinor: { type: Number, default: 0 },
  earnings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InstructorEarning',
  }],
  settlementMethod: {
    type: String,
    enum: ['bank_transfer', 'cash', 'wallet', 'other'],
    default: 'bank_transfer',
  },
  settlementReference: { type: String, default: '' },
  settlementAt: { type: Date, default: null },
  proofFile: { type: String, default: null },
  notes: { type: String, default: '' },
  status: {
    type: String,
    enum: ['draft', 'awaiting_approval', 'approved', 'processing_manually', 'partially_paid', 'paid', 'cancelled', 'voided'],
    default: 'draft',
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  markedPaidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

payoutBatchSchema.index({ instructor: 1, status: 1 });

export default mongoose.model('PayoutBatch', payoutBatchSchema);
