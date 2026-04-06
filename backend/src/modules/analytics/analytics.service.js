import { LessonProgress, CourseProgress } from './progress.model.js';
import Course from '../courses/course.model.js';
import Lesson from '../lessons/lesson.model.js';
import User from '../users/user.model.js';
import Payment from '../payments/payment.model.js';
import { Subscription, SubscriptionPackage } from '../subscriptions/subscription.model.js';

const roundCurrency = (value) => Math.round(value * 100) / 100;
const toIdString = (value) => value?.toString();

const createEmptyCourseMetrics = () => ({
  lessons: [],
  lessonsCount: 0,
  videosAssigned: 0,
  videosPending: 0,
  progressCount: 0,
  watchPercentageSum: 0,
  avgWatchPercentage: 0,
  qualifiedViews: 0,
  quizPassCount: 0,
  estimatedRevenue: 0,
});

const countUniqueStudents = (courses = []) => {
  const uniqueStudents = new Set();

  for (const course of courses) {
    for (const studentId of course.enrolledStudents || []) {
      uniqueStudents.add(toIdString(studentId));
    }
  }

  return uniqueStudents.size;
};

const buildMonthlyCounts = (records = [], dateField) => {
  const monthlyCounts = new Map();

  for (const record of records) {
    const dateValue = record?.[dateField];

    if (!dateValue) {
      continue;
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const currentBucket = monthlyCounts.get(key);

    if (currentBucket) {
      currentBucket.count += 1;
      continue;
    }

    monthlyCounts.set(key, {
      _id: { year, month },
      count: 1
    });
  }

  return [...monthlyCounts.values()]
    .sort((a, b) => b._id.year - a._id.year || b._id.month - a._id.month)
    .slice(0, 12);
};

const getCourseRevenueAllocation = async (courseIds = []) => {
  const normalizedCourseIds = [...new Set(courseIds.map((courseId) => courseId.toString()))];
  const revenueByCourse = new Map(normalizedCourseIds.map((courseId) => [courseId, 0]));

  if (normalizedCourseIds.length === 0) {
    return revenueByCourse;
  }

  const packages = await SubscriptionPackage.find({ courses: { $in: courseIds } })
    .select('_id courses')
    .lean();

  if (packages.length === 0) {
    return revenueByCourse;
  }

  const packageCourseMap = new Map(
    packages.map((pkg) => [
      pkg._id.toString(),
      (pkg.courses || []).map((courseId) => courseId.toString())
    ])
  );

  const subscriptions = await Subscription.find({ package: { $in: packages.map((pkg) => pkg._id) } })
    .select('_id package')
    .lean();

  if (subscriptions.length === 0) {
    return revenueByCourse;
  }

  const subscriptionPackageMap = new Map(
    subscriptions.map((subscription) => [
      subscription._id.toString(),
      subscription.package.toString()
    ])
  );

  const payments = await Payment.find({
    subscription: { $in: subscriptions.map((subscription) => subscription._id) },
    status: 'approved'
  })
    .select('subscription amount')
    .lean();

  for (const payment of payments) {
    const packageId = subscriptionPackageMap.get(payment.subscription.toString());
    const packageCourses = packageCourseMap.get(packageId) || [];
    const packageCourseCount = packageCourses.length || 1;
    const revenueShare = Number(payment.amount || 0) / packageCourseCount;

    for (const courseId of packageCourses) {
      if (!revenueByCourse.has(courseId)) {
        continue;
      }

      revenueByCourse.set(courseId, revenueByCourse.get(courseId) + revenueShare);
    }
  }

  return new Map(
    [...revenueByCourse.entries()].map(([courseId, amount]) => [courseId, roundCurrency(amount)])
  );
};

const getCourseRevenue = (revenueByCourse, courseId) => {
  return roundCurrency(revenueByCourse.get(courseId.toString()) || 0);
};

const getCourseMetrics = (courseMetricsById, courseId) => {
  return courseMetricsById.get(toIdString(courseId)) || createEmptyCourseMetrics();
};

const buildCourseAnalyticsSnapshot = async (courses = []) => {
  const courseIds = courses.map((course) => course._id);
  const courseMetricsById = new Map(
    courseIds.map((courseId) => [toIdString(courseId), createEmptyCourseMetrics()])
  );

  if (courseIds.length === 0) {
    return {
      courseMetricsById,
      lessonProgress: [],
    };
  }

  const [lessons, lessonProgress, revenueByCourse] = await Promise.all([
    Lesson.find({ course: { $in: courseIds } })
      .select('course title vimeoVideoId order supportingFile supportingFileName')
      .sort({ course: 1, order: 1 })
      .lean(),
    LessonProgress.find({ course: { $in: courseIds } })
      .select('course watchPercentage isQualified quizPassed completedAt')
      .lean(),
    getCourseRevenueAllocation(courseIds)
  ]);

  for (const lesson of lessons) {
    const courseMetrics = courseMetricsById.get(toIdString(lesson.course));

    if (!courseMetrics) {
      continue;
    }

    courseMetrics.lessons.push(lesson);
    courseMetrics.lessonsCount += 1;

    if (lesson.vimeoVideoId) {
      courseMetrics.videosAssigned += 1;
    }
  }

  for (const progressEntry of lessonProgress) {
    const courseMetrics = courseMetricsById.get(toIdString(progressEntry.course));

    if (!courseMetrics) {
      continue;
    }

    courseMetrics.progressCount += 1;
    courseMetrics.watchPercentageSum += Number(progressEntry.watchPercentage || 0);

    if (progressEntry.isQualified) {
      courseMetrics.qualifiedViews += 1;
    }

    if (progressEntry.quizPassed) {
      courseMetrics.quizPassCount += 1;
    }
  }

  for (const [courseId, courseMetrics] of courseMetricsById.entries()) {
    courseMetrics.videosPending = Math.max(courseMetrics.lessonsCount - courseMetrics.videosAssigned, 0);
    courseMetrics.avgWatchPercentage = courseMetrics.progressCount > 0
      ? Math.round(courseMetrics.watchPercentageSum / courseMetrics.progressCount)
      : 0;
    courseMetrics.estimatedRevenue = getCourseRevenue(revenueByCourse, courseId);
  }

  return {
    courseMetricsById,
    lessonProgress,
  };
};

const getInstructorCourseDataset = async ({ activeOnly = false } = {}) => {
  const instructorQuery = { role: 'instructor' };

  if (activeOnly) {
    instructorQuery.isActive = true;
  }

  const instructors = await User.find(instructorQuery)
    .select('name email avatar createdAt isActive')
    .lean();

  const instructorIds = instructors.map((instructor) => instructor._id);
  const courses = instructorIds.length > 0
    ? await Course.find({ instructor: { $in: instructorIds } })
      .select('instructor title category level isPublished enrolledStudents lessonsCount createdAt')
      .lean()
    : [];

  const { courseMetricsById } = await buildCourseAnalyticsSnapshot(courses);
  const coursesByInstructorId = new Map(
    instructors.map((instructor) => [toIdString(instructor._id), []])
  );

  for (const course of courses) {
    const instructorCourses = coursesByInstructorId.get(toIdString(course.instructor));

    if (!instructorCourses) {
      coursesByInstructorId.set(toIdString(course.instructor), [course]);
      continue;
    }

    instructorCourses.push(course);
  }

  return {
    instructors,
    coursesByInstructorId,
    courseMetricsById,
  };
};

export const getStudentProgress = async (userId) => {
  const courseProgress = await CourseProgress.find({ user: userId })
    .populate('course', 'title thumbnail')
    .sort({ updatedAt: -1 });

  const lessonProgress = await LessonProgress.find({ user: userId })
    .populate('lesson', 'title')
    .populate('course', 'title')
    .sort({ lastWatchedAt: -1 })
    .limit(10);

  const stats = {
    totalCourses: courseProgress.length,
    completedCourses: courseProgress.filter(cp => cp.isCompleted).length,
    totalLessonsCompleted: courseProgress.reduce((acc, cp) => acc + cp.completedLessons, 0),
    overallProgress: courseProgress.length > 0 
      ? courseProgress.reduce((acc, cp) => acc + cp.progressPercentage, 0) / courseProgress.length 
      : 0
  };

  return { courseProgress, recentActivity: lessonProgress, stats };
};

export const getCourseProgress = async (userId, courseId) => {
  const courseProgress = await CourseProgress.findOne({ user: userId, course: courseId })
    .populate('course');

  const lessonProgress = await LessonProgress.find({ user: userId, course: courseId })
    .populate('lesson')
    .sort({ 'lesson.order': 1 });

  return { courseProgress, lessonProgress };
};

export const getInstructorAnalytics = async (instructorId) => {
  const courses = await Course.find({ instructor: instructorId })
    .select('title enrolledStudents')
    .lean();
  const { courseMetricsById, lessonProgress } = await buildCourseAnalyticsSnapshot(courses);

  const courseStats = courses.map((course) => {
    const courseMetrics = getCourseMetrics(courseMetricsById, course._id);

    return {
      courseId: course._id,
      title: course.title,
      enrolledCount: course.enrolledStudents?.length || 0,
      lessonsCount: courseMetrics.lessonsCount,
      qualifiedViews: courseMetrics.qualifiedViews,
      estimatedRevenue: courseMetrics.estimatedRevenue
    };
  });

  const totalRevenue = roundCurrency(
    courseStats.reduce((sum, course) => sum + course.estimatedRevenue, 0)
  );
  const totalQualifiedViews = courseStats.reduce((sum, course) => sum + course.qualifiedViews, 0);
  const monthlyStats = buildMonthlyCounts(
    lessonProgress.filter((progressEntry) => progressEntry.isQualified),
    'completedAt'
  );

  return {
    totalCourses: courses.length,
    totalStudents: countUniqueStudents(courses),
    totalQualifiedViews,
    totalRevenue,
    monthlyStats,
    courseStats,
    revenueCalculation: {
      placeholder: false,
      methodology: 'Approved subscription payments are allocated evenly across all courses included in each package.'
    }
  };
};

export const getAdminAnalytics = async () => {
  const [
    totalCourses,
    publishedCourses,
    totalLessons,
    courseProgress,
    qualifiedLessons,
    recentActivity
  ] = await Promise.all([
    Course.countDocuments(),
    Course.countDocuments({ isPublished: true }),
    Lesson.countDocuments(),
    CourseProgress.find().lean(),
    LessonProgress.countDocuments({ isQualified: true }),
    LessonProgress.find()
      .populate('user', 'name email')
      .populate('lesson', 'title')
      .populate('course', 'title')
      .sort({ updatedAt: -1 })
      .limit(20)
  ]);
  const totalEnrollments = courseProgress.length;
  const completedCourses = courseProgress.filter((progressEntry) => progressEntry.isCompleted).length;

  return {
    overview: {
      totalCourses,
      publishedCourses,
      totalLessons,
      totalEnrollments,
      completedCourses,
      qualifiedLessons
    },
    recentActivity
  };
};

export const getAdminCoursesByInstructor = async () => {
  const { instructors, coursesByInstructorId, courseMetricsById } = await getInstructorCourseDataset({
    activeOnly: true
  });

  const result = instructors.map((instructor) => {
    const courses = coursesByInstructorId.get(toIdString(instructor._id)) || [];
    const courseAnalytics = courses.map((course) => {
      const courseMetrics = getCourseMetrics(courseMetricsById, course._id);

      return {
        _id: course._id,
        title: course.title,
        category: course.category,
        level: course.level,
        isPublished: course.isPublished,
        createdAt: course.createdAt,
        enrolledStudents: course.enrolledStudents?.length || 0,
        lessonsCount: courseMetrics.lessonsCount,
        videosAssigned: courseMetrics.videosAssigned,
        videosPending: courseMetrics.videosPending,
        avgWatchPercentage: courseMetrics.avgWatchPercentage,
        qualifiedViews: courseMetrics.qualifiedViews,
        quizPassCount: courseMetrics.quizPassCount,
        estimatedRevenue: roundCurrency(courseMetrics.estimatedRevenue),
        lessons: courseMetrics.lessons.map((lesson) => ({
          _id: lesson._id,
          title: lesson.title,
          order: lesson.order,
          hasVideo: !!lesson.vimeoVideoId,
          vimeoVideoId: lesson.vimeoVideoId,
        })),
      };
    });
    const totalRevenue = roundCurrency(
      courseAnalytics.reduce((sum, course) => sum + course.estimatedRevenue, 0)
    );

    return {
      instructor: {
        _id: instructor._id,
        name: instructor.name,
        email: instructor.email,
        avatar: instructor.avatar,
        joinedAt: instructor.createdAt,
      },
      totalCourses: courses.length,
      totalStudents: countUniqueStudents(courses),
      totalRevenue,
      courses: courseAnalytics,
    };
  });

  return result.sort((a, b) => b.totalStudents - a.totalStudents);
};

export const getAdminInstructorDetail = async (instructorId) => {
  const instructor = await User.findById(instructorId)
    .select('name email avatar role createdAt isActive')
    .lean();
  if (!instructor || instructor.role !== 'instructor') {
    throw new Error('Instructor not found');
  }

  const courses = await Course.find({ instructor: instructorId })
    .select('title category level isPublished enrolledStudents lessonsCount createdAt')
    .lean();

  const courseIds = courses.map((course) => course._id);
  const [{ courseMetricsById }, allCourseProgress] = await Promise.all([
    buildCourseAnalyticsSnapshot(courses),
    courseIds.length > 0
      ? CourseProgress.find({ course: { $in: courseIds } })
        .select('course isCompleted startedAt')
        .lean()
      : Promise.resolve([])
  ]);

  const totalStudents = countUniqueStudents(courses);
  const totalProgressEntries = [...courseMetricsById.values()]
    .reduce((sum, courseMetrics) => sum + courseMetrics.progressCount, 0);
  const totalWatchPercentage = [...courseMetricsById.values()]
    .reduce((sum, courseMetrics) => sum + courseMetrics.watchPercentageSum, 0);
  const qualifiedViews = [...courseMetricsById.values()]
    .reduce((sum, courseMetrics) => sum + courseMetrics.qualifiedViews, 0);
  const quizPassCount = [...courseMetricsById.values()]
    .reduce((sum, courseMetrics) => sum + courseMetrics.quizPassCount, 0);
  const completedCourses = allCourseProgress.filter((progressEntry) => progressEntry.isCompleted).length;

  const courseAnalytics = courses.map((course) => {
    const courseMetrics = getCourseMetrics(courseMetricsById, course._id);

    return {
      _id: course._id,
      title: course.title,
      category: course.category,
      level: course.level,
      isPublished: course.isPublished,
      createdAt: course.createdAt,
      enrolledStudents: course.enrolledStudents?.length || 0,
      lessonsCount: courseMetrics.lessonsCount,
      videosAssigned: courseMetrics.videosAssigned,
      videosPending: courseMetrics.videosPending,
      avgWatchPercentage: courseMetrics.avgWatchPercentage,
      qualifiedViews: courseMetrics.qualifiedViews,
      quizPassCount: courseMetrics.quizPassCount,
      estimatedRevenue: roundCurrency(courseMetrics.estimatedRevenue),
      lessons: courseMetrics.lessons.map((lesson) => ({
        _id: lesson._id,
        title: lesson.title,
        order: lesson.order,
        vimeoVideoId: lesson.vimeoVideoId,
        supportingFile: lesson.supportingFile,
        supportingFileName: lesson.supportingFileName,
      })),
    };
  });
  const totalRevenue = roundCurrency(
    courseAnalytics.reduce((sum, course) => sum + course.estimatedRevenue, 0)
  );
  const monthlyEnrollments = buildMonthlyCounts(allCourseProgress, 'startedAt');

  return {
    instructor: {
      _id: instructor._id,
      name: instructor.name,
      email: instructor.email,
      avatar: instructor.avatar,
      isActive: instructor.isActive,
      joinedAt: instructor.createdAt,
    },
    summary: {
      totalCourses: courses.length,
      publishedCourses: courses.filter((course) => course.isPublished).length,
      totalStudents,
      totalRevenue,
      avgWatchPercentage: totalProgressEntries > 0
        ? Math.round(totalWatchPercentage / totalProgressEntries)
        : 0,
      completedCourses,
      qualifiedViews,
      quizPassRate: totalProgressEntries > 0
        ? Math.round((quizPassCount / totalProgressEntries) * 100)
        : 0,
    },
    courses: courseAnalytics,
    monthlyEnrollments,
  };
};

export const getAdminAllInstructors = async () => {
  const { instructors, coursesByInstructorId, courseMetricsById } = await getInstructorCourseDataset();

  const result = instructors.map((instructor) => {
    const courses = coursesByInstructorId.get(toIdString(instructor._id)) || [];
    const totalLessons = courses.reduce(
      (sum, course) => sum + getCourseMetrics(courseMetricsById, course._id).lessonsCount,
      0
    );
    const videosAssigned = courses.reduce(
      (sum, course) => sum + getCourseMetrics(courseMetricsById, course._id).videosAssigned,
      0
    );
    const totalRevenue = roundCurrency(
      courses.reduce(
        (sum, course) => sum + getCourseMetrics(courseMetricsById, course._id).estimatedRevenue,
        0
      )
    );
    const totalProgressEntries = courses.reduce(
      (sum, course) => sum + getCourseMetrics(courseMetricsById, course._id).progressCount,
      0
    );
    const totalWatchPercentage = courses.reduce(
      (sum, course) => sum + getCourseMetrics(courseMetricsById, course._id).watchPercentageSum,
      0
    );
    const qualifiedViews = courses.reduce(
      (sum, course) => sum + getCourseMetrics(courseMetricsById, course._id).qualifiedViews,
      0
    );

    return {
      _id: instructor._id,
      name: instructor.name,
      email: instructor.email,
      avatar: instructor.avatar,
      isActive: instructor.isActive,
      joinedAt: instructor.createdAt,
      totalCourses: courses.length,
      publishedCourses: courses.filter((course) => course.isPublished).length,
      totalStudents: countUniqueStudents(courses),
      totalLessons,
      videosAssigned,
      videosPending: Math.max(totalLessons - videosAssigned, 0),
      avgWatchPercentage: totalProgressEntries > 0
        ? Math.round(totalWatchPercentage / totalProgressEntries)
        : 0,
      qualifiedViews,
      totalRevenue,
    };
  });

  return result.sort((a, b) => b.totalStudents - a.totalStudents);
};

export const getLessonAnalytics = async (lessonId) => {
  const progress = await LessonProgress.find({ lesson: lessonId })
    .populate('user', 'name email');

  const stats = {
    totalViews: progress.length,
    averageWatchPercentage: progress.reduce((acc, p) => acc + p.watchPercentage, 0) / (progress.length || 1),
    quizPassRate: (progress.filter(p => p.quizPassed).length / (progress.length || 1)) * 100,
    qualificationRate: (progress.filter(p => p.isQualified).length / (progress.length || 1)) * 100
  };

  return { stats, progress };
};
