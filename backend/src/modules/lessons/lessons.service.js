import Lesson from './lesson.model.js';
import Course from '../courses/course.model.js';
import { updateLessonCount } from '../courses/courses.service.js';
import { LessonProgress } from '../analytics/progress.model.js';

export const createLesson = async (lessonData) => {
  const course = await Course.findById(lessonData.course);
  if (!course) {
    throw new Error('Course not found');
  }

  const lastLesson = await Lesson.findOne({ course: lessonData.course }).sort({ order: -1 });
  const order = lastLesson ? lastLesson.order + 1 : 1;

  const lesson = new Lesson({
    ...lessonData,
    order
  });

  await lesson.save();
  await updateLessonCount(lessonData.course);
  
  return lesson.populate('course', 'title');
};

export const getLessonsByCourse = async (courseId) => {
  return Lesson.find({ course: courseId }).sort({ order: 1 });
};

export const getLessonById = async (lessonId, userId = null) => {
  const lesson = await Lesson.findById(lessonId).populate('course', 'title instructor');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (userId) {
    const progress = await LessonProgress.findOne({ user: userId, lesson: lessonId });
    return { lesson, progress };
  }

  return { lesson };
};

export const updateLesson = async (lessonId, updates) => {
  const lesson = await Lesson.findByIdAndUpdate(lessonId, updates, { new: true });
  if (!lesson) {
    throw new Error('Lesson not found');
  }
  return lesson;
};

export const deleteLesson = async (lessonId) => {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  const courseId = lesson.course;
  await Lesson.findByIdAndDelete(lessonId);
  await updateLessonCount(courseId);

  return { message: 'Lesson deleted successfully' };
};

export const reorderLessons = async (courseId, lessonOrders) => {
  for (const { lessonId, order } of lessonOrders) {
    await Lesson.findByIdAndUpdate(lessonId, { order });
  }
  return getLessonsByCourse(courseId);
};

export const updateWatchProgress = async (lessonId, userId, watchPercentage) => {
  const lesson = await Lesson.findById(lessonId).populate('course');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  let progress = await LessonProgress.findOne({ user: userId, lesson: lessonId });
  
  if (!progress) {
    progress = new LessonProgress({
      user: userId,
      lesson: lessonId,
      course: lesson.course._id
    });
  }

  progress.watchPercentage = Math.max(progress.watchPercentage, watchPercentage);
  progress.lastWatchedAt = new Date();

  if (progress.watchPercentage >= lesson.minimumWatchPercentage && progress.quizPassed) {
    progress.isQualified = true;
    if (!progress.completedAt) {
      progress.completedAt = new Date();
    }
  }

  await progress.save();
  return progress;
};

export const getSecureVideoToken = async (lessonId, userId) => {
  const lesson = await Lesson.findById(lessonId).populate('course');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  const course = await Course.findById(lesson.course._id);
  if (!course.enrolledStudents.includes(userId)) {
    throw new Error('Not enrolled in this course');
  }

  if (!lesson.vimeoVideoId) {
    throw new Error('No video available for this lesson');
  }

  return {
    videoId: lesson.vimeoVideoId,
    lessonId: lesson._id,
    minimumWatchPercentage: lesson.minimumWatchPercentage
  };
};
