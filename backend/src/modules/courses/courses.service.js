import Course from './course.model.js';
import Lesson from '../lessons/lesson.model.js';
import User from '../users/user.model.js';
import { CourseProgress } from '../analytics/progress.model.js';
import { getSubscriptionAccessContext } from '../subscriptions/subscriptions.service.js';
import { SubscriptionPackage, Subscription } from '../subscriptions/subscription.model.js';
import { notify } from '../notifications/notify.js';

const MEMBER_ACCESS_SUBSCRIPTION_STATUSES = ['active', 'grace_period', 'cancel_scheduled'];

// Notify members with an active subscription to a tier that includes this course
// that fresh content is now available to them.
const notifyMembersOfPublishedChapter = async (course) => {
  const packages = await SubscriptionPackage.find({ courses: course._id }).select('_id').lean();
  if (packages.length === 0) {
    return;
  }

  const subscriptions = await Subscription.find({
    package: { $in: packages.map((pkg) => pkg._id) },
    status: { $in: MEMBER_ACCESS_SUBSCRIPTION_STATUSES },
  }).select('user').lean();

  await notify.users(subscriptions.map((subscription) => subscription.user), {
    type: 'chapter.published',
    title: 'New content available',
    titleAr: 'محتوى جديد متاح',
    message: `"${course.title}" is now available in your subscription.`,
    messageAr: `"${course.title}" متاح الآن ضمن اشتراكك.`,
    link: `/chapters/${course._id}`,
    metadata: { courseId: course._id },
  });
};

// isPublished/reviewStatus are intentionally excluded: publish state is only ever
// changed through the dedicated submit-for-review (creator) and publish (admin) flows.
const COURSE_UPDATABLE_FIELDS = [
  'title',
  'description',
  'thumbnail',
  'category',
  'software'
];

// Trim, drop empties, dedupe (case-insensitive), and cap the software tag list.
const normalizeSoftware = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set();
  const result = [];
  for (const raw of value) {
    const tag = String(raw || '').trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= 20) break;
  }
  return result;
};

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
  const sanitized = Object.fromEntries(
    Object.entries(updates).filter(([key]) => COURSE_UPDATABLE_FIELDS.includes(key))
  );
  if ('software' in sanitized) {
    sanitized.software = normalizeSoftware(sanitized.software);
  }
  return sanitized;
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

