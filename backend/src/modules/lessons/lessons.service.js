import Lesson from './lesson.model.js';
import Course from '../courses/course.model.js';
import { updateLessonCount } from '../courses/courses.service.js';
import { LessonProgress } from '../analytics/progress.model.js';

export const createLesson = async (lessonData, userId = null, userRole = null) => {
  const course = await Course.findById(lessonData.course);
  if (!course) {
    throw new Error('Course not found');
  }

  if (userRole === 'instructor' && course.instructor.toString() !== userId) {
    throw new Error('Not authorized to add lessons to this course');
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

export const updateLesson = async (lessonId, updates, userId = null, userRole = null) => {
  const lesson = await Lesson.findById(lessonId).populate('course', 'instructor');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (userRole === 'instructor' && lesson.course.instructor.toString() !== userId) {
    throw new Error('Not authorized to update this lesson');
  }

  Object.assign(lesson, updates);
  await lesson.save();
  return lesson;
};

export const uploadLessonFile = async (lessonId, file, userId = null, userRole = null) => {
  const lesson = await Lesson.findById(lessonId).populate('course', 'instructor');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (userRole === 'instructor' && lesson.course.instructor.toString() !== userId) {
    throw new Error('Not authorized to upload files to this lesson');
  }

  lesson.supportingFile = `/uploads/lessons/${file.filename}`;
  lesson.supportingFileName = file.originalname;
  await lesson.save();
  return lesson;
};

export const deleteLesson = async (lessonId, userId = null, userRole = null) => {
  const lesson = await Lesson.findById(lessonId).populate('course', 'instructor');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (userRole === 'instructor' && lesson.course.instructor.toString() !== userId) {
    throw new Error('Not authorized to delete this lesson');
  }

  const courseId = lesson.course._id || lesson.course;
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
  if (!course.enrolledStudents.some(id => id.toString() === userId.toString())) {
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
