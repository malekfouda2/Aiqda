import Quiz from './quiz.model.js';
import Lesson from '../lessons/lesson.model.js';
import { LessonProgress, CourseProgress } from '../analytics/progress.model.js';

const QUIZ_UPDATABLE_FIELDS = ['questions', 'passingScore'];

const canManageCourseContent = (course, userId = null, userRole = null) => {
  if (userRole === 'admin') {
    return true;
  }

  if (userRole === 'instructor') {
    const instructorId = course.instructor?._id?.toString?.() || course.instructor?.toString?.();
    return instructorId === userId?.toString();
  }

  return false;
};

const canAccessLessonQuiz = (lesson, userId = null, userRole = null) => {
  if (canManageCourseContent(lesson.course, userId, userRole)) {
    return true;
  }

  return lesson.course.isPublished && lesson.isPublished && lesson.course.enrolledStudents.some(
    (studentId) => studentId.toString() === userId?.toString()
  );
};

const sanitizeQuizUpdates = (updates = {}) => {
  return Object.fromEntries(
    Object.entries(updates).filter(([key]) => QUIZ_UPDATABLE_FIELDS.includes(key))
  );
};

export const createQuiz = async (quizData, userId = null, userRole = null) => {
  const sanitizedQuizData = {
    lesson: quizData.lesson,
    ...sanitizeQuizUpdates(quizData)
  };

  const lesson = await Lesson.findById(sanitizedQuizData.lesson).populate('course', 'instructor');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (!canManageCourseContent(lesson.course, userId, userRole)) {
    throw new Error('Not authorized to create quiz for this lesson');
  }

  const existingQuiz = await Quiz.findOne({ lesson: sanitizedQuizData.lesson });
  if (existingQuiz) {
    throw new Error('Quiz already exists for this lesson');
  }

  if (!Array.isArray(sanitizedQuizData.questions) || sanitizedQuizData.questions.length < 1 || sanitizedQuizData.questions.length > 8) {
    throw new Error('Quiz must have between 1 and 8 questions');
  }

  for (const question of sanitizedQuizData.questions) {
    if (!question.options || question.options.length !== 3) {
      throw new Error('Each question must have exactly 3 options');
    }
    if (question.correctAnswer < 0 || question.correctAnswer > 2) {
      throw new Error('Correct answer must be 0, 1, or 2');
    }
  }

  if (!sanitizedQuizData.passingScore) {
    sanitizedQuizData.passingScore = Math.ceil(sanitizedQuizData.questions.length * 0.6);
  }

  const quiz = new Quiz(sanitizedQuizData);
  await quiz.save();
  return quiz;
};

export const getQuizByLesson = async (lessonId, userId = null, userRole = null) => {
  const quiz = await Quiz.findOne({ lesson: lessonId });
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  const lesson = await Lesson.findById(lessonId).populate('course', 'instructor');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (!canManageCourseContent(lesson.course, userId, userRole)) {
    throw new Error('Access denied. Insufficient permissions.');
  }

  return quiz;
};

export const getQuizForStudent = async (lessonId, userId = null, userRole = null) => {
  const quiz = await Quiz.findOne({ lesson: lessonId });
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  const lesson = await Lesson.findById(lessonId).populate('course', 'instructor enrolledStudents isPublished');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (!canAccessLessonQuiz(lesson, userId, userRole)) {
    throw new Error('Access denied. Insufficient permissions.');
  }

  return {
    _id: quiz._id,
    lesson: quiz.lesson,
    questions: quiz.questions.map((question) => ({
      _id: question._id,
      question: question.question,
      options: question.options
    })),
    passingScore: quiz.passingScore
  };
};

export const updateQuiz = async (quizId, updates, userId = null, userRole = null) => {
  const quiz = await Quiz.findById(quizId).populate({
    path: 'lesson',
    populate: { path: 'course', select: 'instructor' }
  });
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  if (!canManageCourseContent(quiz.lesson.course, userId, userRole)) {
    throw new Error('Not authorized to update this quiz');
  }

  const sanitizedUpdates = sanitizeQuizUpdates(updates);
  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new Error('No valid quiz fields to update');
  }

  if (sanitizedUpdates.questions) {
    if (sanitizedUpdates.questions.length < 1 || sanitizedUpdates.questions.length > 8) {
      throw new Error('Quiz must have between 1 and 8 questions');
    }

    for (const question of sanitizedUpdates.questions) {
      if (!question.options || question.options.length !== 3) {
        throw new Error('Each question must have exactly 3 options');
      }
      if (question.correctAnswer < 0 || question.correctAnswer > 2) {
        throw new Error('Correct answer must be 0, 1, or 2');
      }
    }
  }

  return Quiz.findByIdAndUpdate(quizId, sanitizedUpdates, { new: true });
};

export const deleteQuiz = async (quizId, userId = null, userRole = null) => {
  const quiz = await Quiz.findById(quizId).populate({
    path: 'lesson',
    populate: { path: 'course', select: 'instructor' }
  });
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  if (!canManageCourseContent(quiz.lesson.course, userId, userRole)) {
    throw new Error('Not authorized to delete this quiz');
  }

  await Quiz.findByIdAndDelete(quizId);
  return { message: 'Quiz deleted successfully' };
};

export const submitQuiz = async (lessonId, userId, answers, userRole = null) => {
  const quiz = await Quiz.findOne({ lesson: lessonId });
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  const lesson = await Lesson.findById(lessonId).populate('course', 'instructor enrolledStudents isPublished');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (!canAccessLessonQuiz(lesson, userId, userRole)) {
    throw new Error('Access denied. Insufficient permissions.');
  }

  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
    throw new Error('Please answer all quiz questions');
  }

  let progress = await LessonProgress.findOne({ user: userId, lesson: lessonId });
  if (!progress) {
    progress = new LessonProgress({
      user: userId,
      lesson: lessonId,
      course: lesson.course._id
    });
  }

  let score = 0;
  const results = quiz.questions.map((question, index) => {
    const isCorrect = question.correctAnswer === answers[index];
    if (isCorrect) score++;
    return {
      question: question.question,
      selectedAnswer: answers[index],
      correctAnswer: question.correctAnswer,
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

      const courseId = lesson.course._id;
      const courseProgress = await CourseProgress.findOne({ user: userId, course: courseId });
      if (courseProgress) {
        const qualifiedLessons = await LessonProgress.countDocuments({
          user: userId,
          course: courseId,
          isQualified: true
        });

        courseProgress.completedLessons = qualifiedLessons;
        courseProgress.progressPercentage = courseProgress.totalLessons > 0
          ? (qualifiedLessons / courseProgress.totalLessons) * 100
          : 0;

        if (courseProgress.totalLessons > 0 && qualifiedLessons >= courseProgress.totalLessons) {
          courseProgress.isCompleted = true;
          courseProgress.completedAt = new Date();
        } else {
          courseProgress.isCompleted = false;
          courseProgress.completedAt = null;
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
