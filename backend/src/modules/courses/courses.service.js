import Course from './course.model.js';
import Lesson from '../lessons/lesson.model.js';
import { CourseProgress } from '../analytics/progress.model.js';
import { checkSubscriptionAccess } from '../subscriptions/subscriptions.service.js';

const COURSE_UPDATABLE_FIELDS = [
  'title',
  'description',
  'thumbnail',
  'category',
  'level',
  'isPublished'
];

const canAccessCourse = (course, userId = null, userRole = null) => {
  if (course.isPublished) {
    return true;
  }

  if (userRole === 'admin') {
    return true;
  }

  if (userRole === 'instructor') {
    const instructorId = course.instructor?._id?.toString?.() || course.instructor?.toString?.();
    return instructorId === userId?.toString();
  }

  return false;
};

const sanitizeCourseUpdates = (updates = {}) => {
  return Object.fromEntries(
    Object.entries(updates).filter(([key]) => COURSE_UPDATABLE_FIELDS.includes(key))
  );
};

export const createCourse = async (courseData, instructorId) => {
  const sanitizedCourseData = sanitizeCourseUpdates(courseData);
  const course = new Course({
    ...sanitizedCourseData,
    instructor: instructorId
  });
  await course.save();
  return course.populate('instructor', 'name email');
};

export const getAllCourses = async (filters = {}) => {
  const query = {};
  if (filters.instructor) query.instructor = filters.instructor;
  if (filters.isPublished !== undefined) query.isPublished = filters.isPublished;
  if (filters.category) query.category = filters.category;
  
  return Course.find(query)
    .populate('instructor', 'name email')
    .sort({ createdAt: -1 });
};

export const getPublishedCourses = async () => {
  return Course.find({ isPublished: true })
    .populate('instructor', 'name email')
    .sort({ createdAt: -1 });
};

export const getCourseById = async (courseId, userId = null, userRole = null) => {
  const course = await Course.findById(courseId)
    .populate('instructor', 'name email');
  if (!course) {
    throw new Error('Course not found');
  }
  if (!canAccessCourse(course, userId, userRole)) {
    throw new Error('Course not found');
  }
  return course;
};

export const updateCourse = async (courseId, updates, userId, userRole) => {
  const course = await Course.findById(courseId);
  if (!course) {
    throw new Error('Course not found');
  }

  if (userRole !== 'admin' && course.instructor.toString() !== userId) {
    throw new Error('Not authorized to update this course');
  }

  const sanitizedUpdates = sanitizeCourseUpdates(updates);
  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new Error('No valid course fields to update');
  }

  Object.assign(course, sanitizedUpdates);
  await course.save();
  return course.populate('instructor', 'name email');
};

export const deleteCourse = async (courseId, userId, userRole) => {
  const course = await Course.findById(courseId);
  if (!course) {
    throw new Error('Course not found');
  }

  if (userRole !== 'admin' && course.instructor.toString() !== userId) {
    throw new Error('Not authorized to delete this course');
  }

  await Lesson.deleteMany({ course: courseId });
  await Course.findByIdAndDelete(courseId);
  return { message: 'Course deleted successfully' };
};

export const enrollStudent = async (courseId, studentId, userRole = null) => {
  const course = await Course.findById(courseId);
  if (!course) {
    throw new Error('Course not found');
  }

  if (!course.isPublished) {
    throw new Error('Course is not available for enrollment');
  }

  if (course.enrolledStudents.some(id => id.toString() === studentId.toString())) {
    throw new Error('Already enrolled in this course');
  }

  if (!['admin', 'instructor'].includes(userRole)) {
    const hasActiveSubscription = await checkSubscriptionAccess(studentId);
    if (!hasActiveSubscription) {
      throw new Error('You need an active subscription to enroll in this course');
    }
  }

  course.enrolledStudents.push(studentId);
  await course.save();

  const lessonsCount = await Lesson.countDocuments({ course: courseId });
  
  await CourseProgress.findOneAndUpdate(
    { user: studentId, course: courseId },
    { 
      user: studentId, 
      course: courseId, 
      totalLessons: lessonsCount,
      startedAt: new Date()
    },
    { upsert: true, new: true }
  );

  return course;
};

export const getEnrolledCourses = async (studentId) => {
  return Course.find({ enrolledStudents: studentId })
    .populate('instructor', 'name email')
    .sort({ createdAt: -1 });
};

export const getInstructorCourses = async (instructorId) => {
  return Course.find({ instructor: instructorId })
    .populate('instructor', 'name email')
    .sort({ createdAt: -1 });
};

export const updateLessonCount = async (courseId) => {
  const count = await Lesson.countDocuments({ course: courseId });
  await Course.findByIdAndUpdate(courseId, { lessonsCount: count });

  const progressEntries = await CourseProgress.find({ course: courseId });
  await Promise.all(progressEntries.map(async (progress) => {
    progress.totalLessons = count;
    progress.progressPercentage = count > 0
      ? (progress.completedLessons / count) * 100
      : 0;
    progress.isCompleted = count > 0 && progress.completedLessons >= count;
    if (!progress.isCompleted) {
      progress.completedAt = null;
    }
    await progress.save();
  }));
};
