import mongoose from 'mongoose';

// Immutable snapshot of one chapter (course) entitlement for one payment.
// Captures allocation + completion basis at payment time so later edits never rewrite history.
const chapterEntitlementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  financeTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinanceTransaction',
    required: true,
  },
  subscriptionPackage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPackage',
    default: null,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  courseTitleSnapshot: { type: String, default: '' },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  allocationBpsSnapshot: { type: Number, default: 0 },
  requiredLessonCountSnapshot: { type: Number, default: 0 },
  completionThresholdBpsSnapshot: { type: Number, default: 8000 },
  entitlementStart: { type: Date, default: null },
  entitlementEnd: { type: Date, default: null },
}, { timestamps: true });

chapterEntitlementSchema.index({ financeTransaction: 1, course: 1 }, { unique: true });
chapterEntitlementSchema.index({ user: 1, course: 1 });

export default mongoose.model('ChapterEntitlement', chapterEntitlementSchema);
