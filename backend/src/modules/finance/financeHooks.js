import { generateEarningsForPayment } from './earnings.service.js';
import { evaluateEligibilityForUserCourse } from './eligibility.service.js';
import { handlePaymentReversal } from './recovery.service.js';

// Safe wrappers: finance side-effects must never break the core payment / progress flow.
// Bindings are referenced lazily (inside the async body, not as init-time arguments) to avoid
// temporal-dead-zone errors under the payments <-> finance circular import.
const runSafe = async (label, fn) => {
  try {
    return await fn();
  } catch (error) {
    console.error(`Finance hook failed (${label}):`, error?.message || error);
    return null;
  }
};

export const onPaymentActivated = (paymentOrId) =>
  runSafe('generateEarnings', () => generateEarningsForPayment(paymentOrId));

export const onCourseProgressChanged = (userId, courseId) =>
  runSafe('evaluateEligibility', () => evaluateEligibilityForUserCourse(userId, courseId));

export const onPaymentReversed = (payment, options) =>
  runSafe('handleReversal', () => handlePaymentReversal(payment, options));
