import Lesson from './lesson.model.js';
import Course from '../courses/course.model.js';
import { updateLessonCount } from '../courses/courses.service.js';
import { LessonProgress } from '../analytics/progress.model.js';
import { getSubscriptionAccessContext } from '../subscriptions/subscriptions.service.js';
import { ensureUploadPathExists } from '../../utils/uploadPaths.js';
import { notify } from '../notifications/notify.js';
import { onCourseProgressChanged } from '../finance/financeHooks.js';

// isPublished/reviewStatus are excluded: publish state is only changed through the
// dedicated submit-for-review (creator) and publish (admin) flows.
const LESSON_CREATABLE_FIELDS = [
  'course',
  'title',
  'description',
  'vimeoVideoId',
  'minimumWatchPercentage',
  'duration'
];

const LESSON_UPDATABLE_FIELDS = LESSON_CREATABLE_FIELDS.filter((field) => field !== 'course');

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

const canAccessCourseLessons = (course, userId = null, userRole = null) => {
  if (course.isPublished) {
    return true;
  }

  return canManageCourseContent(course, userId, userRole);
};

const canAccessLesson = (lesson, userId = null, userRole = null) => {
  if (canManageCourseContent(lesson.course, userId, userRole)) {
    return true;
  }

  return lesson.course.isPublished && lesson.isPublished && lesson.course.enrolledStudents.some(
    (studentId) => studentId.toString() === userId?.toString()
  );
};

const sanitizeLessonUpdates = (updates = {}) => {
  return Object.fromEntries(
    Object.entries(updates).filter(([key]) => LESSON_UPDATABLE_FIELDS.includes(key))
  );
};

const sanitizeLessonCreate = (updates = {}) => {
  return Object.fromEntries(
    Object.entries(updates).filter(([key]) => LESSON_CREATABLE_FIELDS.includes(key))
  );
};

const ensureStudentSubscriptionAccess = async (course, userId) => {
  const courseId = course?._id?.toString?.() || course?.toString?.();
  const subscriptionAccess = await getSubscriptionAccessContext(userId, courseId);

  if (!subscriptionAccess.hasActiveSubscription) {
    throw new Error('You need an active subscription to access this chapter');
  }

  if (!subscriptionAccess.hasCourseAccess) {
    throw new Error('Your current subscription does not include access to this chapter');
  }
};

export const createLesson = async (lessonData, userId = null, userRole = null) => {
  const sanitizedLessonData = sanitizeLessonCreate(lessonData);
  const courseId = sanitizedLessonData.course;
  const course = await Course.findById(courseId);
  if (!course) {
    throw new Error('Course not found');
  }

  if (userRole === 'instructor' && course.instructor.toString() !== userId) {
    throw new Error('Not authorized to add lessons to this course');
  }

  const lastLesson = await Lesson.findOne({ course: courseId }).sort({ order: -1 });
  const order = lastLesson ? lastLesson.order + 1 : 1;

  const lesson = new Lesson({
    ...sanitizedLessonData,
    order
  });

  await lesson.save();
  await updateLessonCount(courseId);
  
  return lesson.populate('course', 'title');
};

export const getLessonsByCourse = async (courseId, userId = null, userRole = null) => {
  const course = await Course.findById(courseId).select('isPublished instructor');
  if (!course) {
    throw new Error('Course not found');
  }

  if (!canAccessCourseLessons(course, userId, userRole)) {
    throw new Error('Course not found');
  }

  const lessonQuery = { course: courseId };
  if (!canManageCourseContent(course, userId, userRole)) {
    lessonQuery.isPublished = true;
  }

  return Lesson.find(lessonQuery).sort({ order: 1 });
};

