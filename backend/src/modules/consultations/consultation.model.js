import mongoose from 'mongoose';

const consultationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  titleAr: {
    type: String,
    default: ''
  },
  description: {
    type: String
  },
  descriptionAr: {
    type: String,
    default: ''
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
  durationAr: {
    type: String,
    default: ''
  },
  mode: {
    type: String,
    required: true
  },
  modeAr: {
    type: String,
    default: ''
  },
  focusPoints: {
    type: [String],
    default: []
  },
  focusPointsAr: {
    type: [String],
    default: []
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
