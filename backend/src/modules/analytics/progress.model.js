import mongoose from 'mongoose';

const lessonProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  watchPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  quizPassed: {
    type: Boolean,
    default: false
  },
  quizScore: {
    type: Number,
    default: 0
  },
  quizAttempts: {
    type: Number,
    default: 0
  },
  isQualified: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  lastWatchedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

lessonProgressSchema.index({ user: 1, lesson: 1 }, { unique: true });

const courseProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  completedLessons: {
    type: Number,
    default: 0
  },
  totalLessons: {
    type: Number,
    default: 0
  },
  progressPercentage: {
    type: Number,
    default: 0
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

courseProgressSchema.index({ user: 1, course: 1 }, { unique: true });

export const LessonProgress = mongoose.model('LessonProgress', lessonProgressSchema);
export const CourseProgress = mongoose.model('CourseProgress', courseProgressSchema);
