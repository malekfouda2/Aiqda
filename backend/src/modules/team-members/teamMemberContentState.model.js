import mongoose from 'mongoose';

const teamMemberContentStateSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  isInitialized: {
    type: Boolean,
    default: false,
  },
  seededDefaults: {
    type: Boolean,
    default: false,
  },
  initializedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

export default mongoose.model('TeamMemberContentState', teamMemberContentStateSchema);