export const getLessonById = async (lessonId, userId = null, userRole = null) => {
  const lesson = await Lesson.findById(lessonId).populate('course', '_id title instructor enrolledStudents isPublished');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (!canAccessLesson(lesson, userId, userRole)) {
    throw new Error('Access denied. Insufficient permissions.');
  }

  if (!canManageCourseContent(lesson.course, userId, userRole)) {
    await ensureStudentSubscriptionAccess(lesson.course, userId);
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

  if (!canManageCourseContent(lesson.course, userId, userRole)) {
    throw new Error('Not authorized to update this lesson');
  }

  const sanitizedUpdates = sanitizeLessonUpdates(updates);
  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new Error('No valid lesson fields to update');
  }

  Object.assign(lesson, sanitizedUpdates);

  // Creator edits to live or in-review content send it back to draft for re-review.
  if (userRole !== 'admin' && lesson.reviewStatus !== 'draft') {
    lesson.reviewStatus = 'draft';
    lesson.isPublished = false;
  }

  await lesson.save();
  return lesson;
};

export const submitLessonForReview = async (lessonId, userId = null, userRole = null) => {
  const lesson = await Lesson.findById(lessonId).populate('course', 'instructor');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (!canManageCourseContent(lesson.course, userId, userRole)) {
    throw new Error('Not authorized to submit this lesson for review');
  }

  if (lesson.reviewStatus === 'pending_review') {
    throw new Error('This content is already awaiting review');
  }
  if (lesson.reviewStatus === 'published') {
    throw new Error('This content is already published');
  }

  lesson.reviewStatus = 'pending_review';
  await lesson.save();

  await notify.admins({
    type: 'review.content_submitted',
    title: 'Content submitted for review',
    titleAr: 'تم إرسال محتوى للمراجعة',
    message: `"${lesson.title}" was submitted and is awaiting your review.`,
    messageAr: `تم إرسال "${lesson.title}" وهو بانتظار مراجعتك.`,
    link: '/admin/chapters',
    metadata: { lessonId: lesson._id, courseId: lesson.course?._id || lesson.course },
  });

  return lesson;
};

// Admin-only publish control for a single lesson.
export const setLessonPublishState = async (lessonId, isPublished) => {
  const lesson = await Lesson.findById(lessonId).populate('course', 'instructor');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  lesson.isPublished = Boolean(isPublished);
  lesson.reviewStatus = isPublished ? 'published' : 'draft';
  await lesson.save();

  const instructorId = lesson.course?.instructor;
  if (instructorId) {
    await notify.user(instructorId, {
      type: isPublished ? 'review.content_published' : 'review.content_returned',
      title: isPublished ? 'Your content was published' : 'Your content was returned to draft',
      titleAr: isPublished ? 'تم نشر محتواك' : 'تمت إعادة محتواك إلى المسودة',
      message: isPublished
        ? `"${lesson.title}" is now live for members.`
        : `"${lesson.title}" was returned to draft. Update it and resubmit for review.`,
      messageAr: isPublished
        ? `"${lesson.title}" أصبح منشورًا للأعضاء.`
        : `تمت إعادة "${lesson.title}" إلى المسودة. عدّله وأعد إرساله للمراجعة.`,
      link: '/creator/chapters',
      metadata: { lessonId: lesson._id },
    });
  }

  return lesson;
};

export const uploadLessonFile = async (lessonId, file, userId = null, userRole = null) => {
  const lesson = await Lesson.findById(lessonId).populate('course', 'instructor');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (!canManageCourseContent(lesson.course, userId, userRole)) {
    throw new Error('Not authorized to upload files to this lesson');
  }

  lesson.supportingFile = `lessons/${file.filename}`;
  lesson.supportingFileName = file.originalname;
  await lesson.save();
  return lesson;
};

export const deleteLesson = async (lessonId, userId = null, userRole = null) => {
  const lesson = await Lesson.findById(lessonId).populate('course', 'instructor');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (!canManageCourseContent(lesson.course, userId, userRole)) {
    throw new Error('Not authorized to delete this lesson');
  }

  if (lesson.isPublished || lesson.reviewStatus !== 'draft') {
    throw new Error('Only draft content can be deleted. Return it to draft first.');
  }

  const courseId = lesson.course._id || lesson.course;
  await Lesson.findByIdAndDelete(lessonId);
  await updateLessonCount(courseId);

  return { message: 'Lesson deleted successfully' };
};

