import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createUser, createCourse, createLesson, createLessonProgress, createCourseProgress,
  createSubscriptionPackage, createSubscription, createPayment,
  setupIntegrationSuite,
} from './helpers/integration.js';

import { generateEarningsForPayment } from '../src/modules/finance/earnings.service.js';
import { evaluateEligibilityForUserCourse } from '../src/modules/finance/eligibility.service.js';
import { handlePaymentReversal } from '../src/modules/finance/recovery.service.js';
import { syncMemberShares } from '../src/modules/finance/shares.service.js';
import { bulkUpdateEarnings } from '../src/modules/finance/payout.service.js';
import { removeLegacyPendingEarnings } from '../src/startup/removeLegacyPendingEarnings.js';
import InstructorEarning from '../src/modules/finance/instructorEarning.model.js';
import ChapterEntitlement from '../src/modules/finance/chapterEntitlement.model.js';
import FinanceTransaction from '../src/modules/finance/financeTransaction.model.js';

setupIntegrationSuite();

const DAY = 24 * 3600 * 1000;
const FUTURE = new Date(Date.now() + 30 * DAY);
// Safely inside the previous calendar month whatever today's date is.
const lastMonth = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12));
};

// A tier with `courseCount` chapters (one creator each, `lessons` published items) and one member.
const setupScenario = async ({ courseCount = 1, lessons = 10 } = {}) => {
  const learner = await createUser({ role: 'student' });
  const instructors = [];
  const courses = [];
  for (let i = 0; i < courseCount; i += 1) {
    const ins = await createUser({ role: 'instructor' });
    const course = await createCourse({ instructorId: ins.user._id, isPublished: true, title: `Chapter ${i}` });
    course.lessonDocs = [];
    for (let l = 0; l < lessons; l += 1) {
      course.lessonDocs.push(await createLesson({ course: course._id, isPublished: true, order: l + 1 }));
    }
    instructors.push(ins);
    courses.push(course);
  }
  const pkg = await createSubscriptionPackage({ courses: courses.map((c) => c._id) });
  const sub = await createSubscription({
    user: learner.user._id, package: pkg._id, status: 'active', startDate: new Date(), endDate: FUTURE,
  });
  return { learner, instructors, courses, pkg, sub };
};

const pay = async ({ learner, sub }, { amount = 499, paidAt = null, ...rest } = {}) => {
  const payment = await createPayment({ user: learner.user._id, subscription: sub._id, amount, ...rest });
  const txn = await generateEarningsForPayment(payment._id);
  if (paidAt) await FinanceTransaction.updateOne({ _id: txn._id }, { $set: { paidAt } });
  return payment;
};

const enroll = async (learner, course, startedAt = new Date()) => {
  course.enrolledStudents.push(learner.user._id);
  await course.save();
  await createCourseProgress({ user: learner.user._id, course: course._id, startedAt });
};

// Qualify `count` content items, then fire the completion hook.
const complete = async (learner, course, count) => {
  for (let i = 0; i < count; i += 1) {
    await createLessonProgress({
      user: learner.user._id, lesson: course.lessonDocs[i]._id, course: course._id, isQualified: true,
    });
  }
  return evaluateEligibilityForUserCourse(learner.user._id, course._id);
};

const earningFor = (learner, course) => InstructorEarning.findOne({ user: learner.user._id, course: course._id });

test('a payment only books the money: no creator earning exists until a chapter is completed', async () => {
  const scenario = await setupScenario();
  await pay(scenario, { amount: 499 });
  await enroll(scenario.learner, scenario.courses[0]);
  // Watching one content item out of ten earns the creator nothing.
  await complete(scenario.learner, scenario.courses[0], 1);

  assert.equal(await FinanceTransaction.countDocuments({ parentTransaction: null }), 1);
  assert.equal(await InstructorEarning.countDocuments({}), 0);
});

test('79% completion earns nothing, exactly 80% earns 30% of what the member paid', async () => {
  const below = await setupScenario();
  await pay(below);
  await enroll(below.learner, below.courses[0]);
  const notYet = await complete(below.learner, below.courses[0], 7);
  assert.equal(notYet.flipped, 0);
  assert.equal(await InstructorEarning.countDocuments({}), 0);

  const at = await setupScenario();
  await pay(at, { amount: 499 });
  await enroll(at.learner, at.courses[0]);
  const reached = await complete(at.learner, at.courses[0], 8);
  assert.equal(reached.flipped, 1);
  const earning = await earningFor(at.learner, at.courses[0]);
  assert.equal(earning.status, 'eligible');
  assert.equal(earning.eligibleMinor, 14970); // 49900 * 30%, one enrolled chapter
  assert.equal(earning.instructor.toString(), at.instructors[0].user._id.toString());
});

