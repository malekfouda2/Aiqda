import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createUser, createCourse, createLesson, createLessonProgress,
  createSubscriptionPackage, createSubscription, createPayment,
  setupIntegrationSuite,
} from './helpers/integration.js';

import Payment from '../src/modules/payments/payment.model.js';
import FinanceTransaction from '../src/modules/finance/financeTransaction.model.js';
import InstructorEarning from '../src/modules/finance/instructorEarning.model.js';
import { generateEarningsForPayment } from '../src/modules/finance/earnings.service.js';
import { evaluateEligibilityForUserCourse } from '../src/modules/finance/eligibility.service.js';
import { bulkUpdateEarnings, createBatch, approveBatch, settleBatch } from '../src/modules/finance/payout.service.js';
import { handlePaymentReversal } from '../src/modules/finance/recovery.service.js';
import { updateSettings } from '../src/modules/finance/financeSettings.service.js';
import { getOverview, exportEarningsCsv } from '../src/modules/finance/financeReport.service.js';

setupIntegrationSuite();

const FUTURE = new Date(Date.now() + 30 * 24 * 3600 * 1000);

const setPaymentCapturedAt = async (paymentId, paidAt) => {
  await Payment.updateOne(
    { _id: paymentId },
    { $set: { createdAt: paidAt, updatedAt: paidAt } },
  );
};

const setFinanceTransactionPaidAt = async (paymentId, paidAt) => {
  await FinanceTransaction.updateOne(
    { payment: paymentId, parentTransaction: null },
    { $set: { paidAt, createdAt: paidAt, updatedAt: paidAt } },
  );
};

const setLatestReversalPaidAt = async (paymentId, paidAt) => {
  const parent = await FinanceTransaction.findOne({ payment: paymentId, parentTransaction: null }).select('_id');
  const reversal = await FinanceTransaction.findOne({ parentTransaction: parent._id }).sort({ createdAt: -1 });
  await FinanceTransaction.updateOne(
    { _id: reversal._id },
    { $set: { paidAt, createdAt: paidAt, updatedAt: paidAt } },
  );
};

const setupEligibleScenario = async ({
  amount,
  paidAt,
  chargeSnapshot = null,
  instructorName = 'Test Instructor',
  learnerName = 'Test Learner',
  courseTitle = 'Test Chapter',
} = {}) => {
  const learner = await createUser({ role: 'student', name: learnerName });
  const instructor = await createUser({ role: 'instructor', name: instructorName });
  const course = await createCourse({
    instructorId: instructor.user._id,
    isPublished: true,
    title: courseTitle,
  });
  const lesson = await createLesson({ course: course._id, isPublished: true, order: 1 });
  const pkg = await createSubscriptionPackage({ courses: [course._id] });
  const sub = await createSubscription({
    user: learner.user._id,
    package: pkg._id,
    status: 'active',
    startDate: paidAt,
    endDate: FUTURE,
  });
  const payment = await createPayment({
    user: learner.user._id,
    subscription: sub._id,
    amount,
    chargeSnapshot,
  });
  await setPaymentCapturedAt(payment._id, paidAt);
  await generateEarningsForPayment(payment._id);
  await setFinanceTransactionPaidAt(payment._id, paidAt);
  await createLessonProgress({
    user: learner.user._id,
    lesson: lesson._id,
    course: course._id,
    isQualified: true,
  });
  await evaluateEligibilityForUserCourse(learner.user._id, course._id);

  return { learner, instructor, course, payment };
};

test('finance overview stays period-consistent and subtracts reversals from platform cash metrics', async () => {
  await updateSettings({
    bankFee: 5,
    expenses: [{ label: 'Operations', amount: 20 }],
  });

  const januaryPaidAt = new Date('2026-01-15T10:00:00.000Z');
  const marchPaidAtA = new Date('2026-03-10T10:00:00.000Z');
  const marchPaidAtB = new Date('2026-03-12T10:00:00.000Z');

  const january = await setupEligibleScenario({ amount: 200, paidAt: januaryPaidAt });
  const januaryEarning = await InstructorEarning.findOne({ course: january.course._id });
  await bulkUpdateEarnings([januaryEarning._id], 'approve');

  const marchA = await setupEligibleScenario({
    amount: 300,
    paidAt: marchPaidAtA,
    chargeSnapshot: { fee: 10 },
  });
  const marchAEarning = await InstructorEarning.findOne({ course: marchA.course._id });
  await bulkUpdateEarnings([marchAEarning._id], 'approve');
  await handlePaymentReversal(marchA.payment._id, { reversedAmount: 100, kind: 'refund' });
  await setLatestReversalPaidAt(marchA.payment._id, new Date('2026-03-14T10:00:00.000Z'));

  const marchB = await setupEligibleScenario({ amount: 200, paidAt: marchPaidAtB });
  const marchBEarning = await InstructorEarning.findOne({ course: marchB.course._id });
  await bulkUpdateEarnings([marchBEarning._id], 'approve');
  const batch = await createBatch(marchB.instructor.user._id, [marchBEarning._id]);
  await approveBatch(batch._id);
  await settleBatch(batch._id, { paidAmount: null, settlementReference: 'SETTLED-1' });
  await handlePaymentReversal(marchB.payment._id, { reversedAmount: null, kind: 'chargeback' });
  await setLatestReversalPaidAt(marchB.payment._id, new Date('2026-03-15T10:00:00.000Z'));

  const overview = await getOverview({
    from: '2026-03-01T00:00:00.000Z',
    to: '2026-03-31T23:59:59.999Z',
  });

  assert.deepEqual(overview.expenses, [{ label: 'Operations', amount: 20 }]);
  assert.equal(overview.grossPaid, 500);
  assert.equal(overview.gatewayFees, 10);
  assert.equal(overview.bankFees, 5);
  assert.equal(overview.expensesTotal, 20);
  assert.equal(overview.refunds, 100);
  assert.equal(overview.chargebacks, 200);
  assert.equal(overview.netCashAfterFees, 165);
  assert.equal(overview.maxInstructorExposure, 150);
  assert.equal(overview.pendingInstructorPotential, 0);
  assert.equal(overview.eligibleInstructorLiability, 60);
  assert.equal(overview.approvedUnpaid, 60);
  assert.equal(overview.actualInstructorPayouts, 60);
  assert.equal(overview.instructorRecoveryBalances, 60);
  assert.equal(overview.platformGrossShare, 350);
  assert.equal(overview.platformCashAfterFeesAndLiabilities, 105);
  assert.equal(overview.platformCashAfterPayouts, 105);
});

test('earnings csv export escapes commas and quotes correctly', async () => {
  const paidAt = new Date('2026-04-02T10:00:00.000Z');
  await setupEligibleScenario({
    amount: 250,
    paidAt,
    instructorName: 'Instructor, "Lead"',
    learnerName: 'Learner, "Primary"',
    courseTitle: 'Chapter, "Quoted"',
  });

  const csv = await exportEarningsCsv({});
  const lines = csv.trim().split('\n');

  assert.equal(lines[0], 'Instructor,Learner,Chapter,MaxPotential,Eligible,Approved,Paid,Recovery,Completion%,Status,Date');
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^"Instructor, ""Lead""","Learner, ""Primary""","Chapter, ""Quoted""",75,75,0,0,0,100,eligible,/);
});
