import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: {
    type: [String],
    validate: {
      validator: function(v) {
        return v.length === 3;
      },
      message: 'Each question must have exactly 3 options'
    }
  },
  correctAnswer: {
    type: Number,
    required: true,
    min: 0,
    max: 2
  }
});

const quizSchema = new mongoose.Schema({
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true,
    unique: true
  },
  questions: {
    type: [questionSchema],
    validate: {
      validator: function(v) {
        return v.length >= 1 && v.length <= 8;
      },
      message: 'Quiz must have between 1 and 8 questions'
    }
  },
  passingScore: {
    type: Number,
    default: 1,
    min: 1
  }
}, {
  timestamps: true
});

export default mongoose.model('Quiz', quizSchema);
