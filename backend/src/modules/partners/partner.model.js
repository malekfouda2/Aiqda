import mongoose from 'mongoose';

const partnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  image: {
    type: String,
    default: null,
    trim: true,
  },
  website: {
    type: String,
    default: '',
    trim: true,
  },
  order: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

partnerSchema.index({ isActive: 1, order: 1, createdAt: 1 });

export default mongoose.model('Partner', partnerSchema);
