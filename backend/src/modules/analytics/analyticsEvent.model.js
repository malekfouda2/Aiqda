import mongoose from 'mongoose';

const analyticsEventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  path: {
    type: String,
    default: '/',
    trim: true,
  },
  title: {
    type: String,
    default: '',
    trim: true,
  },
  locale: {
    type: String,
    enum: ['en', 'ar', null],
    default: null,
  },
  userRole: {
    type: String,
    default: '',
    trim: true,
    maxlength: 80,
  },
  visitorId: {
    type: String,
    default: '',
    trim: true,
  },
  sessionId: {
    type: String,
    default: '',
    trim: true,
  },
  referrer: {
    type: String,
    default: '',
    trim: true,
  },
  userAgent: {
    type: String,
    default: '',
    trim: true,
  },
  utmSource: {
    type: String,
    default: '',
    trim: true,
  },
  utmMedium: {
    type: String,
    default: '',
    trim: true,
  },
  utmCampaign: {
    type: String,
    default: '',
    trim: true,
  },
  utmTerm: {
    type: String,
    default: '',
    trim: true,
  },
  utmContent: {
    type: String,
    default: '',
    trim: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

analyticsEventSchema.index({ eventType: 1, createdAt: -1 });
analyticsEventSchema.index({ sessionId: 1, createdAt: -1 });
analyticsEventSchema.index({ visitorId: 1, createdAt: -1 });
analyticsEventSchema.index({ path: 1, createdAt: -1 });

export default mongoose.model('AnalyticsEvent', analyticsEventSchema);