// Creators may only assign their content to subscription tiers they have been
// assigned to by an admin. Admins can assign any tier.
const ensureInstructorCanAssignPackages = async (userId, userRole, packageIds) => {
  if (userRole === 'admin' || packageIds.length === 0) {
    return;
  }

  const user = await User.findById(userId).select('assignedPackages').lean();
  const assigned = new Set((user?.assignedPackages || []).map((id) => id.toString()));

  const hasDisallowed = packageIds.some((id) => !assigned.has(id.toString()));
  if (hasDisallowed) {
    throw new Error('You can only assign content to subscription tiers you have been assigned to');
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

export const createCourse = async (courseData, instructorId, userRole = 'instructor') => {
  const packageIds = normalizePackageIds(courseData.packageIds);
  await ensurePackageAssignmentsExist(packageIds);
  await ensureInstructorCanAssignPackages(instructorId, userRole, packageIds);

  // Creators are limited to an admin-configurable number of chapters (1 by default).
  // Admins are exempt.
  if (userRole !== 'admin') {
    const creator = await User.findById(instructorId).select('chapterLimit');
    const chapterLimit = Number.isFinite(creator?.chapterLimit) ? creator.chapterLimit : 1;
    const existingCount = await Course.countDocuments({ instructor: instructorId });
    if (existingCount >= chapterLimit) {
      throw new Error(
        chapterLimit === 1
          ? 'You can only create one chapter.'
          : `You can only create up to ${chapterLimit} chapters.`
      );
    }
  }

  const sanitizedCourseData = sanitizeCourseUpdates(courseData);
  // Append to the end of this instructor's chapter sequence.
  const lastCourse = await Course.findOne({ instructor: instructorId }).sort({ order: -1 }).select('order');
  const nextOrder = lastCourse && lastCourse.order ? lastCourse.order + 1 : 1;
  const course = new Course({
    ...sanitizedCourseData,
    instructor: instructorId,
    order: nextOrder
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
    .populate('instructor', 'name email teaserVimeoVideoId teaserVimeoEmbedUrl');
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
    await ensureInstructorCanAssignPackages(userId, userRole, packageIds);
  }

  const sanitizedUpdates = sanitizeCourseUpdates(updates);
  if (Object.keys(sanitizedUpdates).length === 0 && !hasPackageAssignments) {
    throw new Error('No valid course fields to update');
  }

  Object.assign(course, sanitizedUpdates);

  // A creator editing live or in-review content sends it back to draft so it must
  // be re-submitted and re-published by an admin. Admin edits don't reset state.
  if (userRole !== 'admin' && Object.keys(sanitizedUpdates).length > 0 && course.reviewStatus !== 'draft') {
    course.reviewStatus = 'draft';
    course.isPublished = false;
  }

  await course.save();
  if (hasPackageAssignments) {
    await syncCoursePackageAssignments(course._id, packageIds);
  }
  const populatedCourse = await course.populate('instructor', 'name email');
  return attachAssignedPackages(populatedCourse);
};

export const submitCourseForReview = async (courseId, userId, userRole) => {
  const course = await Course.findById(courseId);
  if (!course) {
    throw new Error('Course not found');
  }

  if (userRole !== 'admin' && course.instructor.toString() !== userId) {
    throw new Error('Not authorized to submit this course for review');
  }

  if (course.reviewStatus === 'pending_review') {
    throw new Error('This chapter is already awaiting review');
  }
  if (course.reviewStatus === 'published') {
    throw new Error('This chapter is already published');
  }

  course.reviewStatus = 'pending_review';
  await course.save();
  const populatedCourse = await course.populate('instructor', 'name email');

  await notify.admins({
    type: 'review.chapter_submitted',
    title: 'Chapter submitted for review',
    titleAr: 'تم إرسال فصل للمراجعة',
    message: `"${course.title}" was submitted and is awaiting your review.`,
    messageAr: `تم إرسال "${course.title}" وهو بانتظار مراجعتك.`,
    link: `/admin/chapters?instructorId=${course.instructor?._id || course.instructor}&courseId=${course._id}`,
    metadata: { courseId: course._id, instructorId: course.instructor?._id || course.instructor },
  });

  return attachAssignedPackages(populatedCourse);
};

// Admin-only publish control. Publishing makes the chapter publicly accessible;
// unpublishing returns it to draft so the creator can revise and resubmit.
export const setCoursePublishState = async (courseId, isPublished) => {
  const course = await Course.findById(courseId);
  if (!course) {
    throw new Error('Course not found');
  }

  course.isPublished = Boolean(isPublished);
  course.reviewStatus = isPublished ? 'published' : 'draft';
  await course.save();
  const populatedCourse = await course.populate('instructor', 'name email');

  await notify.user(course.instructor, {
    type: isPublished ? 'review.chapter_published' : 'review.chapter_returned',
    title: isPublished ? 'Your chapter was published' : 'Your chapter was returned to draft',
    titleAr: isPublished ? 'تم نشر فصلك' : 'تمت إعادة فصلك إلى المسودة',
    message: isPublished
      ? `"${course.title}" is now live and visible to members.`
      : `"${course.title}" was returned to draft. Update it and resubmit for review.`,
    messageAr: isPublished
      ? `"${course.title}" أصبح منشورًا ومرئيًا للأعضاء.`
      : `تمت إعادة "${course.title}" إلى المسودة. عدّله وأعد إرساله للمراجعة.`,
    link: `/creator/chapters?courseId=${course._id}`,
    metadata: { courseId: course._id },
  });

  if (isPublished) {
    await notifyMembersOfPublishedChapter(course);
  }

  return attachAssignedPackages(populatedCourse);
};

// Reorders an instructor's chapters. courseOrders: [{ courseId, order }]. Admins may
// reorder any instructor's chapters; instructors only their own. All chapters in the
// batch must belong to the same instructor.
export const reorderCourses = async (courseOrders, userId = null, userRole = null) => {
  if (!Array.isArray(courseOrders) || courseOrders.length === 0) {
    throw new Error('Chapter order updates are required');
  }

  const courseIds = courseOrders.map(({ courseId }) => courseId);
  const courses = await Course.find({ _id: { $in: courseIds } }).select('_id instructor');

  if (courses.length !== courseIds.length) {
    throw new Error('One or more chapters were not found');
  }

  const instructorIds = new Set(courses.map((c) => c.instructor.toString()));
  if (instructorIds.size !== 1) {
    throw new Error('All chapters in a reorder must belong to the same creator');
  }

  const ownerId = [...instructorIds][0];
  if (userRole !== 'admin' && ownerId !== userId?.toString()) {
    throw new Error('Not authorized to reorder these chapters');
  }

  const seenOrders = new Set();
  for (const { courseId, order } of courseOrders) {
    const normalizedOrder = Number(order);
    if (!courseId) {
      throw new Error('Each chapter order update must include a courseId');
    }
    if (!Number.isInteger(normalizedOrder) || normalizedOrder < 1) {
      throw new Error('Chapter order must be a positive integer');
    }
    if (seenOrders.has(normalizedOrder)) {
      throw new Error('Chapter order values must be unique');
    }
    seenOrders.add(normalizedOrder);
  }

  await Promise.all(
    courseOrders.map(({ courseId, order }) => (
      Course.findByIdAndUpdate(courseId, { order: Number(order) })
    ))
  );

  return { message: 'Chapters reordered successfully' };
};

export const deleteCourse = async (courseId, userId, userRole) => {
  const course = await Course.findById(courseId);
  if (!course) {
    throw new Error('Course not found');
  }

  if (userRole !== 'admin' && course.instructor.toString() !== userId) {
    throw new Error('Not authorized to delete this course');
  }

  if (course.isPublished || course.reviewStatus !== 'draft') {
    throw new Error('Only draft chapters can be deleted. Return it to draft first.');
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

  await notify.user(course.instructor, {
    type: 'chapter.new_enrollment',
    title: 'New member enrolled',
    titleAr: 'انضمّ عضو جديد',
    message: `A new member just enrolled in "${course.title}".`,
    messageAr: `انضمّ عضو جديد إلى "${course.title}".`,
    link: `/creator/chapters?courseId=${course._id}`,
    metadata: { courseId: course._id },
  });

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
    .sort({ order: 1, createdAt: 1 });

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
