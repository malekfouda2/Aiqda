import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  order: {
    type: Number,
    required: true
  },
  vimeoVideoId: {
    type: String,
    default: null
  },
  minimumWatchPercentage: {
    type: Number,
    default: 80,
    min: 0,
    max: 100
  },
  supportingFile: {
    type: String,
    default: null
  },
  duration: {
    type: Number,
    default: 0
  },
  isPublished: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export default mongoose.model('Lesson', lessonSchema);
