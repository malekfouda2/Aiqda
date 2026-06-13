import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'SAR'
  },
  provider: {
    type: String,
    default: 'tap'
  },
  paymentReference: {
    type: String,
    default: null,
    trim: true
  },
  proofFile: {
    type: String,
    default: null
  },
  checkoutDisclaimerVersion: {
    type: String,
    default: null
  },
  checkoutDisclaimerAcceptedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['submitted', 'approved', 'rejected', 'initiated', 'captured', 'failed', 'cancelled'],
    default: 'initiated'
  },
  customerInitiated: {
    type: Boolean,
    default: true
  },
  threeDSecure: {
    type: Boolean,
    default: true
  },
  saveCard: {
    type: Boolean,
    default: true
  },
  paymentType: {
    type: String,
    enum: ['initial', 'renewal', 'recovery'],
    default: 'initial'
  },
  checkoutMethod: {
    type: String,
    enum: ['card', 'apple_pay', 'saved_card'],
    default: 'card'
  },
  renewalCycleKey: {
    type: String,
    trim: true,
    default: null,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  bankName: {
    type: String,
    default: 'Bank Albilad'
  },
  tapChargeId: {
    type: String,
    trim: true,
    default: null,
    index: true,
  },
  tapCustomerId: {
    type: String,
    trim: true,
    default: null,
  },
  tapCardId: {
    type: String,
    trim: true,
    default: null,
  },
  tapPaymentAgreementId: {
    type: String,
    trim: true,
    default: null,
  },
  tapTransactionReference: {
    type: String,
    trim: true,
    default: null,
  },
  tapOrderReference: {
    type: String,
    trim: true,
    default: null,
  },
  tapGatewayReference: {
    type: String,
    trim: true,
    default: null,
  },
  tapResponseCode: {
    type: String,
    trim: true,
    default: null,
  },
  tapResponseMessage: {
    type: String,
    trim: true,
    default: null,
  },
  tapRedirectUrl: {
    type: String,
    trim: true,
    default: null,
  },
  tapWebhookVerifiedAt: {
    type: Date,
    default: null,
  },
  tapChargeStatus: {
    type: String,
    trim: true,
    default: null,
  },
  failureReason: {
    type: String,
    default: null,
  },
  chargeSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  }
}, {
  timestamps: true
});

paymentSchema.index(
  { subscription: 1, renewalCycleKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      renewalCycleKey: { $type: 'string' },
    },
  }
);

export default mongoose.model('Payment', paymentSchema);
