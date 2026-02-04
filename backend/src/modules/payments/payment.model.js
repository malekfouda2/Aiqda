import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentReference: {
    type: String,
    required: true,
    trim: true
  },
  proofFile: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['submitted', 'approved', 'rejected'],
    default: 'submitted'
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
  rejectionReason: {
    type: String,
    default: null
  },
  bankName: {
    type: String,
    default: 'Bank Albilad'
  }
}, {
  timestamps: true
});

export default mongoose.model('Payment', paymentSchema);
