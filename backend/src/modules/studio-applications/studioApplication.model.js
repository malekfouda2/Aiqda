import mongoose from 'mongoose';

const studioApplicationSchema = new mongoose.Schema({
  studioName: {
    type: String,
    required: true,
    trim: true
  },
  contactEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  yearEstablished: {
    type: String,
    required: true
  },
  countryOfRegistration: {
    type: String,
    required: true
  },
  websitePortfolio: {
    type: String,
    required: true
  },
  studioType: {
    type: String,
    enum: ['Animation Studio', 'VFX Studio'],
    required: true
  },
  videoResolutionAck: {
    type: Boolean,
    required: true,
    validate: {
      validator: (v) => v === true,
      message: 'Video resolution acknowledgment is mandatory'
    }
  },
  videoFileSizes: {
    type: [String],
    required: true
  },
  videoFormats: {
    type: [String],
    required: true
  },
  frameRates: {
    type: [String],
    required: true
  },
  audioSpecAck: {
    type: Boolean,
    required: true,
    validate: {
      validator: (v) => v === true,
      message: 'Audio specification acknowledgment is mandatory'
    }
  },
  audioFrequencyAck: {
    type: Boolean,
    required: true,
    validate: {
      validator: (v) => v === true,
      message: 'Audio frequency acknowledgment is mandatory'
    }
  },
  domains: {
    type: [String],
    required: true
  },
  objectives: {
    type: [String],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
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
  approvalEmailSentAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

export default mongoose.model('StudioApplication', studioApplicationSchema);
