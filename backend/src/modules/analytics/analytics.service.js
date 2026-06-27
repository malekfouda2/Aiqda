import { LessonProgress, CourseProgress } from './progress.model.js';
import Course from '../courses/course.model.js';
import Lesson from '../lessons/lesson.model.js';
import User from '../users/user.model.js';
import Payment from '../payments/payment.model.js';
import { Subscription, SubscriptionPackage } from '../subscriptions/subscription.model.js';
import { getSubscriptionAccessContext } from '../subscriptions/subscriptions.service.js';
import { getVimeoAccountInfo, getVimeoVideoDetails } from '../video/video.service.js';

const roundCurrency = (value) => Math.round(value * 100) / 100;
const toIdString = (value) => value?.toString();
const getNetPaymentAmount = (payment = {}) => {
  const grossAmount = Number(payment.amount || 0);
  const refundedAmount = payment.refundStatus === 'refunded'
    ? Number(payment.refundAmount || 0)
    : 0;

  return Math.max(0, grossAmount - refundedAmount);
};
const LIVE_ACTIVITY_WINDOW_MS = 2 * 60 * 1000;
const LIVE_ACTIVITY_WINDOW_MINUTES = LIVE_ACTIVITY_WINDOW_MS / (60 * 1000);
const MEMBER_REWARD_ACTIVITY_WINDOW_DAYS = 14;
const MEMBER_REWARD_ACTIVITY_WINDOW_MS = MEMBER_REWARD_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const MEMBER_LEADERBOARD_LIMIT = 5;
const VIMEO_ENTERPRISE_ONLY_ANALYTICS_METRICS = [
  'impressions',
  'finishes',
  'downloads',
  'unique_viewers',
  'unique_impressions',
  'average_percent_watched',
  'average_time_watched',
  'total_time_watched',
];
const VIMEO_DASHBOARD_ONLY_ENGAGEMENT_METRICS = [
  'viewer_retention',
  'views_at_1_percent',
  'views_at_25_percent',
  'views_at_50_percent',
  'views_at_75_percent',
  'views_at_100_percent',
];
const MEMBER_REWARD_LEVELS = [
  { level: 1, minPoints: 0, title: 'Explorer' },
  { level: 2, minPoints: 250, title: 'Momentum Builder' },
  { level: 3, minPoints: 600, title: 'Skill Climber' },
  { level: 4, minPoints: 1050, title: 'Chapter Challenger' },
  { level: 5, minPoints: 1650, title: 'Creative Force' },
  { level: 6, minPoints: 2400, title: 'Aiqda Trailblazer' },
];
const MEMBER_QUALIFIED_CONTENT_MILESTONES = [1, 3, 5, 8, 12, 16];
const MEMBER_COMPLETED_CHAPTER_MILESTONES = [1, 2, 3, 5, 8];

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

const isRecentlyActive = (dateValue, windowMs = LIVE_ACTIVITY_WINDOW_MS) => {
  if (!dateValue) {
    return false;
  }

  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= windowMs;
};

const toPercentage = (value, total) => (
  total > 0 ? Math.round((value / total) * 100) : 0
);

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

const getMostRecentDate = (...dateValues) => {
  const timestamps = dateValues
    .flat()
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps));
};

const getRewardLevel = (points = 0) => {
  const currentLevel = [...MEMBER_REWARD_LEVELS]
    .reverse()
    .find((level) => points >= level.minPoints) || MEMBER_REWARD_LEVELS[0];
  const nextLevel = MEMBER_REWARD_LEVELS.find((level) => level.level === currentLevel.level + 1) || null;

  if (!nextLevel) {
    return {
      ...currentLevel,
      nextLevel: null,
      pointsToNextLevel: 0,
      progressPercentage: 100,
    };
  }

  const progressWithinLevel = points - currentLevel.minPoints;
  const pointsRequiredWithinLevel = nextLevel.minPoints - currentLevel.minPoints;

  return {
    ...currentLevel,
    nextLevel,
    pointsToNextLevel: Math.max(nextLevel.minPoints - points, 0),
    progressPercentage: pointsRequiredWithinLevel > 0
      ? Math.min(100, Math.round((progressWithinLevel / pointsRequiredWithinLevel) * 100))
      : 100,
  };
};

