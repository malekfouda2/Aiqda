import { getSubscriptionAccessContext } from '../subscriptions/subscriptions.service.js';

const TRACKABLE_MEMBER_ROLE = 'student';

export const getProgressTrackingContext = async (userId, userRole = null, courseId = null) => {
  if (!userId || userRole !== TRACKABLE_MEMBER_ROLE) {
    return {
      shouldTrack: false,
      reason: 'Only subscribed members generate watch analytics.',
      accessContext: null,
    };
  }

  const accessContext = await getSubscriptionAccessContext(userId, courseId);

  if (!accessContext.hasActiveSubscription) {
    return {
      shouldTrack: false,
      reason: 'Only subscribed members generate watch analytics.',
      accessContext,
    };
  }

  if (courseId && !accessContext.hasCourseAccess) {
    return {
      shouldTrack: false,
      reason: 'Only subscribed members assigned to this chapter generate watch analytics.',
      accessContext,
    };
  }

  return {
    shouldTrack: true,
    reason: null,
    accessContext,
  };
};

export const buildUntrackedLessonProgress = ({
  userId,
  lessonId,
  courseId,
  quizPassed = false,
  quizScore = 0,
  quizAttempts = 0,
  reason = 'Watch analytics are disabled for this viewer.',
}) => ({
  user: userId,
  lesson: lessonId,
  course: courseId,
  watchPercentage: 0,
  quizPassed,
  quizScore,
  quizAttempts,
  isQualified: false,
  completedAt: null,
  lastWatchedAt: null,
  trackingDisabled: true,
  trackingDisabledReason: reason,
});