test('a creator wins only once per member per chapter: renewals and rewatching never pay again', async () => {
  const scenario = await setupScenario();
  const { learner, courses } = scenario;
  await pay(scenario, { amount: 499 });
  await enroll(learner, courses[0]);
  await complete(learner, courses[0], 9);

  // Repeated completion events.
  await evaluateEligibilityForUserCourse(learner.user._id, courses[0]._id);
  await evaluateEligibilityForUserCourse(learner.user._id, courses[0]._id);
  // The member renews twice and rewatches the chapter each time.
  await pay(scenario, { amount: 499, paymentType: 'renewal' });
  await evaluateEligibilityForUserCourse(learner.user._id, courses[0]._id);
  await pay(scenario, { amount: 499, paymentType: 'renewal' });
  await evaluateEligibilityForUserCourse(learner.user._id, courses[0]._id);
  await syncMemberShares(learner.user._id);

  const earnings = await InstructorEarning.find({ course: courses[0]._id });
  assert.equal(earnings.length, 1);
  assert.equal(earnings[0].eligibleMinor, 14970);
  assert.equal(await FinanceTransaction.countDocuments({ parentTransaction: null }), 3);
});

test('the win is funded by the latest payment at the moment the member reaches 80%', async () => {
  const scenario = await setupScenario();
  const { learner, courses } = scenario;
  const first = await pay(scenario, { amount: 499, paidAt: new Date(Date.now() - 40 * DAY) });
  const renewal = await pay(scenario, { amount: 300, paymentType: 'renewal', paidAt: new Date(Date.now() - 2 * DAY) });
  await enroll(learner, courses[0]);
  await complete(learner, courses[0], 8);

  const earning = await earningFor(learner, courses[0]).populate('financeTransaction');
  assert.equal(earning.financeTransaction.payment.toString(), renewal._id.toString());
  assert.notEqual(earning.financeTransaction.payment.toString(), first._id.toString());
  assert.equal(earning.eligibleMinor, 9000); // 30000 * 30%: the first payment's share stays with the platform
  assert.equal(await InstructorEarning.countDocuments({}), 1);
});

test('the pool is split equally over the chapters the member is enrolled in', async () => {
  const scenario = await setupScenario({ courseCount: 5 });
  const { learner, courses } = scenario;
  await pay(scenario, { amount: 1000 }); // pool 300.00
  await enroll(learner, courses[0]);
  await enroll(learner, courses[1]);

  // Enrolled in 2 of the tier's 5 chapters, finishes one: 150, not 60 and not 300.
  await complete(learner, courses[0], 8);
  assert.equal((await earningFor(learner, courses[0])).eligibleMinor, 15000);
  assert.equal(await InstructorEarning.countDocuments({}), 1);

  // Finishes the second: each creator has 150, the whole pool is used.
  await complete(learner, courses[1], 10);
  assert.equal((await earningFor(learner, courses[0])).eligibleMinor, 15000);
  assert.equal((await earningFor(learner, courses[1])).eligibleMinor, 15000);

  // Enrols in a third chapter before the month ends: the split becomes 100 each.
  await enroll(learner, courses[2]);
  await syncMemberShares(learner.user._id);
  assert.equal((await earningFor(learner, courses[0])).eligibleMinor, 10000);
  assert.equal((await earningFor(learner, courses[1])).eligibleMinor, 10000);
  await complete(learner, courses[2], 8);
  const all = await InstructorEarning.find({ user: learner.user._id });
  assert.deepEqual(all.map((e) => e.eligibleMinor), [10000, 10000, 10000]);
});

test('the split is fixed at the end of the month: later enrolments never rewrite a past month', async () => {
  const scenario = await setupScenario({ courseCount: 3 });
  const { learner, courses } = scenario;
  await pay(scenario, { amount: 1000, paidAt: new Date(lastMonth().getTime() - 5 * DAY) });
  await enroll(learner, courses[0], new Date(lastMonth().getTime() - 3 * DAY));
  await enroll(learner, courses[1], new Date(lastMonth().getTime() - 3 * DAY));
  await complete(learner, courses[0], 8);
  await InstructorEarning.updateMany({}, { $set: { eligibilityAt: lastMonth() } });
  await syncMemberShares(learner.user._id);
  let earning = await earningFor(learner, courses[0]);
  assert.equal(earning.eligibleMinor, 15000);
  assert.equal(earning.enrolledChaptersSnapshot, 2);
  assert.equal(earning.shareBasisLocked, true);

  // This month the member enrols in a third chapter and one of the old ones is removed.
  await enroll(learner, courses[2]);
  courses[1].enrolledStudents = [];
  await courses[1].save();
  await syncMemberShares(learner.user._id);
  earning = await earningFor(learner, courses[0]);
  assert.equal(earning.eligibleMinor, 15000);
  assert.equal(earning.enrolledChaptersSnapshot, 2);
});

