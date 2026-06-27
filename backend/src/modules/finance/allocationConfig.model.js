import mongoose from 'mongoose';

const auditEntrySchema = new mongoose.Schema({
  action: { type: String, required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  at: { type: Date, default: Date.now },
  note: { type: String, default: '' },
}, { _id: false });

// Versioned per-chapter (course) revenue allocation weight within a subscription package.
// percentageBps is a share of the instructor pool for that package's entitlement.
const allocationConfigSchema = new mongoose.Schema({
  subscriptionPackage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPackage',
    required: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  percentageBps: { type: Number, required: true, min: 0, max: 10000 },
  effectiveStart: { type: Date, default: Date.now },
  effectiveEnd: { type: Date, default: null },
  status: {
    type: String,
    enum: ['draft', 'active', 'superseded', 'archived'],
    default: 'active',
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  audit: { type: [auditEntrySchema], default: [] },
}, { timestamps: true });

allocationConfigSchema.index({ subscriptionPackage: 1, course: 1, status: 1, effectiveStart: -1 });

export default mongoose.model('AllocationConfig', allocationConfigSchema);
