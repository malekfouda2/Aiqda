import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  thumbnail: {
    type: String,
    default: null
  },
  category: {
    type: String,
    default: 'General'
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  // Software/tools the creator uses in this chapter (e.g. Blender, Maya, Photoshop).
  // Surfaced on every endpoint that returns the course.
  software: {
    type: [String],
    default: []
  },
  // Sequence position of this chapter within its instructor's chapters (1-based).
  order: {
    type: Number,
    default: 0
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  reviewStatus: {
    type: String,
    enum: ['draft', 'pending_review', 'published'],
    default: 'draft'
  },
  enrolledStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lessonsCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('Course', courseSchema);