test('wins on one payment never add up to more than 30% of it', async () => {
  const scenario = await setupScenario({ courseCount: 3 });
  const { learner, courses } = scenario;
  await pay(scenario, { amount: 1000, paidAt: new Date(lastMonth().getTime() - 5 * DAY) });

  // Last month: enrolled in one chapter and finished it, so that creator took the whole pool.
  await enroll(learner, courses[0], new Date(lastMonth().getTime() - 3 * DAY));
  await complete(learner, courses[0], 8);
  await InstructorEarning.updateMany({}, { $set: { eligibilityAt: lastMonth() } });
  await syncMemberShares(learner.user._id);
  assert.equal((await earningFor(learner, courses[0])).eligibleMinor, 30000);

  // This month, still on the same payment, two more chapters are enrolled and finished.
  await enroll(learner, courses[1]);
  await enroll(learner, courses[2]);
  await complete(learner, courses[1], 8);
  await complete(learner, courses[2], 8);

  const earnings = await InstructorEarning.find({ user: learner.user._id }).sort({ eligibilityAt: 1 });
  assert.equal(earnings.length, 3);
  assert.equal(earnings.reduce((sum, e) => sum + e.eligibleMinor, 0), 30000);
  assert.deepEqual(earnings.map((e) => e.eligibleMinor), [30000, 0, 0]);
  // The uncovered share stays visible so the admin can decide what to do with it.
  assert.equal(earnings[1].maxPotentialMinor, 10000);
});

test('rounding never pays out more than the pool', async () => {
  const scenario = await setupScenario({ courseCount: 3 });
  const { learner, courses } = scenario;
  await pay(scenario, { amount: 333.33 }); // pool floor(33333 * 30%) = 9999
  for (const course of courses) await enroll(learner, course);
  for (const course of courses) await complete(learner, course, 8);
  const earnings = await InstructorEarning.find({ user: learner.user._id });
  assert.deepEqual(earnings.map((e) => e.eligibleMinor), [3333, 3333, 3333]);
});

test('gateway fees do not reduce the pool and the amount actually paid is the basis', async () => {
  const withFee = await setupScenario();
  const txnPayment = await pay(withFee, { amount: 499, chargeSnapshot: { fee: 25 } });
  const txn = await FinanceTransaction.findOne({ payment: txnPayment._id });
  assert.equal(txn.gatewayFeeMinor, 2500);
  await enroll(withFee.learner, withFee.courses[0]);
  await complete(withFee.learner, withFee.courses[0], 8);
  assert.equal((await earningFor(withFee.learner, withFee.courses[0])).eligibleMinor, 14970);

  const discounted = await setupScenario();
  await pay(discounted, { amount: 300 }); // discounted price actually paid
  await enroll(discounted.learner, discounted.courses[0]);
  await complete(discounted.learner, discounted.courses[0], 8);
  assert.equal((await earningFor(discounted.learner, discounted.courses[0])).eligibleMinor, 9000);
});

test('payment/webhook retries are idempotent', async () => {
  const scenario = await setupScenario();
  const payment = await pay(scenario);
  await generateEarningsForPayment(payment._id);
  await generateEarningsForPayment(payment._id);
  assert.equal(await FinanceTransaction.countDocuments({ payment: payment._id, parentTransaction: null }), 1);
  assert.equal(await InstructorEarning.countDocuments({}), 0);
});

test('a member without any payment earns the creator nothing', async () => {
  const scenario = await setupScenario();
  await enroll(scenario.learner, scenario.courses[0]);
  const result = await complete(scenario.learner, scenario.courses[0], 10);
  assert.equal(result.flipped, 0);
  assert.equal(result.unfunded, true);
  assert.equal(await InstructorEarning.countDocuments({}), 0);
});

