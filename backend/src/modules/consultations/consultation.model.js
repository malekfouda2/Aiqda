import mongoose from 'mongoose';

const consultationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  priceType: {
    type: String,
    enum: ['fixed', 'contract'],
    default: 'fixed'
  },
  price: {
    type: Number,
    default: null
  },
  currency: {
    type: String,
    default: 'SAR'
  },
  duration: {
    type: String,
    required: true
  },
  mode: {
    type: String,
    required: true
  },
  focusPoints: {
    type: [String]
  },
  zoomSchedulerLink: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('Consultation', consultationSchema);
