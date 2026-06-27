import mongoose from 'mongoose';
import { PLATFORM_NOTICE_VERSION } from '../../config/platformNotice.js';
import { USER_ROLES } from '../../utils/roles.js';

const socialProviderSchema = new mongoose.Schema({
  subject: {
    type: String,
    trim: true,
    default: null,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: null,
  },
  linkedAt: {
    type: Date,
    default: null,
  },
}, {
  _id: false,
});

const platformNoticeAcknowledgementSchema = new mongoose.Schema({
  version: {
    type: String,
    trim: true,
    default: PLATFORM_NOTICE_VERSION,
  },
  acceptedAt: {
    type: Date,
    default: null,
  },
}, {
  _id: false,
});

const authorizedDeviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    trim: true,
  },
  firstSeenAt: {
    type: Date,
    default: Date.now,
  },
  lastSeenAt: {
    type: Date,
    default: null,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  lastUserAgent: {
    type: String,
    trim: true,
    default: '',
  },
  lastIpAddress: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  _id: false,
});

const currentSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    trim: true,
    default: null,
  },
  deviceId: {
    type: String,
    trim: true,
    default: null,
  },
  startedAt: {
    type: Date,
    default: null,
  },
  lastSeenAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
}, {
  _id: false,
});

const phoneSchema = new mongoose.Schema({
  countryCode: {
    type: String,
    trim: true,
    default: '',
  },
  number: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  _id: false,
});

const passwordResetSchema = new mongoose.Schema({
  tokenHash: {
    type: String,
    trim: true,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  requestedAt: {
    type: Date,
    default: null,
  },
}, {
  _id: false,
});

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: false,
    default: null,
    minlength: 6
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: USER_ROLES,
    default: 'student'
  },
  avatar: {
    type: String,
    default: null
  },
  phone: {
    type: phoneSchema,
    default: () => ({
      countryCode: '',
      number: '',
    }),
  },
  isActive: {
    type: Boolean,
    default: true
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  passwordReset: {
    type: passwordResetSchema,
    default: null,
  },
  authProviders: {
    google: {
      type: socialProviderSchema,
      default: () => ({}),
    },
    linkedin: {
      type: socialProviderSchema,
      default: () => ({}),
    },
  },
  platformNoticeAcknowledgement: {
    type: platformNoticeAcknowledgementSchema,
    default: null,
  },
  assignedPackages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPackage',
  }],
  authorizedDevices: {
    type: [authorizedDeviceSchema],
    default: [],
  },
  currentSession: {
    type: currentSessionSchema,
    default: null,
  },
  currentSessions: {
    type: [currentSessionSchema],
    default: [],
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
  tapCardBrand: {
    type: String,
    trim: true,
    default: null,
  },
  tapCardFunding: {
    type: String,
    trim: true,
    default: null,
  },
  tapCardLastFour: {
    type: String,
    trim: true,
    default: null,
  },
  tapBillingProfileUpdatedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true
});

userSchema.index({ 'authProviders.google.subject': 1 }, { sparse: true });
userSchema.index({ 'authProviders.linkedin.subject': 1 }, { sparse: true });

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  user.billingProfile = {
    hasSavedCard: Boolean(user.tapCustomerId && user.tapCardId && user.tapPaymentAgreementId),
    cardBrand: user.tapCardBrand || null,
    cardFunding: user.tapCardFunding || null,
    cardLastFour: user.tapCardLastFour || null,
    updatedAt: user.tapBillingProfileUpdatedAt || null,
  };
  delete user.password;
  delete user.passwordReset;
  delete user.authProviders;
  delete user.authorizedDevices;
  delete user.currentSession;
  delete user.currentSessions;
  delete user.tapCustomerId;
  delete user.tapCardId;
  delete user.tapPaymentAgreementId;
  delete user.tapCardBrand;
  delete user.tapCardFunding;
  delete user.tapCardLastFour;
  delete user.tapBillingProfileUpdatedAt;
  return user;
};

export default mongoose.model('User', userSchema);
