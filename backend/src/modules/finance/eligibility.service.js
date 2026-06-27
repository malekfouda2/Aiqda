import Lesson from '../lessons/lesson.model.js';
import { LessonProgress } from '../analytics/progress.model.js';
import InstructorEarning from './instructorEarning.model.js';
import ChapterEntitlement from './chapterEntitlement.model.js';
import { FULL_BPS, COMPLETION_THRESHOLD_BPS } from './finance.money.js';
import { recordFinanceAudit } from './audit.service.js';

// Recompute chapter completion for (user, course) and flip any pending earnings to `eligible`
// once the learner reaches the completion threshold. Idempotent: earnings already past
// pending_completion are untouched, so repeated completion events never duplicate earnings.
export const evaluateEligibilityForUserCourse = async (userId, courseId) => {
  const pending = await InstructorEarning.find({
    user: userId,
    course: courseId,
    status: 'pending_completion',
  });
  if (pending.length === 0) {
    return { evaluated: 0 };
  }

  const publishedLessons = await Lesson.find({ course: courseId, isPublished: true }).select('_id').lean();
  const totalRequired = publishedLessons.length;
  if (totalRequired === 0) {
    return { evaluated: 0 };
  }

  const completedRequired = await LessonProgress.countDocuments({
    user: userId,
    course: courseId,
    isQualified: true,
    lesson: { $in: publishedLessons.map((l) => l._id) },
  });

  const completionBps = Math.floor((completedRequired / totalRequired) * FULL_BPS);

  let flipped = 0;
  for (const earning of pending) {
    const threshold = await ChapterEntitlement.findById(earning.chapterEntitlement)
      .select('completionThresholdBpsSnapshot')
      .lean();
    const thresholdBps = threshold?.completionThresholdBpsSnapshot || COMPLETION_THRESHOLD_BPS;

    earning.completedRequired = completedRequired;
    earning.totalRequired = totalRequired;

    if (completionBps >= thresholdBps) {
      earning.status = 'eligible';
      earning.eligibleMinor = earning.maxPotentialMinor;
      earning.completionBpsAtEligibility = completionBps;
      earning.eligibilityAt = new Date();
      flipped += 1;
      await earning.save();
      await recordFinanceAudit({
        actorType: 'system',
        action: 'earning.eligible',
        targetType: 'InstructorEarning',
        targetId: earning._id,
        oldState: { status: 'pending_completion' },
        newState: { status: 'eligible', completionBps, eligibleMinor: earning.eligibleMinor },
      });
    } else {
      // Keep progress fields fresh while still pending.
      await earning.save();
    }
  }

  return { evaluated: pending.length, flipped, completionBps };
};
