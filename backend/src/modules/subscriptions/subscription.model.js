import mongoose from 'mongoose';

const billingOptionSchema = new mongoose.Schema({
  term: {
    type: String,
    enum: ['monthly', 'annual'],
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
    enum: ['monthly', 'annual'],
    default: 'monthly'
  },
  priceAtPurchase: {
    type: Number,
    default: null
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
    enum: ['pending', 'active', 'expired', 'cancelled'],
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
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

subscriptionSchema.methods.isValid = function() {
  if (this.status !== 'active') return false;
  if (!this.endDate) return false;
  return new Date() <= this.endDate;
};

export const SubscriptionPackage = mongoose.model('SubscriptionPackage', subscriptionPackageSchema);
export const Subscription = mongoose.model('Subscription', subscriptionSchema);
