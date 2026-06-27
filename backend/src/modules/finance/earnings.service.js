import Payment from '../payments/payment.model.js';
import Course from '../courses/course.model.js';
import Lesson from '../lessons/lesson.model.js';
import { Subscription } from '../subscriptions/subscription.model.js';
import { resolveAccessiblePackageIds } from '../subscriptions/subscriptions.service.js';
import FinanceTransaction from './financeTransaction.model.js';
import ChapterEntitlement from './chapterEntitlement.model.js';
import InstructorEarning from './instructorEarning.model.js';
import { resolveAllocationsForPackageAt } from './allocation.service.js';
import {
  toMinor, applyBps, splitByWeights, INSTRUCTOR_POOL_BPS, COMPLETION_THRESHOLD_BPS,
} from './finance.money.js';
import { recordFinanceAudit } from './audit.service.js';

const SUCCESS_STATUSES = ['approved', 'captured'];

const mapTransactionType = (paymentType) => {
  if (paymentType === 'renewal' || paymentType === 'recovery') return 'renewal';
  return 'initial';
};

// Best-effort gateway fee from the stored Tap snapshot. Tap does not reliably expose a
// per-charge fee, so this returns 0 (estimated=false) when nothing is found. The pool is
// never reduced by this value; it is informational only.
const extractGatewayFeeMinor = (payment) => {
  const snap = payment?.chargeSnapshot;
  const candidate = snap?.fee ?? snap?.response?.fee ?? snap?.fees ?? null;
  if (candidate == null) return { gatewayFeeMinor: 0, gatewayFeeEstimated: false };
  return { gatewayFeeMinor: toMinor(candidate), gatewayFeeEstimated: false };
};

const countRequiredLessons = async (courseId) => Lesson.countDocuments({ course: courseId, isPublished: true });

// Idempotently generate the instructor-earning ledger rows for a successful subscription payment.
// Safe to call multiple times (webhook/renewal retries): a unique FinanceTransaction per payment
// and a unique (financeTransaction, course, instructor) earning index prevent duplicates.
export const generateEarningsForPayment = async (paymentInput) => {
  const paymentId = paymentInput?._id || paymentInput;
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) return null;
  if (!payment.subscription) return null; // only subscription payments fund instructors
  if (!SUCCESS_STATUSES.includes(payment.status)) return null;

  const grossMinor = toMinor(payment.amount);
  if (grossMinor <= 0) return null; // skip free/zero-value payments

  // Idempotency: one root FinanceTransaction per payment.
  const existing = await FinanceTransaction.findOne({ payment: payment._id, parentTransaction: null });
  if (existing) {
    return existing;
  }

  const subscription = await Subscription.findById(payment.subscription).lean();
  if (!subscription?.package) return null;

  const accessiblePackageIds = await resolveAccessiblePackageIds(subscription.package);

  // Union of accessible courses with their package-relative allocation bps at payment time.
  const paidAt = payment.createdAt || new Date();
  const seenCourses = new Set();
  const allocationRows = [];
  for (const packageId of accessiblePackageIds) {
    const rows = await resolveAllocationsForPackageAt(packageId, paidAt);
    for (const row of rows) {
      if (seenCourses.has(row.course)) continue;
      seenCourses.add(row.course);
      allocationRows.push({ ...row, subscriptionPackage: packageId });
    }
  }

  let transaction;
  try {
    transaction = await FinanceTransaction.create({
      payment: payment._id,
      user: payment.user,
      subscription: payment.subscription,
      subscriptionPackage: subscription.package,
      type: mapTransactionType(payment.paymentType),
      grossPaidMinor: grossMinor,
      discountMinor: 0,
      ...extractGatewayFeeMinor(payment),
      currency: payment.currency || 'SAR',
      status: 'recorded',
      paidAt,
      entitlementStart: subscription.startDate || null,
      entitlementEnd: subscription.endDate || null,
      tapChargeId: payment.tapChargeId || null,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return FinanceTransaction.findOne({ payment: payment._id, parentTransaction: null });
    }
    throw error;
  }

  const poolMinor = applyBps(grossMinor, INSTRUCTOR_POOL_BPS);
  const weights = allocationRows.map((row) => row.allocationBps);
  const shares = splitByWeights(poolMinor, weights);

  for (let i = 0; i < allocationRows.length; i += 1) {
    const row = allocationRows[i];
    const maxPotentialMinor = shares[i];
    if (!row.instructor || row.allocationBps <= 0 || maxPotentialMinor <= 0) {
      continue;
    }

    const course = await Course.findById(row.course).select('title instructor').lean();
    if (!course) continue;
    const instructor = row.instructor || course.instructor;
    if (!instructor) continue;

    const requiredLessonCount = await countRequiredLessons(row.course);

    let entitlement;
    try {
      entitlement = await ChapterEntitlement.create({
        user: payment.user,
        financeTransaction: transaction._id,
        subscriptionPackage: row.subscriptionPackage,
        course: row.course,
        courseTitleSnapshot: course.title || '',
        instructor,
        allocationBpsSnapshot: row.allocationBps,
        requiredLessonCountSnapshot: requiredLessonCount,
        completionThresholdBpsSnapshot: COMPLETION_THRESHOLD_BPS,
        entitlementStart: subscription.startDate || null,
        entitlementEnd: subscription.endDate || null,
      });
    } catch (error) {
      if (error?.code === 11000) continue; // already created (retry)
      throw error;
    }

    try {
      await InstructorEarning.create({
        user: payment.user,
        instructor,
        course: row.course,
        financeTransaction: transaction._id,
        chapterEntitlement: entitlement._id,
        grossBasisMinor: grossMinor,
        poolCapBpsSnapshot: INSTRUCTOR_POOL_BPS,
        allocationBpsSnapshot: row.allocationBps,
        maxPotentialMinor,
        status: 'pending_completion',
      });
    } catch (error) {
      if (error?.code !== 11000) throw error; // duplicate earning on retry → ignore
    }
  }

  await recordFinanceAudit({
    actorType: 'system',
    action: 'earnings.generated',
    targetType: 'FinanceTransaction',
    targetId: transaction._id,
    newState: { poolMinor, courses: allocationRows.length },
    relatedRef: payment._id?.toString(),
  });

  return transaction;
};
