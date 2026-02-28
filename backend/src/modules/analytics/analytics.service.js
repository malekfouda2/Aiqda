import { LessonProgress, CourseProgress } from './progress.model.js';
import Course from '../courses/course.model.js';
import Lesson from '../lessons/lesson.model.js';

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
  const courses = await Course.find({ instructor: instructorId });
  const courseIds = courses.map(c => c._id);

  const totalStudents = new Set();
  courses.forEach(c => c.enrolledStudents.forEach(s => totalStudents.add(s.toString())));

  const qualifiedViews = await LessonProgress.countDocuments({
    course: { $in: courseIds },
    isQualified: true
  });

  const monthlyStats = await LessonProgress.aggregate([
    { $match: { course: { $in: courseIds }, isQualified: true } },
    {
      $group: {
        _id: {
          year: { $year: '$completedAt' },
          month: { $month: '$completedAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 }
  ]);

  const courseStats = await Promise.all(courses.map(async (course) => {
    const lessons = await Lesson.countDocuments({ course: course._id });
    const qualified = await LessonProgress.countDocuments({ 
      course: course._id, 
      isQualified: true 
    });
    
    return {
      courseId: course._id,
      title: course.title,
      enrolledCount: course.enrolledStudents.length,
      lessonsCount: lessons,
      qualifiedViews: qualified
    };
  }));

  return {
    totalCourses: courses.length,
    totalStudents: totalStudents.size,
    totalQualifiedViews: qualifiedViews,
    monthlyStats,
    courseStats,
    revenueCalculation: {
      placeholder: true,
      message: 'Revenue calculation will be implemented based on business rules'
    }
  };
};

export const getAdminAnalytics = async () => {
  const totalCourses = await Course.countDocuments();
  const publishedCourses = await Course.countDocuments({ isPublished: true });
  const totalLessons = await Lesson.countDocuments();
  
  const courseProgress = await CourseProgress.find();
  const totalEnrollments = courseProgress.length;
  const completedCourses = courseProgress.filter(cp => cp.isCompleted).length;

  const qualifiedLessons = await LessonProgress.countDocuments({ isQualified: true });

  const recentActivity = await LessonProgress.find()
    .populate('user', 'name email')
    .populate('lesson', 'title')
    .populate('course', 'title')
    .sort({ updatedAt: -1 })
    .limit(20);

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
  const User = (await import('../users/user.model.js')).default;
  const Payment = (await import('../payments/payment.model.js')).default;
  const { Subscription, SubscriptionPackage } = await import('../subscriptions/subscription.model.js');

  const instructors = await User.find({ role: 'instructor', isActive: true }).select('name email avatar createdAt');

  const result = await Promise.all(instructors.map(async (instructor) => {
    const courses = await Course.find({ instructor: instructor._id })
      .select('title category level isPublished enrolledStudents lessonsCount createdAt');

    const courseIds = courses.map(c => c._id);

    const courseAnalytics = await Promise.all(courses.map(async (course) => {
      const lessons = await Lesson.find({ course: course._id }).select('title vimeoVideoId order');

      const lessonProgressData = await LessonProgress.find({ course: course._id });
      const avgWatchPct = lessonProgressData.length > 0
        ? lessonProgressData.reduce((acc, lp) => acc + lp.watchPercentage, 0) / lessonProgressData.length
        : 0;
      const qualifiedCount = lessonProgressData.filter(lp => lp.isQualified).length;
      const quizPassCount = lessonProgressData.filter(lp => lp.quizPassed).length;

      const packages = await SubscriptionPackage.find({ courses: course._id });
      const packageIds = packages.map(p => p._id);

      let courseRevenue = 0;
      if (packageIds.length > 0) {
        const subs = await Subscription.find({ package: { $in: packageIds }, status: 'active' });
        const subIds = subs.map(s => s._id);
        if (subIds.length > 0) {
          const payments = await Payment.find({ subscription: { $in: subIds }, status: 'approved' });
          const totalPayments = payments.reduce((acc, p) => acc + p.amount, 0);
          const avgCoursesPerPackage = packages.reduce((acc, pkg) => acc + (pkg.courses?.length || 1), 0) / packages.length;
          courseRevenue = totalPayments / avgCoursesPerPackage;
        }
      }

      const videosAssigned = lessons.filter(l => l.vimeoVideoId).length;
      const totalLessons = lessons.length;

      return {
        _id: course._id,
        title: course.title,
        category: course.category,
        level: course.level,
        isPublished: course.isPublished,
        createdAt: course.createdAt,
        enrolledStudents: course.enrolledStudents?.length || 0,
        lessonsCount: totalLessons,
        videosAssigned,
        videosPending: totalLessons - videosAssigned,
        avgWatchPercentage: Math.round(avgWatchPct),
        qualifiedViews: qualifiedCount,
        quizPassCount,
        estimatedRevenue: Math.round(courseRevenue * 100) / 100,
        lessons: lessons.map(l => ({
          _id: l._id,
          title: l.title,
          order: l.order,
          hasVideo: !!l.vimeoVideoId,
          vimeoVideoId: l.vimeoVideoId,
        })),
      };
    }));

    const totalStudents = new Set();
    courses.forEach(c => c.enrolledStudents?.forEach(s => totalStudents.add(s.toString())));
    const totalRevenue = courseAnalytics.reduce((acc, ca) => acc + ca.estimatedRevenue, 0);

    return {
      instructor: {
        _id: instructor._id,
        name: instructor.name,
        email: instructor.email,
        avatar: instructor.avatar,
        joinedAt: instructor.createdAt,
      },
      totalCourses: courses.length,
      totalStudents: totalStudents.size,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      courses: courseAnalytics,
    };
  }));

  return result.sort((a, b) => b.totalStudents - a.totalStudents);
};

export const getAdminInstructorDetail = async (instructorId) => {
  const User = (await import('../users/user.model.js')).default;
  const Payment = (await import('../payments/payment.model.js')).default;
  const { Subscription, SubscriptionPackage } = await import('../subscriptions/subscription.model.js');

  const instructor = await User.findById(instructorId).select('name email avatar role createdAt isActive');
  if (!instructor || instructor.role !== 'instructor') {
    throw new Error('Instructor not found');
  }

  const courses = await Course.find({ instructor: instructorId })
    .select('title category level isPublished enrolledStudents lessonsCount createdAt');

  const courseIds = courses.map(c => c._id);

  const allLessonProgress = await LessonProgress.find({ course: { $in: courseIds } });
  const allCourseProgress = await CourseProgress.find({ course: { $in: courseIds } });

  const totalStudents = new Set();
  courses.forEach(c => c.enrolledStudents?.forEach(s => totalStudents.add(s.toString())));

  const avgWatchPct = allLessonProgress.length > 0
    ? allLessonProgress.reduce((acc, lp) => acc + lp.watchPercentage, 0) / allLessonProgress.length
    : 0;

  const completedCourses = allCourseProgress.filter(cp => cp.isCompleted).length;
  const qualifiedViews = allLessonProgress.filter(lp => lp.isQualified).length;
  const quizPassRate = allLessonProgress.length > 0
    ? (allLessonProgress.filter(lp => lp.quizPassed).length / allLessonProgress.length) * 100
    : 0;

  let totalRevenue = 0;
  const courseAnalytics = await Promise.all(courses.map(async (course) => {
    const lessons = await Lesson.find({ course: course._id }).select('title vimeoVideoId order supportingFile supportingFileName');
    const courseLessonProgress = allLessonProgress.filter(lp => lp.course.toString() === course._id.toString());

    const courseAvgWatch = courseLessonProgress.length > 0
      ? courseLessonProgress.reduce((acc, lp) => acc + lp.watchPercentage, 0) / courseLessonProgress.length
      : 0;

    const packages = await SubscriptionPackage.find({ courses: course._id });
    const packageIds = packages.map(p => p._id);
    let courseRevenue = 0;
    if (packageIds.length > 0) {
      const subs = await Subscription.find({ package: { $in: packageIds }, status: 'active' });
      const subIds = subs.map(s => s._id);
      if (subIds.length > 0) {
        const payments = await Payment.find({ subscription: { $in: subIds }, status: 'approved' });
        const totalPayments = payments.reduce((acc, p) => acc + p.amount, 0);
        const avgCoursesPerPackage = packages.reduce((acc, pkg) => acc + (pkg.courses?.length || 1), 0) / packages.length;
        courseRevenue = totalPayments / avgCoursesPerPackage;
      }
    }
    totalRevenue += courseRevenue;

    const videosAssigned = lessons.filter(l => l.vimeoVideoId).length;

    return {
      _id: course._id,
      title: course.title,
      category: course.category,
      level: course.level,
      isPublished: course.isPublished,
      createdAt: course.createdAt,
      enrolledStudents: course.enrolledStudents?.length || 0,
      lessonsCount: lessons.length,
      videosAssigned,
      videosPending: lessons.length - videosAssigned,
      avgWatchPercentage: Math.round(courseAvgWatch),
      qualifiedViews: courseLessonProgress.filter(lp => lp.isQualified).length,
      quizPassCount: courseLessonProgress.filter(lp => lp.quizPassed).length,
      estimatedRevenue: Math.round(courseRevenue * 100) / 100,
      lessons,
    };
  }));

  const monthlyEnrollments = await CourseProgress.aggregate([
    { $match: { course: { $in: courseIds } } },
    {
      $group: {
        _id: {
          year: { $year: '$startedAt' },
          month: { $month: '$startedAt' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 },
  ]);

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
      publishedCourses: courses.filter(c => c.isPublished).length,
      totalStudents: totalStudents.size,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgWatchPercentage: Math.round(avgWatchPct),
      completedCourses,
      qualifiedViews,
      quizPassRate: Math.round(quizPassRate),
    },
    courses: courseAnalytics,
    monthlyEnrollments,
  };
};

export const getAdminAllInstructors = async () => {
  const User = (await import('../users/user.model.js')).default;
  const Payment = (await import('../payments/payment.model.js')).default;
  const { Subscription, SubscriptionPackage } = await import('../subscriptions/subscription.model.js');

  const instructors = await User.find({ role: 'instructor' }).select('name email avatar createdAt isActive');

  const result = await Promise.all(instructors.map(async (instructor) => {
    const courses = await Course.find({ instructor: instructor._id })
      .select('title isPublished enrolledStudents lessonsCount');

    const courseIds = courses.map(c => c._id);

    const totalStudents = new Set();
    courses.forEach(c => c.enrolledStudents?.forEach(s => totalStudents.add(s.toString())));

    const lessonProgress = await LessonProgress.find({ course: { $in: courseIds } });
    const avgWatch = lessonProgress.length > 0
      ? lessonProgress.reduce((acc, lp) => acc + lp.watchPercentage, 0) / lessonProgress.length
      : 0;
    const qualifiedViews = lessonProgress.filter(lp => lp.isQualified).length;

    const totalLessons = courses.reduce((acc, c) => acc + (c.lessonsCount || 0), 0);
    const allLessons = await Lesson.find({ course: { $in: courseIds } }).select('vimeoVideoId');
    const videosAssigned = allLessons.filter(l => l.vimeoVideoId).length;

    let totalRevenue = 0;
    for (const course of courses) {
      const packages = await SubscriptionPackage.find({ courses: course._id });
      const packageIds = packages.map(p => p._id);
      if (packageIds.length > 0) {
        const subs = await Subscription.find({ package: { $in: packageIds }, status: 'active' });
        const subIds = subs.map(s => s._id);
        if (subIds.length > 0) {
          const payments = await Payment.find({ subscription: { $in: subIds }, status: 'approved' });
          const paidTotal = payments.reduce((acc, p) => acc + p.amount, 0);
          const avgCourses = packages.reduce((acc, pkg) => acc + (pkg.courses?.length || 1), 0) / packages.length;
          totalRevenue += paidTotal / avgCourses;
        }
      }
    }

    return {
      _id: instructor._id,
      name: instructor.name,
      email: instructor.email,
      avatar: instructor.avatar,
      isActive: instructor.isActive,
      joinedAt: instructor.createdAt,
      totalCourses: courses.length,
      publishedCourses: courses.filter(c => c.isPublished).length,
      totalStudents: totalStudents.size,
      totalLessons,
      videosAssigned,
      videosPending: totalLessons - videosAssigned,
      avgWatchPercentage: Math.round(avgWatch),
      qualifiedViews,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    };
  }));

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
