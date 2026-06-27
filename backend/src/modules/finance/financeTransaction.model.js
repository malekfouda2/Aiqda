import mongoose from 'mongoose';

// One row per money event, mirrored from a Payment. Amounts are integer minor units.
const financeTransactionSchema = new mongoose.Schema({
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    default: null,
  },
  subscriptionPackage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPackage',
    default: null,
  },
  type: {
    type: String,
    enum: ['initial', 'renewal', 'upgrade', 'downgrade', 'refund', 'partial_refund', 'chargeback', 'manual_adjustment'],
    required: true,
  },
  grossPaidMinor: { type: Number, required: true, default: 0 },
  discountMinor: { type: Number, default: 0 },
  gatewayFeeMinor: { type: Number, default: 0 },
  gatewayFeeEstimated: { type: Boolean, default: false },
  refundedMinor: { type: Number, default: 0 },
  chargebackMinor: { type: Number, default: 0 },
  currency: { type: String, default: 'SAR' },
  status: { type: String, default: 'recorded' },
  paidAt: { type: Date, default: null },
  entitlementStart: { type: Date, default: null },
  entitlementEnd: { type: Date, default: null },
  tapChargeId: { type: String, default: null },
  parentTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinanceTransaction',
    default: null,
  },
}, { timestamps: true });

financeTransactionSchema.index({ user: 1, createdAt: -1 });
// One root (non-reversal) transaction per payment guarantees idempotent earning generation.
financeTransactionSchema.index(
  { payment: 1 },
  { unique: true, partialFilterExpression: { parentTransaction: null } },
);

export default mongoose.model('FinanceTransaction', financeTransactionSchema);
