import Quiz from './quiz.model.js';
import Lesson from '../lessons/lesson.model.js';
import { LessonProgress, CourseProgress } from '../analytics/progress.model.js';

export const createQuiz = async (quizData) => {
  const lesson = await Lesson.findById(quizData.lesson);
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  const existingQuiz = await Quiz.findOne({ lesson: quizData.lesson });
  if (existingQuiz) {
    throw new Error('Quiz already exists for this lesson');
  }

  if (quizData.questions.length !== 3) {
    throw new Error('Quiz must have exactly 3 questions');
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

export const updateQuiz = async (quizId, updates) => {
  if (updates.questions && updates.questions.length !== 3) {
    throw new Error('Quiz must have exactly 3 questions');
  }

  const quiz = await Quiz.findByIdAndUpdate(quizId, updates, { new: true });
  if (!quiz) {
    throw new Error('Quiz not found');
  }
  return quiz;
};

export const deleteQuiz = async (quizId) => {
  const quiz = await Quiz.findByIdAndDelete(quizId);
  if (!quiz) {
    throw new Error('Quiz not found');
  }
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
    totalQuestions: 3,
    passed,
    passingScore: quiz.passingScore,
    results,
    progress
  };
};
