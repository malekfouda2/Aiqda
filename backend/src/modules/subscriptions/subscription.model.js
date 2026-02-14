import mongoose from 'mongoose';

const subscriptionPackageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true
  },
  scheduleDuration: {
    type: String,
    required: true,
    trim: true
  },
  durationDays: {
    type: Number,
    default: 30
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
  coursesActivities: [{
    type: String
  }],
  softwareExposure: [{
    type: String
  }],
  outcome: {
    type: String,
    required: true,
    trim: true
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