const getNextMilestoneTarget = (thresholds = [], currentValue = 0) => {
  return thresholds.find((threshold) => currentValue < threshold) || currentValue;
};

const buildMemberRewardBadges = (summary) => {
  const badgeDefinitions = [
    {
      id: 'first-step',
      icon: 'Spark',
      title: 'First Step',
      description: 'Start your first content item.',
      unlocked: summary.startedContentCount >= 1,
    },
    {
      id: 'qualified-trio',
      icon: 'Focus',
      title: 'Qualified Trio',
      description: 'Qualify 3 content items.',
      unlocked: summary.qualifiedContentCount >= 3,
    },
    {
      id: 'chapter-finisher',
      icon: 'Flag',
      title: 'Chapter Finisher',
      description: 'Complete your first chapter.',
      unlocked: summary.completedChapterCount >= 1,
    },
    {
      id: 'momentum-mode',
      icon: 'Bolt',
      title: 'Momentum Mode',
      description: 'Stay active across 3 content items in the last 14 days.',
      unlocked: summary.recentlyActiveCount >= 3,
    },
    {
      id: 'watch-master',
      icon: 'Target',
      title: 'Watch Master',
      description: 'Maintain an 85% average watch rate.',
      unlocked: summary.avgWatchPercentage >= 85 && summary.startedContentCount >= 3,
    },
    {
      id: 'pathfinder',
      icon: 'Compass',
      title: 'Pathfinder',
      description: 'Be enrolled across 3 chapters.',
      unlocked: summary.enrolledChapterCount >= 3,
    },
  ];

  return badgeDefinitions.map((badge) => ({
    ...badge,
    unlockedAt: badge.unlocked ? summary.lastActivityAt : null,
  }));
};

