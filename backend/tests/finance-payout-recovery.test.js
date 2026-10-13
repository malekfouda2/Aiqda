import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createUser, createCourse, createLesson, createLessonProgress,
  createSubscriptionPackage, createSubscription, createPayment,
  setupIntegrationSuite,
} from './helpers/integration.js';

import { generateEarningsForPayment } from '../src/modules/finance/earnings.service.js';
import { evaluateEligibilityForUserCourse } from '../src/modules/finance/eligibility.service.js';
import { handlePaymentReversal } from '../src/modules/finance/recovery.service.js';
import {
  bulkUpdateEarnings, createBatch, approveBatch, settleBatch,
} from '../src/modules/finance/payout.service.js';
import InstructorEarning from '../src/modules/finance/instructorEarning.model.js';
import FinanceTransaction from '../src/modules/finance/financeTransaction.model.js';

setupIntegrationSuite();

const FUTURE = new Date(Date.now() + 30 * 24 * 3600 * 1000);

// One learner, one instructor, one chapter, paid + completed to eligibility.
const setupEligible = async ({ amount = 499, instructor = null } = {}) => {
  const learner = await createUser({ role: 'student' });
  const ins = instructor || await createUser({ role: 'instructor' });
  const course = await createCourse({ instructorId: ins.user._id, isPublished: true });
  const lesson = await createLesson({ course: course._id, isPublished: true, order: 1 });
  const pkg = await createSubscriptionPackage({ courses: [course._id] });
  const sub = await createSubscription({ user: learner.user._id, package: pkg._id, status: 'active', startDate: new Date(), endDate: FUTURE });
  const payment = await createPayment({ user: learner.user._id, subscription: sub._id, amount });
  await generateEarningsForPayment(payment._id);
  await createLessonProgress({ user: learner.user._id, lesson: lesson._id, course: course._id, isQualified: true });
  await evaluateEligibilityForUserCourse(learner.user._id, course._id);
  // Amounts are only final (and approvable) once the month of the win has ended.
  await InstructorEarning.updateMany(
    { user: learner.user._id },
    { $set: { eligibilityAt: new Date(Date.now() - 62 * 24 * 3600 * 1000) } },
  );
  return { learner, ins, course, payment };
};

test('refund before payout voids the eligible earning', async () => {
  const { payment, course } = await setupEligible();
  let earning = await InstructorEarning.findOne({ course: course._id });
  assert.equal(earning.status, 'eligible');

  await handlePaymentReversal(payment, { reversedAmount: null, kind: 'refund' });
  earning = await InstructorEarning.findById(earning._id);
  assert.equal(earning.status, 'voided');
  assert.equal(earning.eligibleMinor, 0);
});

test('refund after payout creates an instructor recovery balance', async () => {
  const { payment, ins, course } = await setupEligible();
  const earning = await InstructorEarning.findOne({ course: course._id });
  await bulkUpdateEarnings([earning._id], 'approve');
  const batch = await createBatch(ins.user._id, [earning._id]);
  await approveBatch(batch._id);
  await settleBatch(batch._id, { paidAmount: null, settlementReference: 'TRX-1' });

  let paid = await InstructorEarning.findById(earning._id);
  assert.equal(paid.status, 'paid');
  assert.equal(paid.paidMinor, 14970);

  await handlePaymentReversal(payment, { reversedAmount: null, kind: 'refund' });
  paid = await InstructorEarning.findById(earning._id);
  assert.equal(paid.status, 'reversed');
  assert.equal(paid.recoveryMinor, 14970);
});

test('partial payout maintains the correct unpaid balance', async () => {
  const { ins, course } = await setupEligible();
  const earning = await InstructorEarning.findOne({ course: course._id });
  await bulkUpdateEarnings([earning._id], 'approve');
  const batch = await createBatch(ins.user._id, [earning._id]);
  await approveBatch(batch._id);
  await settleBatch(batch._id, { paidAmount: 100 }); // 10000 minor of 14970

  const updated = await InstructorEarning.findById(earning._id);
  assert.equal(updated.status, 'partially_paid');
  assert.equal(updated.paidMinor, 10000);
  const fresh = await InstructorEarning.findById(earning._id);
  assert.equal(Math.max(0, fresh.approvedMinor - fresh.paidMinor), 4970);
});

