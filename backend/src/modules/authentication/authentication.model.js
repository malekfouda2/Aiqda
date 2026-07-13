import mongoose from 'mongoose';

// Homepage "Authentication" section item (e.g. accreditation/certification badge).
// Mirrors the Partner shape; managed from the admin dashboard.
const authenticationSchema = new mongoose.Schema({
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

authenticationSchema.index({ isActive: 1, order: 1, createdAt: 1 });

export default mongoose.model('Authentication', authenticationSchema);