export const reorderLessons = async (courseId, lessonOrders, userId = null, userRole = null) => {
  const course = await Course.findById(courseId).select('instructor isPublished');
  if (!course) {
    throw new Error('Course not found');
  }

  if (userRole !== 'admin' && course.instructor.toString() !== userId?.toString()) {
    throw new Error('Not authorized to reorder lessons for this course');
  }

  if (!Array.isArray(lessonOrders) || lessonOrders.length === 0) {
    throw new Error('Lesson order updates are required');
  }

  const lessonIds = lessonOrders.map(({ lessonId }) => lessonId);
  const existingLessons = await Lesson.find({
    _id: { $in: lessonIds },
    course: courseId
  }).select('_id');

  if (existingLessons.length !== lessonIds.length) {
    throw new Error('One or more lessons do not belong to this course');
  }

  const seenOrders = new Set();
  for (const { lessonId, order } of lessonOrders) {
    const normalizedOrder = Number(order);
    if (!lessonId) {
      throw new Error('Each lesson order update must include a lessonId');
    }
    if (!Number.isInteger(normalizedOrder) || normalizedOrder < 1) {
      throw new Error('Lesson order must be a positive integer');
    }
    if (seenOrders.has(normalizedOrder)) {
      throw new Error('Lesson order values must be unique');
    }
    seenOrders.add(normalizedOrder);
  }

  await Promise.all(
    lessonOrders.map(({ lessonId, order }) => (
      Lesson.findByIdAndUpdate(lessonId, { order: Number(order) })
    ))
  );

  return getLessonsByCourse(courseId, userId, userRole);
};

export const updateWatchProgress = async (lessonId, userId, watchPercentage, userRole = null) => {
  const lesson = await Lesson.findById(lessonId).populate('course');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (!canAccessLesson(lesson, userId, userRole)) {
    throw new Error('Access denied. Insufficient permissions.');
  }

  if (!canManageCourseContent(lesson.course, userId, userRole)) {
    await ensureStudentSubscriptionAccess(lesson.course, userId);
  }

  const normalizedWatchPercentage = Number(watchPercentage);
  if (!Number.isFinite(normalizedWatchPercentage) || normalizedWatchPercentage < 0 || normalizedWatchPercentage > 100) {
    throw new Error('Watch percentage must be a number between 0 and 100');
  }

  let progress = await LessonProgress.findOne({ user: userId, lesson: lessonId });
  
  if (!progress) {
    progress = new LessonProgress({
      user: userId,
      lesson: lessonId,
      course: lesson.course._id
    });
  }

  progress.watchPercentage = Math.max(progress.watchPercentage, normalizedWatchPercentage);
  progress.lastWatchedAt = new Date();

  if (progress.watchPercentage >= lesson.minimumWatchPercentage && progress.quizPassed) {
    progress.isQualified = true;
    if (!progress.completedAt) {
      progress.completedAt = new Date();
    }
  }

  await progress.save();

  if (progress.isQualified) {
    await onCourseProgressChanged(userId, lesson.course._id);
  }

  return progress;
};

export const getSecureVideoToken = async (lessonId, userId, userRole = null) => {
  const lesson = await Lesson.findById(lessonId).populate('course');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (!canAccessLesson(lesson, userId, userRole)) {
    throw new Error('Access denied. Insufficient permissions.');
  }

  if (!canManageCourseContent(lesson.course, userId, userRole)) {
    await ensureStudentSubscriptionAccess(lesson.course, userId);
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

export const getLessonFileDownload = async (lessonId, userId, userRole = null) => {
  const lesson = await Lesson.findById(lessonId).populate('course');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (!canAccessLesson(lesson, userId, userRole)) {
    throw new Error('Access denied. Insufficient permissions.');
  }

  if (!canManageCourseContent(lesson.course, userId, userRole)) {
    await ensureStudentSubscriptionAccess(lesson.course, userId);
  }

  if (!lesson.supportingFile) {
    throw new Error('No supporting file available for this lesson');
  }

  return {
    absolutePath: await ensureUploadPathExists(lesson.supportingFile),
    downloadName: lesson.supportingFileName || 'lesson-supporting-file',
  };
};