test('recovery balance is automatically deducted from a future payout', async () => {
  const sharedInstructor = await createUser({ role: 'instructor' });

  // First cycle: pay the instructor, then refund to create a recovery balance.
  const first = await setupEligible({ instructor: sharedInstructor });
  const e1 = await InstructorEarning.findOne({ course: first.course._id });
  await bulkUpdateEarnings([e1._id], 'approve');
  const b1 = await createBatch(sharedInstructor.user._id, [e1._id]);
  await approveBatch(b1._id);
  await settleBatch(b1._id, { paidAmount: null });
  await handlePaymentReversal(first.payment, { reversedAmount: null, kind: 'refund' });

  // Second cycle: a new earning for the same instructor.
  const second = await setupEligible({ instructor: sharedInstructor });
  const e2 = await InstructorEarning.findOne({ course: second.course._id, status: 'eligible' });
  await bulkUpdateEarnings([e2._id], 'approve');
  const b2 = await createBatch(sharedInstructor.user._id, [e2._id]);

  // Outstanding recovery (14970) fully offsets the new approved amount (14970) → nothing payable.
  assert.equal(b2.recoveryAppliedMinor, 14970);
  assert.equal(b2.totalRemainingMinor, 0);
});

test('completion retries do not duplicate earnings', async () => {
  const { learner, course } = await setupEligible();
  await evaluateEligibilityForUserCourse(learner.user._id, course._id);
  await evaluateEligibilityForUserCourse(learner.user._id, course._id);
  const earnings = await InstructorEarning.find({ course: course._id });
  assert.equal(earnings.length, 1);
});

test('a renewal books a new payment but creates no earning by itself', async () => {
  const { learner, course, payment } = await setupEligible();
  const sub = (await FinanceTransaction.findOne({ payment: payment._id })).subscription;
  const renewal = await createPayment({ user: learner.user._id, subscription: sub, amount: 499, paymentType: 'renewal' });
  await generateEarningsForPayment(renewal._id);
  await evaluateEligibilityForUserCourse(learner.user._id, course._id);

  assert.equal(await FinanceTransaction.countDocuments({ parentTransaction: null }), 2);
  assert.equal(await InstructorEarning.countDocuments({ course: course._id }), 1);
});

test('refunds in several parts reduce an approved earning by the right total', async () => {
  const { payment, course } = await setupEligible({ amount: 1000 });
  const earning = await InstructorEarning.findOne({ course: course._id });
  await bulkUpdateEarnings([earning._id], 'approve');
  assert.equal((await InstructorEarning.findById(earning._id)).approvedMinor, 30000);

  await handlePaymentReversal(payment, { reversedAmount: 200, kind: 'refund' });
  assert.equal((await InstructorEarning.findById(earning._id)).approvedMinor, 24000); // 30% of 800
  await handlePaymentReversal(payment, { reversedAmount: 200, kind: 'refund' });
  assert.equal((await InstructorEarning.findById(earning._id)).approvedMinor, 18000); // 30% of 600, not 19200

  await handlePaymentReversal(payment, { reversedAmount: 600, kind: 'refund' });
  const voided = await InstructorEarning.findById(earning._id);
  assert.equal(voided.status, 'voided');
  assert.equal(voided.approvedMinor, 0);
});

test('recording a payment emails the creator, and a mail failure never undoes the payment', async () => {
  const { buildCreatorPayoutSentEmail } = await import('../src/utils/emailTemplates.js');
  const partial = buildCreatorPayoutSentEmail({
    fullName: 'Layla', amountLabel: '100.00 SAR', methodLabel: 'Bank transfer', reference: 'TRX-1', remainingLabel: '49.70 SAR',
  });
  assert.equal(partial.subject, 'Your Aiqda Payout of 100.00 SAR Has Been Sent');
  assert.match(partial.text, /partial payment\. 49\.70 SAR of this payout is still to come/);
  assert.match(partial.text, /Transfer reference: TRX-1/);
  const full = buildCreatorPayoutSentEmail({ fullName: 'Layla', amountLabel: '149.70 SAR', methodLabel: 'Cash', reference: '', remainingLabel: '' });
  assert.match(full.text, /paid in full/);
  assert.doesNotMatch(full.text, /Transfer reference/);

  const { ins, course } = await setupEligible();
  const earning = await InstructorEarning.findOne({ course: course._id });
  await bulkUpdateEarnings([earning._id], 'approve');
  const batch = await createBatch(ins.user._id, [earning._id]);
  await approveBatch(batch._id);

  // Break outgoing mail for this settlement (production with no sender configured):
  // the payment must still be recorded.
  const saved = { NODE_ENV: process.env.NODE_ENV, EMAIL_FROM: process.env.EMAIL_FROM, SMTP_USER: process.env.SMTP_USER };
  process.env.NODE_ENV = 'production';
  delete process.env.EMAIL_FROM;
  delete process.env.SMTP_USER;
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  let settled;
  try {
    settled = await settleBatch(batch._id, { paidAmount: null, settlementReference: 'TRX-2' });
  } finally {
    console.error = originalError;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  assert.ok(logged.some((line) => line.includes('Failed to send creator payout email')), logged.join(' | '));
  assert.equal(settled.status, 'paid');
  assert.equal((await InstructorEarning.findById(earning._id)).status, 'paid');
});
