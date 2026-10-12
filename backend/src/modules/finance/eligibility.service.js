import Course from '../courses/course.model.js';
import Lesson from '../lessons/lesson.model.js';
import { LessonProgress } from '../analytics/progress.model.js';
import InstructorEarning from './instructorEarning.model.js';
import ChapterEntitlement from './chapterEntitlement.model.js';
import { FULL_BPS, COMPLETION_THRESHOLD_BPS, INSTRUCTOR_POOL_BPS } from './finance.money.js';
import { recordFinanceAudit } from './audit.service.js';
import {
  WIN_STATUSES, findFundingTransaction, netPoolMinor, syncMemberShares,
} from './shares.service.js';

// Record the creator's win when a member completes the chapter's completion threshold.
// A creator wins at most once per member per chapter: renewals and rewatching never pay again.
// (A win cancelled by a refund or chargeback no longer counts, so a later payment can fund a new one.)
// Idempotent: repeated completion events never create a second earning.
export const evaluateEligibilityForUserCourse = async (userId, courseId) => {
  const alreadyWon = await InstructorEarning.exists({
    user: userId, course: courseId, status: { $in: WIN_STATUSES },
  });
  if (alreadyWon) {
    return { evaluated: 0, flipped: 0 };
  }

  const publishedLessons = await Lesson.find({ course: courseId, isPublished: true }).select('_id').lean();
  const totalRequired = publishedLessons.length;
  if (totalRequired === 0) {
    return { evaluated: 0, flipped: 0 };
  }

  const completedRequired = await LessonProgress.countDocuments({
    user: userId,
    course: courseId,
    isQualified: true,
    lesson: { $in: publishedLessons.map((l) => l._id) },
  });
  const completionBps = Math.floor((completedRequired / totalRequired) * FULL_BPS);
  if (completionBps < COMPLETION_THRESHOLD_BPS) {
    return { evaluated: 1, flipped: 0, completionBps };
  }

  const course = await Course.findById(courseId).select('title instructor').lean();
  if (!course?.instructor) {
    return { evaluated: 1, flipped: 0, completionBps };
  }

  const wonAt = new Date();
  // No payment behind the member's access (e.g. a complimentary subscription) means no money to share.
  const transaction = await findFundingTransaction(userId, wonAt);
  if (!transaction) {
    return { evaluated: 1, flipped: 0, completionBps, unfunded: true };
  }

  let earning;
  try {
    const entitlement = await ChapterEntitlement.findOneAndUpdate(
      { financeTransaction: transaction._id, course: courseId },
      {
        $setOnInsert: {
          user: userId,
          subscriptionPackage: transaction.subscriptionPackage,
          courseTitleSnapshot: course.title || '',
          instructor: course.instructor,
          requiredLessonCountSnapshot: totalRequired,
          completionThresholdBpsSnapshot: COMPLETION_THRESHOLD_BPS,
          entitlementStart: transaction.entitlementStart,
          entitlementEnd: transaction.entitlementEnd,
        },
      },
      { new: true, upsert: true },
    );
    earning = await InstructorEarning.create({
      user: userId,
      instructor: course.instructor,
      course: courseId,
      financeTransaction: transaction._id,
      chapterEntitlement: entitlement._id,
      grossBasisMinor: transaction.grossPaidMinor,
      poolCapBpsSnapshot: INSTRUCTOR_POOL_BPS,
      maxPotentialMinor: netPoolMinor(transaction),
      status: 'eligible',
      completionBpsAtEligibility: completionBps,
      completedRequired,
      totalRequired,
      eligibilityAt: wonAt,
    });
  } catch (error) {
    if (error?.code === 11000) return { evaluated: 1, flipped: 0, completionBps }; // concurrent completion event
    throw error;
  }

  // Works out this win's share and re-balances the member's other wins on the same payment.
  await syncMemberShares(userId);
  const saved = await InstructorEarning.findById(earning._id).select('eligibleMinor').lean();

  await recordFinanceAudit({
    actorType: 'system',
    action: 'earning.eligible',
    targetType: 'InstructorEarning',
    targetId: earning._id,
    newState: { status: 'eligible', completionBps, eligibleMinor: saved?.eligibleMinor || 0 },
    relatedRef: transaction.payment?.toString() || '',
  });

  return { evaluated: 1, flipped: 1, completionBps };
};
