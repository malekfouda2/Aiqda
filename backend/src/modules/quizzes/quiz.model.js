import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: [{
    type: String,
    required: true
  }],
  correctAnswer: {
    type: Number,
    required: true,
    min: 0
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
        return v.length === 3;
      },
      message: 'Quiz must have exactly 3 questions'
    }
  },
  passingScore: {
    type: Number,
    default: 2,
    min: 1,
    max: 3
  }
}, {
  timestamps: true
});

export default mongoose.model('Quiz', quizSchema);
