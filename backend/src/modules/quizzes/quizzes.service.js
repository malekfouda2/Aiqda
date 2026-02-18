import Quiz from './quiz.model.js';
import Lesson from '../lessons/lesson.model.js';
import { LessonProgress, CourseProgress } from '../analytics/progress.model.js';

export const createQuiz = async (quizData, userId = null, userRole = null) => {
  const lesson = await Lesson.findById(quizData.lesson).populate('course', 'instructor');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (userRole === 'instructor' && lesson.course.instructor.toString() !== userId) {
    throw new Error('Not authorized to create quiz for this lesson');
  }

  const existingQuiz = await Quiz.findOne({ lesson: quizData.lesson });
  if (existingQuiz) {
    throw new Error('Quiz already exists for this lesson');
  }

  if (quizData.questions.length < 1 || quizData.questions.length > 8) {
    throw new Error('Quiz must have between 1 and 8 questions');
  }

  for (const q of quizData.questions) {
    if (!q.options || q.options.length !== 3) {
      throw new Error('Each question must have exactly 3 options');
    }
    if (q.correctAnswer < 0 || q.correctAnswer > 2) {
      throw new Error('Correct answer must be 0, 1, or 2');
    }
  }

  if (!quizData.passingScore) {
    quizData.passingScore = Math.ceil(quizData.questions.length * 0.6);
  }

  const quiz = new Quiz(quizData);
  await quiz.save();
  return quiz;
};

export const getQuizByLesson = async (lessonId) => {
  const quiz = await Quiz.findOne({ lesson: lessonId });
  if (!quiz) {
    throw new Error('Quiz not found');
  }
  return quiz;
};

export const getQuizForStudent = async (lessonId) => {
  const quiz = await Quiz.findOne({ lesson: lessonId });
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  const sanitizedQuiz = {
    _id: quiz._id,
    lesson: quiz.lesson,
    questions: quiz.questions.map(q => ({
      _id: q._id,
      question: q.question,
      options: q.options
    })),
    passingScore: quiz.passingScore
  };

  return sanitizedQuiz;
};

export const updateQuiz = async (quizId, updates, userId = null, userRole = null) => {
  const quiz = await Quiz.findById(quizId).populate({ path: 'lesson', populate: { path: 'course', select: 'instructor' } });
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  if (userRole === 'instructor' && quiz.lesson.course.instructor.toString() !== userId) {
    throw new Error('Not authorized to update this quiz');
  }

  if (updates.questions) {
    if (updates.questions.length < 1 || updates.questions.length > 8) {
      throw new Error('Quiz must have between 1 and 8 questions');
    }
    for (const q of updates.questions) {
      if (!q.options || q.options.length !== 3) {
        throw new Error('Each question must have exactly 3 options');
      }
      if (q.correctAnswer < 0 || q.correctAnswer > 2) {
        throw new Error('Correct answer must be 0, 1, or 2');
      }
    }
  }

  const updated = await Quiz.findByIdAndUpdate(quizId, updates, { new: true });
  return updated;
};

export const deleteQuiz = async (quizId, userId = null, userRole = null) => {
  const quiz = await Quiz.findById(quizId).populate({
    path: 'lesson',
    populate: { path: 'course', select: 'instructor' }
  });
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  if (userRole === 'instructor' && quiz.lesson.course.instructor.toString() !== userId) {
    throw new Error('Not authorized to delete this quiz');
  }

  await Quiz.findByIdAndDelete(quizId);
  return { message: 'Quiz deleted successfully' };
};

export const submitQuiz = async (lessonId, userId, answers) => {
  const quiz = await Quiz.findOne({ lesson: lessonId });
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  let progress = await LessonProgress.findOne({ user: userId, lesson: lessonId });
  if (!progress) {
    progress = new LessonProgress({
      user: userId,
      lesson: lessonId,
      course: lesson.course
    });
  }

  let score = 0;
  const results = quiz.questions.map((q, index) => {
    const isCorrect = q.correctAnswer === answers[index];
    if (isCorrect) score++;
    return {
      question: q.question,
      selectedAnswer: answers[index],
      correctAnswer: q.correctAnswer,
      isCorrect
    };
  });

  const passed = score >= quiz.passingScore;
  
  progress.quizScore = Math.max(progress.quizScore, score);
  progress.quizAttempts += 1;
  
  if (passed) {
    progress.quizPassed = true;
    
    if (progress.watchPercentage >= lesson.minimumWatchPercentage) {
      progress.isQualified = true;
      if (!progress.completedAt) {
        progress.completedAt = new Date();
      }

      const courseProgress = await CourseProgress.findOne({ user: userId, course: lesson.course });
      if (courseProgress) {
        const qualifiedLessons = await LessonProgress.countDocuments({
          user: userId,
          course: lesson.course,
          isQualified: true
        });
        
        courseProgress.completedLessons = qualifiedLessons;
        courseProgress.progressPercentage = (qualifiedLessons / courseProgress.totalLessons) * 100;
        
        if (qualifiedLessons >= courseProgress.totalLessons) {
          courseProgress.isCompleted = true;
          courseProgress.completedAt = new Date();
        }
        
        await courseProgress.save();
      }
    }
  }

  await progress.save();

  return {
    score,
    totalQuestions: quiz.questions.length,
    passed,
    passingScore: quiz.passingScore,
    results,
    progress
  };
};
