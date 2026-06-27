import mongoose from 'mongoose';

// Append-only audit trail for every financial action. Never deleted.
const financeAuditSchema = new mongoose.Schema({
  actorType: {
    type: String,
    enum: ['admin', 'system', 'webhook'],
    required: true,
  },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  oldState: { type: mongoose.Schema.Types.Mixed, default: null },
  newState: { type: mongoose.Schema.Types.Mixed, default: null },
  reason: { type: String, default: '' },
  relatedRef: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } });

financeAuditSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export default mongoose.model('FinanceAudit', financeAuditSchema);