const buildMemberRewardSummary = ({
  hasActiveSubscription = false,
  courseProgressEntries = [],
  lessonProgressEntries = [],
} = {}) => {
  const enrolledChapterCount = courseProgressEntries.length;
  const startedContentEntries = lessonProgressEntries.filter((entry) => Number(entry.watchPercentage || 0) > 0 || Number(entry.quizAttempts || 0) > 0);
  const qualifiedContentEntries = lessonProgressEntries.filter((entry) => entry.isQualified);
  const completedChapterEntries = courseProgressEntries.filter((entry) => entry.isCompleted);
  const avgWatchPercentage = startedContentEntries.length > 0
    ? Math.round(
        startedContentEntries.reduce((sum, entry) => sum + Number(entry.watchPercentage || 0), 0) / startedContentEntries.length
      )
    : 0;
  const recentlyActiveCount = lessonProgressEntries.filter((entry) => (
    isRecentlyActive(entry.lastWatchedAt || entry.updatedAt || entry.completedAt, MEMBER_REWARD_ACTIVITY_WINDOW_MS)
  )).length;
  const engagementBonus = Math.min(recentlyActiveCount, 5) * 20;
  const points = (
    startedContentEntries.length * 30
    + qualifiedContentEntries.length * 70
    + completedChapterEntries.length * 250
    + engagementBonus
  );
  const level = getRewardLevel(points);
  const qualifiedTarget = getNextMilestoneTarget(MEMBER_QUALIFIED_CONTENT_MILESTONES, qualifiedContentEntries.length);
  const chapterTarget = getNextMilestoneTarget(MEMBER_COMPLETED_CHAPTER_MILESTONES, completedChapterEntries.length);
  const lastActivityAt = getMostRecentDate(
    courseProgressEntries.map((entry) => entry.completedAt || entry.updatedAt || entry.startedAt),
    lessonProgressEntries.map((entry) => entry.lastWatchedAt || entry.updatedAt || entry.completedAt)
  );

  const isEligible = Boolean(hasActiveSubscription && enrolledChapterCount > 0);
  let reason = null;
  if (!hasActiveSubscription) {
    reason = 'Activate your subscription to unlock rankings, badges, and member rewards.';
  } else if (enrolledChapterCount === 0) {
    reason = 'Enroll in at least one chapter to start earning points and climbing the leaderboard.';
  }

  const summary = {
    isEligible,
    reason,
    points,
    level,
    enrolledChapterCount,
    startedContentCount: startedContentEntries.length,
    qualifiedContentCount: qualifiedContentEntries.length,
    completedChapterCount: completedChapterEntries.length,
    avgWatchPercentage,
    recentlyActiveCount,
    engagementBonus,
    activeWindowDays: MEMBER_REWARD_ACTIVITY_WINDOW_DAYS,
    lastActivityAt,
    milestones: [
      {
        id: 'next-level',
        title: level.nextLevel ? `Reach ${level.nextLevel.title}` : 'Top level reached',
        current: points,
        target: level.nextLevel?.minPoints || points,
        progressPercentage: level.progressPercentage,
        reward: level.nextLevel ? `${level.pointsToNextLevel} pts to go` : 'You are at the top tier',
      },
      {
        id: 'qualified-content',
        title: 'Qualify more content',
        current: qualifiedContentEntries.length,
        target: qualifiedTarget,
        progressPercentage: qualifiedTarget > 0
          ? Math.min(100, Math.round((qualifiedContentEntries.length / qualifiedTarget) * 100))
          : 100,
        reward: qualifiedTarget > qualifiedContentEntries.length
          ? `${qualifiedTarget - qualifiedContentEntries.length} more to unlock your next content milestone`
          : 'Next content milestone reached',
      },
      {
        id: 'completed-chapters',
        title: 'Complete more chapters',
        current: completedChapterEntries.length,
        target: chapterTarget,
        progressPercentage: chapterTarget > 0
          ? Math.min(100, Math.round((completedChapterEntries.length / chapterTarget) * 100))
          : 100,
        reward: chapterTarget > completedChapterEntries.length
          ? `${chapterTarget - completedChapterEntries.length} more to unlock your next chapter milestone`
          : 'Next chapter milestone reached',
      },
    ],
  };

  return {
    ...summary,
    badges: buildMemberRewardBadges(summary),
  };
};

