import Course from './course.model.js';
import Lesson from '../lessons/lesson.model.js';
import { CourseProgress } from '../analytics/progress.model.js';
import { getSubscriptionAccessContext } from '../subscriptions/subscriptions.service.js';
import { SubscriptionPackage } from '../subscriptions/subscription.model.js';

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

const normalizePackageIds = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .map((entry) => entry?._id?.toString?.() || entry?.toString?.() || '')
      .filter(Boolean)
  )];
};

const ensurePackageAssignmentsExist = async (packageIds) => {
  if (packageIds.length === 0) {
    return;
  }

  const packages = await SubscriptionPackage.find({ _id: { $in: packageIds } })
    .select('_id')
    .lean();

  if (packages.length !== packageIds.length) {
    throw new Error('One or more selected subscription packages were not found');
  }
};

const syncCoursePackageAssignments = async (courseId, packageIds) => {
  await SubscriptionPackage.updateMany(
    { courses: courseId, _id: { $nin: packageIds } },
    { $pull: { courses: courseId } }
  );

  if (packageIds.length > 0) {
    await SubscriptionPackage.updateMany(
      { _id: { $in: packageIds } },
      { $addToSet: { courses: courseId } }
    );
  }
};

const buildAssignedPackagesMap = async (courseIds) => {
  if (!Array.isArray(courseIds) || courseIds.length === 0) {
    return new Map();
  }

  const packages = await SubscriptionPackage.find({
    courses: { $in: courseIds }
  })
    .select('name isActive purchaseMode courses')
    .lean();

  const assignedPackagesByCourseId = new Map();

  for (const pkg of packages) {
    for (const packageCourseId of pkg.courses || []) {
      const normalizedCourseId = packageCourseId.toString();
      if (!courseIds.some((courseId) => courseId.toString() === normalizedCourseId)) {
        continue;
      }

      const currentPackages = assignedPackagesByCourseId.get(normalizedCourseId) || [];
      currentPackages.push({
        _id: pkg._id,
        name: pkg.name,
        isActive: pkg.isActive,
        purchaseMode: pkg.purchaseMode,
      });
      assignedPackagesByCourseId.set(normalizedCourseId, currentPackages);
    }
  }

  return assignedPackagesByCourseId;
};

const attachAssignedPackages = async (courseOrCourses) => {
  if (!courseOrCourses) {
    return courseOrCourses;
  }

  const courseList = Array.isArray(courseOrCourses) ? courseOrCourses : [courseOrCourses];
  const assignedPackagesByCourseId = await buildAssignedPackagesMap(
    courseList.map((course) => course._id)
  );

  const enrichCourse = (course) => {
    const normalizedCourse = course.toObject ? course.toObject() : { ...course };
    return {
      ...normalizedCourse,
      assignedPackages: assignedPackagesByCourseId.get(course._id.toString()) || [],
    };
  };

  return Array.isArray(courseOrCourses)
    ? courseList.map(enrichCourse)
    : enrichCourse(courseList[0]);
};

export const createCourse = async (courseData, instructorId) => {
  const packageIds = normalizePackageIds(courseData.packageIds);
  await ensurePackageAssignmentsExist(packageIds);

  const sanitizedCourseData = sanitizeCourseUpdates(courseData);
  const course = new Course({
    ...sanitizedCourseData,
    instructor: instructorId
  });
  await course.save();
  await syncCoursePackageAssignments(course._id, packageIds);
  const populatedCourse = await course.populate('instructor', 'name email');
  return attachAssignedPackages(populatedCourse);
};

export const getAllCourses = async (filters = {}) => {
  const query = {};
  if (filters.instructor) query.instructor = filters.instructor;
  if (filters.isPublished !== undefined) query.isPublished = filters.isPublished;
  if (filters.category) query.category = filters.category;
  
  const courses = await Course.find(query)
    .populate('instructor', 'name email')
    .sort({ createdAt: -1 });

  return attachAssignedPackages(courses);
};

export const getPublishedCourses = async () => {
  const courses = await Course.find({ isPublished: true })
    .populate('instructor', 'name email')
    .sort({ createdAt: -1 });

  return attachAssignedPackages(courses);
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

  const enrichedCourse = await attachAssignedPackages(course);

  if (userId && !['admin', 'instructor'].includes(userRole || '')) {
    const accessContext = await getSubscriptionAccessContext(userId, courseId);
    return {
      ...enrichedCourse,
      accessContext: {
        hasActiveSubscription: accessContext.hasActiveSubscription,
        hasCourseAccess: accessContext.hasCourseAccess,
      },
    };
  }

  return enrichedCourse;
};

export const updateCourse = async (courseId, updates, userId, userRole) => {
  const course = await Course.findById(courseId);
  if (!course) {
    throw new Error('Course not found');
  }

  if (userRole !== 'admin' && course.instructor.toString() !== userId) {
    throw new Error('Not authorized to update this course');
  }

  const hasPackageAssignments = Object.prototype.hasOwnProperty.call(updates, 'packageIds');
  const packageIds = hasPackageAssignments ? normalizePackageIds(updates.packageIds) : null;
  if (hasPackageAssignments) {
    await ensurePackageAssignmentsExist(packageIds);
  }

  const sanitizedUpdates = sanitizeCourseUpdates(updates);
  if (Object.keys(sanitizedUpdates).length === 0 && !hasPackageAssignments) {
    throw new Error('No valid course fields to update');
  }

  Object.assign(course, sanitizedUpdates);
  await course.save();
  if (hasPackageAssignments) {
    await syncCoursePackageAssignments(course._id, packageIds);
  }
  const populatedCourse = await course.populate('instructor', 'name email');
  return attachAssignedPackages(populatedCourse);
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
  await SubscriptionPackage.updateMany(
    { courses: courseId },
    { $pull: { courses: courseId } }
  );
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
    const subscriptionAccess = await getSubscriptionAccessContext(studentId, courseId);
    if (!subscriptionAccess.hasActiveSubscription) {
      throw new Error('You need an active subscription to enroll in this course');
    }
    if (!subscriptionAccess.hasCourseAccess) {
      throw new Error('Your current subscription does not include access to this chapter');
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
  const courses = await Course.find({ enrolledStudents: studentId })
    .populate('instructor', 'name email')
    .sort({ createdAt: -1 });

  return attachAssignedPackages(courses);
};

export const getInstructorCourses = async (instructorId) => {
  const courses = await Course.find({ instructor: instructorId })
    .populate('instructor', 'name email')
    .sort({ createdAt: -1 });

  return attachAssignedPackages(courses);
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
