import mongoose from 'mongoose';

const teamMemberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  image: {
    type: String,
    default: null,
    trim: true,
  },
  achievements: {
    type: [String],
    default: [],
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

teamMemberSchema.index({ isActive: 1, order: 1, createdAt: 1 });

export default mongoose.model('TeamMember', teamMemberSchema);