test('partial refund shrinks the shares; a full refund cancels the win so a later payment can fund it', async () => {
  const scenario = await setupScenario({ courseCount: 2 });
  const { learner, courses } = scenario;
  const payment = await pay(scenario, { amount: 1000, paidAt: new Date(Date.now() - 3 * DAY) });
  await enroll(learner, courses[0]);
  await enroll(learner, courses[1]);
  await complete(learner, courses[0], 8);
  await complete(learner, courses[1], 8);

  await handlePaymentReversal(payment, { reversedAmount: 400, kind: 'refund' });
  let earnings = await InstructorEarning.find({ user: learner.user._id });
  assert.deepEqual(earnings.map((e) => e.eligibleMinor), [9000, 9000]); // 30% of the remaining 600, halved

  await handlePaymentReversal(payment, { reversedAmount: 600, kind: 'refund' });
  earnings = await InstructorEarning.find({ user: learner.user._id });
  assert.deepEqual(earnings.map((e) => [e.status, e.eligibleMinor]), [['voided', 0], ['voided', 0]]);

  // The member pays again and comes back to the chapter: the cancelled win can be earned again, once.
  await pay(scenario, { amount: 500, paymentType: 'renewal' });
  await evaluateEligibilityForUserCourse(learner.user._id, courses[0]._id);
  await evaluateEligibilityForUserCourse(learner.user._id, courses[0]._id);
  const live = await InstructorEarning.find({ user: learner.user._id, status: 'eligible' });
  assert.equal(live.length, 1);
  assert.equal(live[0].eligibleMinor, 7500); // 30% of 500 over 2 enrolled chapters
});

test('an earning cannot be approved for payout before its month has ended', async () => {
  const scenario = await setupScenario();
  await pay(scenario, { amount: 499, paidAt: new Date(lastMonth().getTime() - 5 * DAY) });
  await enroll(scenario.learner, scenario.courses[0], new Date(lastMonth().getTime() - 3 * DAY));
  await complete(scenario.learner, scenario.courses[0], 8);
  const earning = await earningFor(scenario.learner, scenario.courses[0]);

  assert.equal((await bulkUpdateEarnings([earning._id], 'approve')).length, 0);
  assert.equal((await InstructorEarning.findById(earning._id)).status, 'eligible');

  await InstructorEarning.updateOne({ _id: earning._id }, { $set: { eligibilityAt: lastMonth() } });
  assert.equal((await bulkUpdateEarnings([earning._id], 'approve')).length, 1);
  const approved = await InstructorEarning.findById(earning._id);
  assert.equal(approved.status, 'approved_for_payout');
  assert.equal(approved.approvedMinor, 14970);
});

test('legacy pending earnings created at payment time are removed and never block real wins', async () => {
  const scenario = await setupScenario();
  const { learner, courses, instructors } = scenario;
  const payment = await pay(scenario, { amount: 499 });
  const txn = await FinanceTransaction.findOne({ payment: payment._id });
  const entitlement = await ChapterEntitlement.create({
    user: learner.user._id, financeTransaction: txn._id, course: courses[0]._id, instructor: instructors[0].user._id,
  });
  await InstructorEarning.create({
    user: learner.user._id,
    instructor: instructors[0].user._id,
    course: courses[0]._id,
    financeTransaction: txn._id,
    chapterEntitlement: entitlement._id,
    maxPotentialMinor: 14970,
    status: 'pending_completion',
  });

  assert.deepEqual(await removeLegacyPendingEarnings(), { removedEarnings: 1 });
  assert.deepEqual(await removeLegacyPendingEarnings(), { removedEarnings: 0 });
  assert.equal(await ChapterEntitlement.countDocuments({}), 0);

  await enroll(learner, courses[0]);
  await complete(learner, courses[0], 8);
  const earnings = await InstructorEarning.find({});
  assert.equal(earnings.length, 1);
  assert.equal(earnings[0].status, 'eligible');
  assert.equal(earnings[0].eligibleMinor, 14970);
});

test('enrolling in another chapter through the app re-splits the month immediately, on every screen', async () => {
  const { default: request } = await import('supertest');
  const { authHeader } = await import('./helpers/integration.js');
  const { default: app } = await import('../src/app.js');
  const { getOverview, queryEarnings } = await import('../src/modules/finance/financeReport.service.js');
  const scenario = await setupScenario({ courseCount: 2 });
  const { learner, courses } = scenario;
  await pay(scenario, { amount: 1000 });
  await enroll(learner, courses[0]);
  await complete(learner, courses[0], 8);
  assert.equal((await earningFor(learner, courses[0])).eligibleMinor, 30000);

  const enrolled = await request(app).post(`/api/courses/${courses[1]._id}/enroll`).set(authHeader(learner.token));
  assert.equal(enrolled.status, 200, JSON.stringify(enrolled.body));
  assert.equal((await earningFor(learner, courses[0])).eligibleMinor, 15000);

  // A stored amount that drifted is corrected before any report reads it.
  await InstructorEarning.updateMany({}, { $set: { eligibleMinor: 99999 } });
  assert.equal((await queryEarnings({}))[0].eligible, 150);
  await InstructorEarning.updateMany({}, { $set: { eligibleMinor: 99999 } });
  assert.equal((await getOverview()).eligibleInstructorLiability, 150);
});