const buildMemberRewardsLeaderboard = async () => {
  const activeSubscriptions = await Subscription.find({
    status: 'active',
    endDate: { $gte: new Date() },
  })
    .select('user')
    .lean();

  const activeUserIds = [...new Set(
    activeSubscriptions
      .map((subscription) => toIdString(subscription.user))
      .filter(Boolean)
  )];

  if (activeUserIds.length === 0) {
    return {
      leaderboard: [],
      leaderboardByUserId: new Map(),
      totalEligibleMembers: 0,
    };
  }

  const [users, courseProgressEntries, lessonProgressEntries] = await Promise.all([
    User.find({ _id: { $in: activeUserIds }, role: 'student', isActive: true })
      .select('name avatar')
      .lean(),
    CourseProgress.find({ user: { $in: activeUserIds } })
      .select('user completedLessons totalLessons progressPercentage isCompleted startedAt completedAt updatedAt')
      .lean(),
    LessonProgress.find({ user: { $in: activeUserIds } })
      .select('user watchPercentage quizAttempts isQualified quizPassed completedAt lastWatchedAt updatedAt')
      .lean(),
  ]);

  const courseProgressByUserId = new Map();
  const lessonProgressByUserId = new Map();

  for (const entry of courseProgressEntries) {
    const userId = toIdString(entry.user);
    const currentEntries = courseProgressByUserId.get(userId) || [];
    currentEntries.push(entry);
    courseProgressByUserId.set(userId, currentEntries);
  }

  for (const entry of lessonProgressEntries) {
    const userId = toIdString(entry.user);
    const currentEntries = lessonProgressByUserId.get(userId) || [];
    currentEntries.push(entry);
    lessonProgressByUserId.set(userId, currentEntries);
  }

  const rankedMembers = users
    .map((user) => {
      const userId = toIdString(user._id);
      const rewards = buildMemberRewardSummary({
        hasActiveSubscription: true,
        courseProgressEntries: courseProgressByUserId.get(userId) || [],
        lessonProgressEntries: lessonProgressByUserId.get(userId) || [],
      });

      if (!rewards.isEligible) {
        return null;
      }

      return {
        userId,
        name: user.name,
        avatar: user.avatar || null,
        points: rewards.points,
        level: rewards.level,
        completedChapterCount: rewards.completedChapterCount,
        qualifiedContentCount: rewards.qualifiedContentCount,
        avgWatchPercentage: rewards.avgWatchPercentage,
        lastActivityAt: rewards.lastActivityAt,
      };
    })
    .filter(Boolean)
    .sort((left, right) => (
      right.points - left.points
      || right.completedChapterCount - left.completedChapterCount
      || right.qualifiedContentCount - left.qualifiedContentCount
      || right.avgWatchPercentage - left.avgWatchPercentage
      || new Date(right.lastActivityAt || 0).getTime() - new Date(left.lastActivityAt || 0).getTime()
    ))
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));

  const leaderboardByUserId = new Map(
    rankedMembers.map((entry) => [entry.userId, entry])
  );

  return {
    leaderboard: rankedMembers.slice(0, MEMBER_LEADERBOARD_LIMIT),
    leaderboardByUserId,
    totalEligibleMembers: rankedMembers.length,
  };
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
    status: { $in: ['approved', 'captured'] }
  })
    .select('subscription amount refundStatus refundAmount')
    .lean();

  for (const payment of payments) {
    const packageId = subscriptionPackageMap.get(payment.subscription.toString());
    const packageCourses = packageCourseMap.get(packageId) || [];
    const packageCourseCount = packageCourses.length || 1;
    const revenueShare = getNetPaymentAmount(payment) / packageCourseCount;

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
      .select('course title vimeoVideoId order supportingFile supportingFileName minimumWatchPercentage isPublished reviewStatus')
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
    .select('name email avatar createdAt isActive assignedPackages')
    .populate('assignedPackages', 'name nameAr isActive')
    .lean();

  const instructorIds = instructors.map((instructor) => instructor._id);
  const courses = instructorIds.length > 0
    ? await Course.find({ instructor: { $in: instructorIds } })
      .select('instructor title category level isPublished reviewStatus enrolledStudents lessonsCount createdAt')
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
  const [accessContext, courseProgress, recentLessonProgress, allLessonProgress, leaderboardSnapshot] = await Promise.all([
    getSubscriptionAccessContext(userId),
    CourseProgress.find({ user: userId })
      .populate('course', 'title thumbnail')
      .sort({ updatedAt: -1 }),
    LessonProgress.find({ user: userId })
      .populate('lesson', 'title isPublished')
      .populate('course', 'title isPublished enrolledStudents')
      .sort({ lastWatchedAt: -1 })
      .limit(25),
    LessonProgress.find({ user: userId })
      .select('watchPercentage quizAttempts isQualified quizPassed completedAt lastWatchedAt updatedAt')
      .lean(),
    buildMemberRewardsLeaderboard(),
  ]);

  const accessibleCourseIds = new Set(
    (accessContext?.accessibleCourseIds || []).map((courseId) => courseId.toString())
  );
  const lessonProgress = recentLessonProgress.filter((entry) => {
    const lessonId = entry?.lesson?._id?.toString?.();
    const courseId = entry?.course?._id?.toString?.();
    const isEnrolledInCourse = (entry?.course?.enrolledStudents || []).some(
      (studentId) => studentId.toString() === userId.toString()
    );

    if (!lessonId || !courseId) {
      return false;
    }

    if (!accessContext?.hasActiveSubscription) {
      return false;
    }

    return Boolean(
      entry.lesson?.isPublished
      && entry.course?.isPublished
      && isEnrolledInCourse
      && accessibleCourseIds.has(courseId)
    );
  }).slice(0, 10);

  const stats = {
    totalCourses: courseProgress.length,
    completedCourses: courseProgress.filter(cp => cp.isCompleted).length,
    totalLessonsCompleted: courseProgress.reduce((acc, cp) => acc + cp.completedLessons, 0),
    overallProgress: courseProgress.length > 0 
      ? courseProgress.reduce((acc, cp) => acc + cp.progressPercentage, 0) / courseProgress.length 
      : 0
  };

  const rewards = buildMemberRewardSummary({
    hasActiveSubscription: Boolean(accessContext?.hasActiveSubscription),
    courseProgressEntries: courseProgress.map((entry) => entry.toObject()),
    lessonProgressEntries: allLessonProgress,
  });

  const currentMemberStanding = leaderboardSnapshot.leaderboardByUserId.get(userId.toString()) || null;

  return {
    courseProgress,
    recentActivity: lessonProgress,
    stats,
    rewards: {
      ...rewards,
      rank: rewards.isEligible && currentMemberStanding
        ? {
            position: currentMemberStanding.position,
            totalEligibleMembers: leaderboardSnapshot.totalEligibleMembers,
          }
        : null,
      leaderboard: leaderboardSnapshot.leaderboard.map((entry) => ({
        position: entry.position,
        userId: entry.userId,
        name: entry.name,
        avatar: entry.avatar,
        points: entry.points,
        level: {
          level: entry.level.level,
          title: entry.level.title,
        },
        completedChapterCount: entry.completedChapterCount,
        qualifiedContentCount: entry.qualifiedContentCount,
        avgWatchPercentage: entry.avgWatchPercentage,
        isCurrentUser: entry.userId === userId.toString(),
      })),
      featuredMessage: rewards.isEligible
        ? (
            rewards.level.nextLevel
              ? `You are ${rewards.level.pointsToNextLevel} points away from ${rewards.level.nextLevel.title}.`
              : 'You have reached the top member level. Keep leading the way.'
          )
        : rewards.reason,
    },
  };
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
  const [courses, instructor] = await Promise.all([
    Course.find({ instructor: instructorId })
      .select('title enrolledStudents isPublished reviewStatus')
      .lean(),
    User.findById(instructorId)
      .select('assignedPackages')
      .populate('assignedPackages', 'name nameAr isActive')
      .lean(),
  ]);
  const { courseMetricsById, lessonProgress } = await buildCourseAnalyticsSnapshot(courses);

  const courseStats = courses.map((course) => {
    const courseMetrics = getCourseMetrics(courseMetricsById, course._id);

    return {
      courseId: course._id,
      title: course.title,
      isPublished: Boolean(course.isPublished),
      reviewStatus: course.reviewStatus || 'draft',
      enrolledCount: course.enrolledStudents?.length || 0,
      lessonsCount: courseMetrics.lessonsCount,
      videosAssigned: courseMetrics.videosAssigned,
      videosPending: courseMetrics.videosPending,
      avgWatchPercentage: courseMetrics.avgWatchPercentage,
      qualifiedViews: courseMetrics.qualifiedViews,
      quizPassRate: courseMetrics.progressCount > 0
        ? Math.round((courseMetrics.quizPassCount / courseMetrics.progressCount) * 100)
        : 0,
      estimatedRevenue: courseMetrics.estimatedRevenue,
    };
  });

  const totalRevenue = roundCurrency(
    courseStats.reduce((sum, course) => sum + course.estimatedRevenue, 0)
  );
  const totalQualifiedViews = courseStats.reduce((sum, course) => sum + course.qualifiedViews, 0);
  const totalLessons = courseStats.reduce((sum, course) => sum + course.lessonsCount, 0);
  const videosAssigned = courseStats.reduce((sum, course) => sum + course.videosAssigned, 0);
  const videosPending = courseStats.reduce((sum, course) => sum + course.videosPending, 0);
  const publishedCourses = courseStats.filter((course) => course.isPublished).length;
  const draftCourses = Math.max(courseStats.length - publishedCourses, 0);
  const totalProgressEntries = [...courseMetricsById.values()]
    .reduce((sum, courseMetrics) => sum + courseMetrics.progressCount, 0);
  const totalWatchPercentage = [...courseMetricsById.values()]
    .reduce((sum, courseMetrics) => sum + courseMetrics.watchPercentageSum, 0);
  const totalQuizPassCount = [...courseMetricsById.values()]
    .reduce((sum, courseMetrics) => sum + courseMetrics.quizPassCount, 0);
  const monthlyStats = buildMonthlyCounts(
    lessonProgress.filter((progressEntry) => progressEntry.isQualified),
    'completedAt'
  );

  return {
    assignedPackages: instructor?.assignedPackages || [],
    totalCourses: courses.length,
    publishedCourses,
    draftCourses,
    totalLessons,
    totalStudents: countUniqueStudents(courses),
    totalQualifiedViews,
    avgWatchPercentage: totalProgressEntries > 0
      ? Math.round(totalWatchPercentage / totalProgressEntries)
      : 0,
    videosAssigned,
    videosPending,
    quizPassRate: totalProgressEntries > 0
      ? Math.round((totalQuizPassCount / totalProgressEntries) * 100)
      : 0,
    totalRevenue,
    monthlyStats,
    courseStats,
    revenueCalculation: {
      placeholder: false,
      methodology: 'Successful subscription payments are allocated evenly across all courses included in each package.'
    }
  };
};

