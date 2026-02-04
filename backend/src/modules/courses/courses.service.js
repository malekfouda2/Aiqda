import Course from './course.model.js';
import Lesson from '../lessons/lesson.model.js';
import { CourseProgress } from '../analytics/progress.model.js';

export const createCourse = async (courseData, instructorId) => {
  const course = new Course({
    ...courseData,
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

export const getCourseById = async (courseId) => {
  const course = await Course.findById(courseId)
    .populate('instructor', 'name email');
  if (!course) {
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

  Object.assign(course, updates);
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

export const enrollStudent = async (courseId, studentId) => {
  const course = await Course.findById(courseId);
  if (!course) {
    throw new Error('Course not found');
  }

  if (!course.isPublished) {
    throw new Error('Course is not available for enrollment');
  }

  if (course.enrolledStudents.includes(studentId)) {
    throw new Error('Already enrolled in this course');
  }

  course.enrolledStudents.push(studentId);
  await course.save();

  const lessonsCount = await Lesson.countDocuments({ course: courseId, isPublished: true });
  
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
};
