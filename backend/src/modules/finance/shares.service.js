import Course from '../courses/course.model.js';
import { CourseProgress } from '../analytics/progress.model.js';
import FinanceTransaction from './financeTransaction.model.js';
import InstructorEarning from './instructorEarning.model.js';
import { applyBps, INSTRUCTOR_POOL_BPS, FULL_BPS } from './finance.money.js';
import { periodOf, periodBounds, hasPeriodEnded } from './finance.period.js';

// How a creator's money is worked out
// -----------------------------------
// A creator wins once per member per chapter, when the member completes 80% of it. The money
// comes from the member's latest subscription payment at that moment: 30% of what the member
// actually paid (net of refunds and chargebacks) is the creator pool for that payment.
// The pool is split equally over the chapters the member was enrolled in by the end of the
// month of the win, so the amount is only final once that month has ended. The wins charged
// to one payment can never add up to more than its pool.

// A win that still counts. Cancelled wins (refund / chargeback) are `voided` or `reversed`.
export const WIN_STATUSES = ['eligible', 'on_hold', 'approved_for_payout', 'partially_paid', 'paid'];
// Wins whose amount still follows the calculation. Once approved for payout the amount is frozen.
const ADJUSTABLE_STATUSES = ['eligible', 'on_hold'];

const toId = (value) => (value?._id || value)?.toString();

export const netPoolMinor = (transaction) => applyBps(
  Math.max(0, (transaction?.grossPaidMinor || 0) - (transaction?.refundedMinor || 0) - (transaction?.chargebackMinor || 0)),
  INSTRUCTOR_POOL_BPS,
);

// The member's latest paid subscription transaction at `at` that still holds money.
export const findFundingTransaction = async (userId, at = new Date()) => {
  const candidates = await FinanceTransaction.find({
    user: userId,
    parentTransaction: null,
    grossPaidMinor: { $gt: 0 },
    paidAt: { $lte: at },
  }).sort({ paidAt: -1, _id: -1 }).limit(10);
  return candidates.find((transaction) => netPoolMinor(transaction) > 0) || null;
};

// When the member enrolled in each chapter they are currently enrolled in.
const loadEnrollments = async (userId) => {
  const courses = await Course.find({ enrolledStudents: userId }).select('_id').lean();
  const progress = await CourseProgress.find({ user: userId, course: { $in: courses.map((c) => c._id) } })
    .select('course startedAt')
    .lean();
  const startedByCourse = new Map(progress.map((entry) => [toId(entry.course), entry.startedAt]));
  // No enrolment record means the date is unknown: treat the chapter as always enrolled.
  return courses.map((course) => ({
    course: toId(course._id),
    at: startedByCourse.get(toId(course._id)) || new Date(0),
  }));
};

// Recalculate every still-adjustable win of one member. Safe to call any time and any number of
// times: it is a pure function of the member's payments, wins and enrolments.
export const syncMemberShares = async (userId) => {
  const wins = await InstructorEarning.find({
    user: userId,
    status: { $in: WIN_STATUSES },
    eligibilityAt: { $ne: null },
  }).sort({ eligibilityAt: 1, _id: 1 });
  if (wins.length === 0) return { updated: 0 };

  const enrollments = await loadEnrollments(userId);
  const transactions = await FinanceTransaction.find({
    _id: { $in: [...new Set(wins.map((win) => toId(win.financeTransaction)))] },
  }).lean();
  const transactionById = new Map(transactions.map((transaction) => [toId(transaction._id), transaction]));
  const remainingByTransaction = new Map();

  let updated = 0;
  for (const win of wins) {
    const transactionId = toId(win.financeTransaction);
    const poolMinor = netPoolMinor(transactionById.get(transactionId));
    if (!remainingByTransaction.has(transactionId)) remainingByTransaction.set(transactionId, poolMinor);
    const remainingMinor = remainingByTransaction.get(transactionId);

    if (!ADJUSTABLE_STATUSES.includes(win.status)) {
      remainingByTransaction.set(transactionId, Math.max(0, remainingMinor - (win.eligibleMinor || 0)));
      continue;
    }

    // Chapters the member was enrolled in by the end of the month of the win. Once that month
    // has ended the count is locked, so later deletions or enrolments never rewrite history.
    const period = periodOf(win.eligibilityAt);
    let enrolledCount = win.enrolledChaptersSnapshot;
    if (!win.shareBasisLocked) {
      const { end } = periodBounds(period);
      const enrolledCourses = new Set(
        enrollments.filter((enrollment) => enrollment.at < end).map((enrollment) => enrollment.course),
      );
      enrolledCourses.add(toId(win.course));
      enrolledCount = enrolledCourses.size;
    }
    const shareBasisLocked = win.shareBasisLocked || hasPeriodEnded(period);

    const shareMinor = Math.floor(poolMinor / enrolledCount);
    const amountMinor = Math.min(shareMinor, remainingMinor);
    remainingByTransaction.set(transactionId, remainingMinor - amountMinor);

    const next = {
      eligibleMinor: amountMinor,
      maxPotentialMinor: shareMinor,
      poolCapBpsSnapshot: INSTRUCTOR_POOL_BPS,
      allocationBpsSnapshot: Math.floor(FULL_BPS / enrolledCount),
      enrolledChaptersSnapshot: enrolledCount,
      shareBasisLocked,
    };
    if (Object.keys(next).some((key) => win[key] !== next[key])) {
      Object.assign(win, next);
      await win.save();
      updated += 1;
    }
  }
  return { updated };
};
