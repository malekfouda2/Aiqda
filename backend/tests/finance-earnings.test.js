import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createUser, createCourse, createLesson, createLessonProgress,
  createSubscriptionPackage, createSubscription, createPayment,
  setupIntegrationSuite,
} from './helpers/integration.js';

import { generateEarningsForPayment } from '../src/modules/finance/earnings.service.js';
import { evaluateEligibilityForUserCourse } from '../src/modules/finance/eligibility.service.js';
import { saveAllocations } from '../src/modules/finance/allocation.service.js';
import InstructorEarning from '../src/modules/finance/instructorEarning.model.js';
import FinanceTransaction from '../src/modules/finance/financeTransaction.model.js';

setupIntegrationSuite();

const FUTURE = new Date(Date.now() + 30 * 24 * 3600 * 1000);

const setupScenario = async ({ courseCount = 1, amount = 499, chargeSnapshot = null } = {}) => {
  const learner = await createUser({ role: 'student' });
  const instructors = [];
  const courses = [];
  for (let i = 0; i < courseCount; i += 1) {
    const ins = await createUser({ role: 'instructor' });
    const course = await createCourse({ instructorId: ins.user._id, isPublished: true, title: `Chapter ${i}` });
    instructors.push(ins);
    courses.push(course);
  }
  const pkg = await createSubscriptionPackage({ courses: courses.map((c) => c._id) });
  const sub = await createSubscription({
    user: learner.user._id, package: pkg._id, status: 'active', startDate: new Date(), endDate: FUTURE,
  });
  const payment = await createPayment({ user: learner.user._id, subscription: sub._id, amount, chargeSnapshot });
  return { learner, instructors, courses, pkg, sub, payment };
};

// Create `total` published lessons in a course and qualify `completed` of them for the learner.
const driveCompletion = async (learnerId, course, completed, total) => {
  const lessons = [];
  for (let i = 0; i < total; i += 1) {
    lessons.push(await createLesson({ course: course._id, isPublished: true, order: i + 1 }));
  }
  for (let i = 0; i < completed; i += 1) {
    await createLessonProgress({ user: learnerId, lesson: lessons[i]._id, course: course._id, isQualified: true });
  }
};

test('successful payment creates pending potential earnings, capped at 30% of actual paid', async () => {
  const { payment, courses } = await setupScenario({ amount: 499 });
  await generateEarningsForPayment(payment._id);

  const earnings = await InstructorEarning.find({ course: courses[0]._id });
  assert.equal(earnings.length, 1);
  assert.equal(earnings[0].status, 'pending_completion');
  assert.equal(earnings[0].maxPotentialMinor, 14970); // 49900 * 30%
});

test('79% completion is not eligible, exactly 80% becomes eligible', async () => {
  const below = await setupScenario();
  await generateEarningsForPayment(below.payment._id);
  await driveCompletion(below.learner.user._id, below.courses[0], 7, 10); // 70%
  let res = await evaluateEligibilityForUserCourse(below.learner.user._id, below.courses[0]._id);
  let earning = await InstructorEarning.findOne({ course: below.courses[0]._id });
  assert.equal(earning.status, 'pending_completion');

  const at = await setupScenario();
  await generateEarningsForPayment(at.payment._id);
  await driveCompletion(at.learner.user._id, at.courses[0], 8, 10); // 80%
  res = await evaluateEligibilityForUserCourse(at.learner.user._id, at.courses[0]._id);
  assert.equal(res.flipped, 1);
  earning = await InstructorEarning.findOne({ course: at.courses[0]._id });
  assert.equal(earning.status, 'eligible');
  assert.equal(earning.eligibleMinor, earning.maxPotentialMinor);
});

test('repeated completion events do not create duplicate or extra earnings', async () => {
  const { payment, learner, courses } = await setupScenario();
  await generateEarningsForPayment(payment._id);
  await driveCompletion(learner.user._id, courses[0], 9, 10);
  await evaluateEligibilityForUserCourse(learner.user._id, courses[0]._id);
  await evaluateEligibilityForUserCourse(learner.user._id, courses[0]._id);
  await evaluateEligibilityForUserCourse(learner.user._id, courses[0]._id);
  const earnings = await InstructorEarning.find({ course: courses[0]._id });
  assert.equal(earnings.length, 1);
  assert.equal(earnings[0].status, 'eligible');
});

