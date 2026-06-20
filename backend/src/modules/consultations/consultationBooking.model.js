import mongoose from 'mongoose';

const consultationBookingSchema = new mongoose.Schema({
  consultation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Consultation',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  priceType: {
    type: String,
    enum: ['fixed', 'contract'],
    required: true
  },
  amount: {
    type: Number,
    default: null
  },
  currency: {
    type: String,
    default: 'SAR'
  },
  paymentReference: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['payment_pending', 'payment_failed', 'pending', 'confirmed', 'rejected', 'cancelled'],
    default: 'pending'
  },
  paymentFailureReason: {
    type: String,
    default: null
  },
  paidAt: {
    type: Date,
    default: null
  },
  zoomLink: {
    type: String
  },
  adminNotes: {
    type: String
  },
  rejectionReason: {
    type: String
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

export default mongoose.model('ConsultationBooking', consultationBookingSchema);
