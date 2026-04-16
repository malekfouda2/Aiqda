import mongoose from 'mongoose';
import { PLATFORM_NOTICE_VERSION } from '../../config/platformNotice.js';

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
    enum: ['student', 'instructor', 'admin'],
    default: 'student'
  },
  avatar: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  mustChangePassword: {
    type: Boolean,
    default: false
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
}, {
  timestamps: true
});

userSchema.index({ 'authProviders.google.subject': 1 }, { sparse: true });
userSchema.index({ 'authProviders.linkedin.subject': 1 }, { sparse: true });

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.authProviders;
  return user;
};

export default mongoose.model('User', userSchema);