test('multiple instructors split the 30% pool without exceeding it', async () => {
  const { payment } = await setupScenario({ courseCount: 3, amount: 499 });
  await generateEarningsForPayment(payment._id);
  const earnings = await InstructorEarning.find({ financeTransaction: { $ne: null } });
  assert.equal(earnings.length, 3);
  const totalMax = earnings.reduce((acc, e) => acc + e.maxPotentialMinor, 0);
  assert.equal(totalMax, 14970); // exactly 30% of 49900, fully allocated by equal split
});

test('gateway fee does not reduce the instructor pool', async () => {
  const { payment } = await setupScenario({ amount: 499, chargeSnapshot: { fee: 25 } });
  const txn = await generateEarningsForPayment(payment._id);
  assert.equal(txn.gatewayFeeMinor, 2500);
  const earning = await InstructorEarning.findOne();
  assert.equal(earning.maxPotentialMinor, 14970); // still 30% of gross, fee ignored
});

test('discounted/actual paid amount is the payout basis', async () => {
  const { payment } = await setupScenario({ amount: 300 }); // discounted price actually paid
  await generateEarningsForPayment(payment._id);
  const earning = await InstructorEarning.findOne();
  assert.equal(earning.maxPotentialMinor, 9000); // 30000 * 30%
});

test('payment/webhook retries are idempotent', async () => {
  const { payment, courses } = await setupScenario();
  await generateEarningsForPayment(payment._id);
  await generateEarningsForPayment(payment._id);
  await generateEarningsForPayment(payment._id);
  const txns = await FinanceTransaction.find({ payment: payment._id, parentTransaction: null });
  const earnings = await InstructorEarning.find({ course: courses[0]._id });
  assert.equal(txns.length, 1);
  assert.equal(earnings.length, 1);
});

test('allocation total above 100% is rejected', async () => {
  const { pkg, courses } = await setupScenario({ courseCount: 2 });
  await assert.rejects(
    () => saveAllocations(pkg._id, [
      { course: courses[0]._id, percentageBps: 7000 },
      { course: courses[1]._id, percentageBps: 4000 },
    ]),
    /cannot exceed 100%/,
  );
});

test('allocation changes apply prospectively and never rewrite prior earning snapshots', async () => {
  const { pkg, courses, payment } = await setupScenario({ courseCount: 2, amount: 499 });
  await generateEarningsForPayment(payment._id); // equal split snapshot: 5000/5000 bps
  const before = await InstructorEarning.find({ course: { $in: courses.map((c) => c._id) } }).sort({ allocationBpsSnapshot: 1 });
  assert.deepEqual(before.map((e) => e.allocationBpsSnapshot).sort(), [5000, 5000]);

  // Change weights after the payment.
  await saveAllocations(pkg._id, [
    { course: courses[0]._id, percentageBps: 8000 },
    { course: courses[1]._id, percentageBps: 2000 },
  ]);

  const after = await InstructorEarning.find({ course: { $in: courses.map((c) => c._id) } });
  assert.deepEqual(after.map((e) => e.allocationBpsSnapshot).sort(), [5000, 5000]); // unchanged
});

test('admin weights override the equal-split default for new payments', async () => {
  const { pkg, courses } = await setupScenario({ courseCount: 2 });
  await saveAllocations(pkg._id, [
    { course: courses[0]._id, percentageBps: 8000 },
    { course: courses[1]._id, percentageBps: 2000 },
  ]);

  // New learner + payment on the same package after weights set.
  const learner = await createUser({ role: 'student' });
  const sub = await createSubscription({ user: learner.user._id, package: pkg._id, status: 'active', startDate: new Date(), endDate: FUTURE });
  const payment = await createPayment({ user: learner.user._id, subscription: sub._id, amount: 499 });
  await generateEarningsForPayment(payment._id);

  const e0 = await InstructorEarning.findOne({ course: courses[0]._id, user: learner.user._id });
  const e1 = await InstructorEarning.findOne({ course: courses[1]._id, user: learner.user._id });
  assert.equal(e0.maxPotentialMinor, 11976); // 14970 * 80%
  assert.equal(e1.maxPotentialMinor, 2994); // 14970 * 20%
});