export const getAdminAnalytics = async () => {
  const activeSince = new Date(Date.now() - LIVE_ACTIVITY_WINDOW_MS);
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    totalCourses,
    publishedCourses,
    totalLessons,
    courseProgress,
    qualifiedLessons,
    recentActivity,
    lessonProgress,
    totalMembers,
    newMembers30d,
    activeSubscriptions,
    totalInstructors
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
      .limit(20),
    LessonProgress.find()
      .select('user lesson watchPercentage lastWatchedAt')
      .lean(),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'student', createdAt: { $gte: last30Days } }),
    Subscription.countDocuments({ status: { $in: ['active', 'cancel_scheduled', 'grace_period'] } }),
    User.countDocuments({ role: 'instructor' })
  ]);
  const totalEnrollments = courseProgress.length;
  const completedCourses = courseProgress.filter((progressEntry) => progressEntry.isCompleted).length;
  const activeProgressEntries = lessonProgress.filter((progressEntry) => isRecentlyActive(progressEntry.lastWatchedAt));
  const activeStudentsNow = new Set(activeProgressEntries.map((progressEntry) => toIdString(progressEntry.user))).size;
  const activeLessonsNow = new Set(activeProgressEntries.map((progressEntry) => toIdString(progressEntry.lesson))).size;
  const averageWatchPercentage = lessonProgress.length > 0
    ? Math.round(lessonProgress.reduce((sum, progressEntry) => sum + Number(progressEntry.watchPercentage || 0), 0) / lessonProgress.length)
    : 0;

  return {
    overview: {
      totalCourses,
      publishedCourses,
      totalLessons,
      totalEnrollments,
      completedCourses,
      qualifiedLessons,
      averageWatchPercentage,
      activeStudentsNow,
      activeLessonsNow,
      activeWindowMinutes: LIVE_ACTIVITY_WINDOW_MINUTES,
      totalMembers,
      newMembers30d,
      activeSubscriptions,
      totalInstructors,
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
        reviewStatus: course.reviewStatus || 'draft',
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
          minimumWatchPercentage: lesson.minimumWatchPercentage,
          hasVideo: !!lesson.vimeoVideoId,
          vimeoVideoId: lesson.vimeoVideoId,
          isPublished: Boolean(lesson.isPublished),
          reviewStatus: lesson.reviewStatus || 'draft',
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
    .select('name email avatar role createdAt isActive assignedPackages')
    .populate('assignedPackages', 'name nameAr isActive')
    .lean();
  if (!instructor || instructor.role !== 'instructor') {
    throw new Error('Instructor not found');
  }

  const courses = await Course.find({ instructor: instructorId })
    .select('title category level isPublished reviewStatus enrolledStudents lessonsCount createdAt')
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
      reviewStatus: course.reviewStatus || 'draft',
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
        isPublished: Boolean(lesson.isPublished),
        reviewStatus: lesson.reviewStatus || 'draft',
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
      assignedPackages: instructor.assignedPackages || [],
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
  const lesson = await Lesson.findById(lessonId)
    .populate('course', 'title enrolledStudents')
    .lean();

  if (!lesson) {
    throw new Error('Lesson not found');
  }

  const progress = await LessonProgress.find({ lesson: lessonId })
    .populate('user', 'name email avatar')
    .sort({ lastWatchedAt: -1, updatedAt: -1 })
    .lean();

  const totalEnrolledStudents = lesson.course?.enrolledStudents?.length || 0;
  const activeStudentsNow = progress.filter((progressEntry) => isRecentlyActive(progressEntry.lastWatchedAt)).length;
  const watchRequirementMetCount = progress.filter(
    (progressEntry) => Number(progressEntry.watchPercentage || 0) >= Number(lesson.minimumWatchPercentage || 0)
  ).length;
  const qualifiedCount = progress.filter((progressEntry) => progressEntry.isQualified).length;
  const quizPassCount = progress.filter((progressEntry) => progressEntry.quizPassed).length;
  const completedCount = progress.filter((progressEntry) => Boolean(progressEntry.completedAt)).length;
  const averageWatchPercentage = progress.length > 0
    ? Math.round(progress.reduce((sum, progressEntry) => sum + Number(progressEntry.watchPercentage || 0), 0) / progress.length)
    : 0;

  let vimeo = {
    available: false,
    accountType: null,
    advancedAnalyticsAvailable: false,
    dashboardAnalyticsAvailable: false,
    unsupportedAdvancedMetrics: VIMEO_ENTERPRISE_ONLY_ANALYTICS_METRICS,
    dashboardOnlyMetrics: VIMEO_DASHBOARD_ONLY_ENGAGEMENT_METRICS,
    note: 'No Vimeo video is currently assigned to this lesson.',
  };

  if (lesson.vimeoVideoId) {
    try {
      const [accountInfo, videoDetails] = await Promise.all([
        getVimeoAccountInfo(),
        getVimeoVideoDetails(lesson.vimeoVideoId),
      ]);

      const accountType = accountInfo?.type || null;
      const accountCapabilities = accountInfo?.capabilities || {};
      const advancedAnalyticsAvailable = Boolean(accountCapabilities.analyticsApiAccess);
      const dashboardAnalyticsAvailable = Boolean(accountCapabilities.supportsVideoPageAnalyticsDashboard);
      const unsupportedAdvancedMetrics = advancedAnalyticsAvailable
        ? []
        : (accountCapabilities.enterpriseAnalyticsRequiredMetrics || VIMEO_ENTERPRISE_ONLY_ANALYTICS_METRICS);

      vimeo = {
        available: true,
        accountType,
        capabilities: accountCapabilities,
        advancedAnalyticsAvailable,
        dashboardAnalyticsAvailable,
        unsupportedAdvancedMetrics,
        dashboardOnlyMetrics: VIMEO_DASHBOARD_ONLY_ENGAGEMENT_METRICS,
        note: advancedAnalyticsAvailable
          ? null
          : accountCapabilities.isPaidPlan
            ? 'This Vimeo paid plan unlocks advanced analytics inside the Vimeo dashboard, but Vimeo still restricts the Analytics API dataset that Aiqda can ingest. Enterprise-only API metrics such as impressions, unique viewers, and average percent watched are still not exposed programmatically here.'
            : 'This Vimeo account can expose only a limited API dataset. Advanced Vimeo analytics such as impressions, unique viewers, and average percent watched require Vimeo Enterprise Analytics API access.',
        video: {
          vimeoId: videoDetails.vimeoId,
          title: videoDetails.title,
          duration: videoDetails.duration,
          width: videoDetails.width,
          height: videoDetails.height,
          thumbnail: videoDetails.thumbnail,
          link: videoDetails.link,
          status: videoDetails.status,
          createdAt: videoDetails.createdAt,
          modifiedAt: videoDetails.modifiedAt,
          lastUserActionAt: videoDetails.lastUserActionAt,
          isPlayable: videoDetails.isPlayable,
          hasAudio: videoDetails.hasAudio,
        },
        metrics: videoDetails.metrics,
        delivery: videoDetails.delivery,
        privacy: videoDetails.privacy,
        security: videoDetails.security,
      };
    } catch (error) {
      vimeo = {
        available: false,
        accountType: null,
        capabilities: null,
        advancedAnalyticsAvailable: false,
        dashboardAnalyticsAvailable: false,
        unsupportedAdvancedMetrics: VIMEO_ENTERPRISE_ONLY_ANALYTICS_METRICS,
        dashboardOnlyMetrics: VIMEO_DASHBOARD_ONLY_ENGAGEMENT_METRICS,
        note: error.message,
      };
    }
  }

  const studentProgress = progress
    .map((progressEntry) => ({
      progressId: progressEntry._id,
      userId: progressEntry.user?._id || null,
      name: progressEntry.user?.name || 'Unknown student',
      email: progressEntry.user?.email || null,
      avatar: progressEntry.user?.avatar || null,
      watchPercentage: Number(progressEntry.watchPercentage || 0),
      hasMetWatchRequirement: Number(progressEntry.watchPercentage || 0) >= Number(lesson.minimumWatchPercentage || 0),
      quizPassed: Boolean(progressEntry.quizPassed),
      quizScore: Number(progressEntry.quizScore || 0),
      quizAttempts: Number(progressEntry.quizAttempts || 0),
      isQualified: Boolean(progressEntry.isQualified),
      completedAt: progressEntry.completedAt || null,
      lastWatchedAt: progressEntry.lastWatchedAt || null,
      updatedAt: progressEntry.updatedAt || null,
      isActiveNow: isRecentlyActive(progressEntry.lastWatchedAt),
    }))
    .sort((a, b) => {
      if (a.isActiveNow !== b.isActiveNow) {
        return a.isActiveNow ? -1 : 1;
      }

      const aLastWatchedAt = a.lastWatchedAt ? new Date(a.lastWatchedAt).getTime() : 0;
      const bLastWatchedAt = b.lastWatchedAt ? new Date(b.lastWatchedAt).getTime() : 0;

      if (aLastWatchedAt !== bLastWatchedAt) {
        return bLastWatchedAt - aLastWatchedAt;
      }

      if (a.watchPercentage !== b.watchPercentage) {
        return b.watchPercentage - a.watchPercentage;
      }

      return a.name.localeCompare(b.name);
    });

  return {
    refreshedAt: new Date().toISOString(),
    lesson: {
      _id: lesson._id,
      title: lesson.title,
      description: lesson.description,
      minimumWatchPercentage: lesson.minimumWatchPercentage,
      vimeoVideoId: lesson.vimeoVideoId,
      duration: lesson.duration,
      course: {
        _id: lesson.course?._id || null,
        title: lesson.course?.title || null,
      },
    },
    appAnalytics: {
      activeWindowMinutes: LIVE_ACTIVITY_WINDOW_MINUTES,
      totalEnrolledStudents,
      studentsWithActivity: progress.length,
      studentsNotStarted: Math.max(totalEnrolledStudents - progress.length, 0),
      activeStudentsNow,
      averageWatchPercentage,
      watchRequirementMetCount,
      watchRequirementMetRate: toPercentage(watchRequirementMetCount, totalEnrolledStudents),
      qualifiedCount,
      qualificationRate: toPercentage(qualifiedCount, totalEnrolledStudents),
      quizPassCount,
      quizPassRate: toPercentage(quizPassCount, totalEnrolledStudents),
      completedCount,
      completionRate: toPercentage(completedCount, totalEnrolledStudents),
    },
    studentProgress,
    vimeo,
  };
};
