import mongoose from 'mongoose';

const billingOptionSchema = new mongoose.Schema({
  term: {
    type: String,
    enum: ['monthly', 'six_months', 'annual'],
    required: true,
  },
  label: {
    type: String,
    trim: true,
    default: null,
  },
  price: {
    type: Number,
    required: true,
  },
  salePrice: {
    type: Number,
    default: null,
  },
  durationDays: {
    type: Number,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  _id: false,
});

const subscriptionPackageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    default: null
  },
  billingOptions: {
    type: [billingOptionSchema],
    default: []
  },
  scheduleDuration: {
    type: String,
    required: true,
    trim: true
  },
  durationDays: {
    type: Number,
    default: null
  },
  learningMode: {
    type: String,
    required: true,
    trim: true
  },
  focus: {
    type: String,
    required: true,
    trim: true
  },
  courses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  includedPackages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPackage'
  }],
  softwareExposure: [{
    type: String
  }],
  outcome: {
    type: String,
    required: true,
    trim: true
  },
  purchaseMode: {
    type: String,
    enum: ['self_serve', 'contact_only'],
    default: 'self_serve'
  },
  publicVisibility: {
    type: String,
    enum: ['visible', 'coming_soon', 'hidden'],
    default: 'visible'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPackage',
    required: true
  },
  billingTerm: {
    type: String,
    enum: ['monthly', 'six_months', 'annual'],
    default: 'monthly'
  },
  priceAtPurchase: {
    type: Number,
    default: null
  },
  currency: {
    type: String,
    default: 'SAR'
  },
  durationDaysSnapshot: {
    type: Number,
    default: null
  },
  purchaseModeSnapshot: {
    type: String,
    enum: ['self_serve', 'contact_only'],
    default: 'self_serve'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'grace_period', 'expired', 'cancelled'],
    default: 'pending'
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  gracePeriodEndsAt: {
    type: Date,
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  activatedAt: {
    type: Date,
    default: null
  },
  activationSource: {
    type: String,
    default: null
  },
  autoRenewEnabled: {
    type: Boolean,
    default: false
  },
  autoRenewDisabledAt: {
    type: Date,
    default: null
  },
  autoRenewDisabledReason: {
    type: String,
    enum: ['member', 'admin', 'payment_failed'],
    default: null
  },
  lastRenewalAttemptAt: {
    type: Date,
    default: null
  },
  lastRenewalAt: {
    type: Date,
    default: null
  },
  nextRenewalRetryAt: {
    type: Date,
    default: null
  },
  renewalFailureReason: {
    type: String,
    default: null
  },
  renewalFailureCount: {
    type: Number,
    default: 0
  },
  renewalProcessingAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

subscriptionSchema.methods.isValid = function() {
  const now = new Date();

  if (this.status === 'active') {
    return Boolean(this.endDate) && now <= this.endDate;
  }

  if (this.status === 'grace_period') {
    return Boolean(this.gracePeriodEndsAt) && now <= this.gracePeriodEndsAt;
  }

  return false;
};

export const SubscriptionPackage = mongoose.model('SubscriptionPackage', subscriptionPackageSchema);
export const Subscription = mongoose.model('Subscription', subscriptionSchema);
