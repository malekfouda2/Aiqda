import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import {
  authHeader, createUser, createCourse, createLesson, createLessonProgress,
  createSubscriptionPackage, createSubscription, createPayment,
  setupIntegrationSuite,
} from './helpers/integration.js';

import { generateEarningsForPayment } from '../src/modules/finance/earnings.service.js';
import { evaluateEligibilityForUserCourse } from '../src/modules/finance/eligibility.service.js';
import InstructorEarning from '../src/modules/finance/instructorEarning.model.js';
import CreatorStatement from '../src/modules/finance/creatorStatement.model.js';
import FinanceAudit from '../src/modules/finance/financeAudit.model.js';
import Notification from '../src/modules/notifications/notification.model.js';

const suite = setupIntegrationSuite();

const FUTURE = new Date(Date.now() + 30 * 24 * 3600 * 1000);

const toPeriod = (date) => {
  const riyadh = new Date(date.getTime() + 3 * 3600 * 1000);
  return `${riyadh.getUTCFullYear()}-${String(riyadh.getUTCMonth() + 1).padStart(2, '0')}`;
};
const CURRENT_PERIOD = toPeriod(new Date());
const lastMonthDate = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12));
};
const LAST_PERIOD = toPeriod(lastMonthDate());

// One creator chapter with 5 published content items inside a 499 SAR tier (pool = 149.70 SAR).
const setupCreator = async () => {
  const admin = await createUser({ role: 'admin' });
  const creator = await createUser({ role: 'instructor', name: 'Creator One' });
  const course = await createCourse({ instructorId: creator.user._id, isPublished: true, title: 'Chapter A' });
  const lessons = [];
  for (let i = 0; i < 5; i += 1) {
    lessons.push(await createLesson({ course: course._id, isPublished: true, order: i + 1 }));
  }
  const pkg = await createSubscriptionPackage({ courses: [course._id] });
  return { admin, creator, course, lessons, pkg };
};

// A paying member enrolled in the chapter who qualified `completed` content items.
// When they reach 80% the earning's eligibility date is moved to `eligibleOn`.
const addMember = async ({ course, lessons, pkg }, { completed, eligibleOn = null, name = 'Secret Member' }) => {
  const member = await createUser({ role: 'student', name, email: `${name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}-${Math.random()}@example.com` });
  const sub = await createSubscription({
    user: member.user._id, package: pkg._id, status: 'active', startDate: new Date(), endDate: FUTURE,
  });
  const payment = await createPayment({ user: member.user._id, subscription: sub._id, amount: 499 });
  await generateEarningsForPayment(payment._id);
  course.enrolledStudents.push(member.user._id);
  await course.save();
  for (let i = 0; i < completed; i += 1) {
    await createLessonProgress({ user: member.user._id, lesson: lessons[i]._id, course: course._id, isQualified: true });
  }
  await evaluateEligibilityForUserCourse(member.user._id, course._id);
  if (eligibleOn) {
    await InstructorEarning.updateMany({ user: member.user._id, status: 'eligible' }, { $set: { eligibilityAt: eligibleOn } });
  }
  return member;
};

const statementUrl = (creator, period, action = '') => (
  `/api/finance/statements/${creator.user._id}/${period}${action ? `/${action}` : ''}`
);

test('statement counts revenue in the month the member reached 80% and reports member numbers only', async () => {
  const scenario = await setupCreator();
  const { admin, creator, course } = scenario;
  await addMember(scenario, { completed: 4, eligibleOn: lastMonthDate(), name: 'Reached Last Month' });
  await addMember(scenario, { completed: 5, name: 'Reached This Month' });
  await addMember(scenario, { completed: 1, name: 'Barely Started' });

  const last = await request(suite.app).get(statementUrl(creator, LAST_PERIOD)).set(authHeader(admin.token));
  assert.equal(last.status, 200);
  assert.equal(last.body.status, 'draft');
  assert.equal(last.body.canFinalize, true);
  assert.equal(last.body.chapters.length, 1);
  assert.deepEqual(
    {
      courseId: last.body.chapters[0].courseId,
      enrolled: last.body.chapters[0].enrolled,
      reached: last.body.chapters[0].reached,
      notYet: last.body.chapters[0].notYet,
      calculated: last.body.chapters[0].calculated,
      final: last.body.chapters[0].final,
    },
    { courseId: course._id.toString(), enrolled: 3, reached: 2, notYet: 1, calculated: 149.7, final: 149.7 },
  );

  // The member who reached 80% this month belongs to this month's statement, which cannot be finalized yet.
  const current = await request(suite.app).get(statementUrl(creator, CURRENT_PERIOD)).set(authHeader(admin.token));
  assert.equal(current.body.calculatedTotal, 149.7);
  assert.equal(current.body.canFinalize, false);
  const tooEarly = await request(suite.app).post(statementUrl(creator, CURRENT_PERIOD, 'finalize')).set(authHeader(admin.token));
  assert.equal(tooEarly.status, 400);
  assert.match(tooEarly.body.error, /after its month has ended/i);

  const list = await request(suite.app).get(`/api/finance/statements?period=${LAST_PERIOD}`).set(authHeader(admin.token));
  assert.equal(list.status, 200);
  assert.equal(list.body.statements.length, 1);
  assert.equal(list.body.statements[0].name, 'Creator One');
  assert.equal(list.body.statements[0].calculatedTotal, 149.7);
});

test('creator sees no revenue until the admin edits and finalizes, then is notified', async () => {
  const scenario = await setupCreator();
  const { admin, creator, course } = scenario;
  await addMember(scenario, { completed: 4, eligibleOn: lastMonthDate(), name: 'Hidden Person' });
  await addMember(scenario, { completed: 0, name: 'Another Hidden Person' });

  const before = await request(suite.app).get('/api/finance/my-statements').set(authHeader(creator.token));
  assert.equal(before.status, 200);
  assert.deepEqual(before.body, []);

  const saved = await request(suite.app)
    .put(statementUrl(creator, LAST_PERIOD))
    .set(authHeader(admin.token))
    .send({ chapters: [{ courseId: course._id.toString(), final: 120 }], note: 'Adjusted after review.' });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.chapters[0].calculated, 149.7);
  assert.equal(saved.body.chapters[0].final, 120);
  assert.equal(saved.body.chapters[0].edited, true);

  // Saving a draft publishes nothing.
  const stillHidden = await request(suite.app).get('/api/finance/my-statements').set(authHeader(creator.token));
  assert.deepEqual(stillHidden.body, []);
  assert.equal(await Notification.countDocuments({ recipient: creator.user._id }), 0);

  const finalized = await request(suite.app).post(statementUrl(creator, LAST_PERIOD, 'finalize')).set(authHeader(admin.token));
  assert.equal(finalized.status, 200);
  assert.equal(finalized.body.status, 'finalized');
  assert.equal(finalized.body.finalTotal, 120);
  assert.equal(finalized.body.calculatedTotal, 149.7);

  const visible = await request(suite.app).get('/api/finance/my-statements').set(authHeader(creator.token));
  assert.equal(visible.body.length, 1);
  assert.equal(visible.body[0].period, LAST_PERIOD);
  assert.equal(visible.body[0].total, 120);
  assert.equal(visible.body[0].note, 'Adjusted after review.');
  assert.deepEqual(visible.body[0].chapters, [{
    courseId: course._id.toString(), title: 'Chapter A', amount: 120, enrolled: 2, reached: 1, notYet: 1,
  }]);
  // No member identities and no pre-edit figure leak to the creator.
  const payload = JSON.stringify(visible.body);
  assert.doesNotMatch(payload, /Hidden Person|@example\.com|calculated|149\.7/);

  const notifications = await Notification.find({ recipient: creator.user._id }).lean();
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'creator_statement_finalized');
  assert.match(notifications[0].message, /finalized the calculation of your revenue/i);
  assert.equal(notifications[0].link, '/creator');

  // A finalized statement is locked.
  const locked = await request(suite.app)
    .put(statementUrl(creator, LAST_PERIOD))
    .set(authHeader(admin.token))
    .send({ chapters: [{ courseId: course._id.toString(), final: 1 }] });
  assert.equal(locked.status, 400);
  assert.match(locked.body.error, /reopen it before editing/i);
  const twice = await request(suite.app).post(statementUrl(creator, LAST_PERIOD, 'finalize')).set(authHeader(admin.token));
  assert.equal(twice.status, 400);

  const audits = await FinanceAudit.find({ targetType: 'CreatorStatement' }).sort({ createdAt: 1 }).lean();
  assert.deepEqual(audits.map((entry) => entry.action), ['statement.edited', 'statement.finalized']);
  assert.equal(audits[1].actorId.toString(), admin.user._id.toString());
});

test('reopened statement keeps the published version until it is finalized again', async () => {
  const scenario = await setupCreator();
  const { admin, creator, course } = scenario;
  await addMember(scenario, { completed: 5, eligibleOn: lastMonthDate() });

  await request(suite.app).post(statementUrl(creator, LAST_PERIOD, 'finalize')).set(authHeader(admin.token));
  const reopened = await request(suite.app).post(statementUrl(creator, LAST_PERIOD, 'reopen')).set(authHeader(admin.token));
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.status, 'draft');
  assert.equal(reopened.body.hasPublishedVersion, true);
  assert.equal(reopened.body.finalTotal, 149.7);

  await request(suite.app)
    .put(statementUrl(creator, LAST_PERIOD))
    .set(authHeader(admin.token))
    .send({ chapters: [{ courseId: course._id.toString(), final: 200 }], note: 'Bonus added.' });

  const whileReopened = await request(suite.app).get('/api/finance/my-statements').set(authHeader(creator.token));
  assert.equal(whileReopened.body.length, 1);
  assert.equal(whileReopened.body[0].total, 149.7);
  assert.equal(whileReopened.body[0].note, '');

  const again = await request(suite.app).post(statementUrl(creator, LAST_PERIOD, 'finalize')).set(authHeader(admin.token));
  assert.equal(again.status, 200);
  assert.equal(again.body.revision, 2);

  const afterUpdate = await request(suite.app).get('/api/finance/my-statements').set(authHeader(creator.token));
  assert.equal(afterUpdate.body[0].total, 200);
  assert.equal(afterUpdate.body[0].note, 'Bonus added.');
  assert.equal(afterUpdate.body[0].updated, true);

  const types = (await Notification.find({ recipient: creator.user._id }).sort({ createdAt: 1 }).lean()).map((n) => n.type);
  assert.deepEqual(types, ['creator_statement_finalized', 'creator_statement_updated']);
  assert.equal(await CreatorStatement.countDocuments({ instructor: creator.user._id }), 1);

  const cannotReopenDraft = await request(suite.app).post(statementUrl(creator, CURRENT_PERIOD, 'reopen')).set(authHeader(admin.token));
  assert.equal(cannotReopenDraft.status, 400);
});

test('statement routes reject invalid input and non-admin access', async () => {
  const scenario = await setupCreator();
  const { admin, creator } = scenario;
  const otherCreator = await createUser({ role: 'instructor' });
  const otherCourse = await createCourse({ instructorId: otherCreator.user._id, isPublished: true });
  const member = await createUser({ role: 'student' });

  for (const token of [creator.token, member.token]) {
    const list = await request(suite.app).get(`/api/finance/statements?period=${LAST_PERIOD}`).set(authHeader(token));
    assert.equal(list.status, 403);
    const finalize = await request(suite.app).post(statementUrl(creator, LAST_PERIOD, 'finalize')).set(authHeader(token));
    assert.equal(finalize.status, 403);
  }
  const memberOwn = await request(suite.app).get('/api/finance/my-statements').set(authHeader(member.token));
  assert.equal(memberOwn.status, 403);

  const badPeriod = await request(suite.app).get('/api/finance/statements?period=2026-13').set(authHeader(admin.token));
  assert.equal(badPeriod.status, 400);

  const foreignChapter = await request(suite.app)
    .put(statementUrl(creator, LAST_PERIOD))
    .set(authHeader(admin.token))
    .send({ chapters: [{ courseId: otherCourse._id.toString(), final: 50 }] });
  assert.equal(foreignChapter.status, 400);
  assert.match(foreignChapter.body.error, /does not belong to this creator/i);

  const negative = await request(suite.app)
    .put(statementUrl(creator, LAST_PERIOD))
    .set(authHeader(admin.token))
    .send({ chapters: [{ courseId: scenario.course._id.toString(), final: -5 }] });
  assert.equal(negative.status, 400);

  const notCreator = await request(suite.app).get(statementUrl(member, LAST_PERIOD)).set(authHeader(admin.token));
  assert.equal(notCreator.status, 400);
});

test('month boundaries follow Riyadh time and only real members are counted', async () => {
  const scenario = await setupCreator();
  const { admin, creator, course } = scenario;
  const first = await addMember(scenario, { completed: 5, name: 'Edge One' });
  const second = await addMember(scenario, { completed: 5, name: 'Edge Two' });
  // 1 Sep 00:00 Riyadh is 31 Aug 21:00 UTC: the last second before it belongs to August.
  await InstructorEarning.updateMany({ user: first.user._id }, { $set: { eligibilityAt: new Date('2025-08-31T20:59:59.999Z') } });
  await InstructorEarning.updateMany({ user: second.user._id }, { $set: { eligibilityAt: new Date('2025-08-31T21:00:00.000Z') } });

  // An admin and another creator who enrolled to preview the chapter are not members.
  const previewer = await createUser({ role: 'instructor' });
  course.enrolledStudents.push(admin.user._id, previewer.user._id);
  await course.save();

  const august = await request(suite.app).get(statementUrl(creator, '2025-08')).set(authHeader(admin.token));
  const september = await request(suite.app).get(statementUrl(creator, '2025-09')).set(authHeader(admin.token));
  const october = await request(suite.app).get(statementUrl(creator, '2025-10')).set(authHeader(admin.token));
  assert.equal(august.body.calculatedTotal, 149.7);
  assert.equal(september.body.calculatedTotal, 149.7);
  assert.equal(october.body.calculatedTotal, 0);
  assert.equal(september.body.chapters[0].enrolled, 2);
  assert.equal(september.body.chapters[0].reached, 2);
  assert.equal(september.body.chapters[0].notYet, 0);
});

test('every earning lands in exactly one month and totals match the ledger to the halala', async () => {
  const scenario = await setupCreator();
  const { admin, creator } = scenario;
  const months = ['2025-03', '2025-04', '2025-05'];
  for (let i = 0; i < 7; i += 1) {
    const member = await addMember(scenario, { completed: 4 + (i % 2), name: `Ledger ${i}` });
    await InstructorEarning.updateMany(
      { user: member.user._id },
      { $set: { eligibilityAt: new Date(`${months[i % 3]}-1${i}T10:00:00.000Z`) } },
    );
  }
  await addMember(scenario, { completed: 3, name: 'Still Pending' });

  let statementMinor = 0;
  for (const month of months) {
    const res = await request(suite.app).get(statementUrl(creator, month)).set(authHeader(admin.token));
    statementMinor += Math.round(res.body.calculatedTotal * 100);
  }
  const ledger = await InstructorEarning.find({ instructor: creator.user._id, status: 'eligible' }).lean();
  assert.equal(ledger.length, 7);
  assert.equal(statementMinor, ledger.reduce((sum, earning) => sum + earning.eligibleMinor, 0));
  assert.equal(statementMinor, 7 * 14970);
});

test('held earnings are excluded, and refunds after finalization are flagged for review', async () => {
  const scenario = await setupCreator();
  const { admin, creator } = scenario;
  const kept = await addMember(scenario, { completed: 5, eligibleOn: lastMonthDate(), name: 'Kept' });
  const held = await addMember(scenario, { completed: 5, eligibleOn: lastMonthDate(), name: 'Held' });
  const heldEarning = await InstructorEarning.findOne({ user: held.user._id });
  await request(suite.app)
    .patch('/api/finance/earnings/bulk')
    .set(authHeader(admin.token))
    .send({ earningIds: [heldEarning._id.toString()], action: 'hold', reason: 'Under dispute' });

  const draft = await request(suite.app).get(statementUrl(creator, LAST_PERIOD)).set(authHeader(admin.token));
  assert.equal(draft.body.calculatedTotal, 149.7);
  assert.equal(draft.body.heldTotal, 149.7);

  const finalized = await request(suite.app)
    .post(statementUrl(creator, LAST_PERIOD, 'finalize'))
    .set(authHeader(admin.token))
    .send({ expectedTotal: 149.7 });
  assert.equal(finalized.status, 200);
  assert.equal(finalized.body.calculationChanged, false);

  // Half of the kept member's payment is refunded after the statement was published.
  const keptEarning = await InstructorEarning.findOne({ user: kept.user._id }).populate('financeTransaction');
  const refund = await request(suite.app)
    .post('/api/finance/chargebacks')
    .set(authHeader(admin.token))
    .send({ paymentId: keptEarning.financeTransaction.payment.toString(), amount: 249.5 });
  assert.equal(refund.status, 200);

  const after = await request(suite.app).get(statementUrl(creator, LAST_PERIOD)).set(authHeader(admin.token));
  assert.equal(after.body.status, 'finalized');
  assert.equal(after.body.finalTotal, 149.7);
  assert.equal(after.body.calculationChanged, true);
  assert.equal(after.body.currentCalculatedTotal, 74.85);
  // The creator's published statement never changes on its own.
  const creatorView = await request(suite.app).get('/api/finance/my-statements').set(authHeader(creator.token));
  assert.equal(creatorView.body[0].total, 149.7);
});

test('finalize refuses a stale total, a double submit, and amounts it would have to round', async () => {
  const scenario = await setupCreator();
  const { admin, creator, course } = scenario;
  await addMember(scenario, { completed: 5, eligibleOn: lastMonthDate() });

  const stale = await request(suite.app)
    .post(statementUrl(creator, LAST_PERIOD, 'finalize'))
    .set(authHeader(admin.token))
    .send({ expectedTotal: 100 });
  assert.equal(stale.status, 400);
  assert.match(stale.body.error, /changed since you opened it/i);
  assert.equal(await CreatorStatement.countDocuments({ status: 'finalized' }), 0);

  const rounded = await request(suite.app)
    .put(statementUrl(creator, LAST_PERIOD))
    .set(authHeader(admin.token))
    .send({ chapters: [{ courseId: course._id.toString(), final: 10.005 }] });
  assert.equal(rounded.status, 400);
  assert.match(rounded.body.error, /two decimal places/i);

  // The suite drops the database between tests, which also drops the unique index that
  // production always has; rebuild it so the race is tested under real conditions.
  await CreatorStatement.createIndexes();
  const send = () => request(suite.app)
    .post(statementUrl(creator, LAST_PERIOD, 'finalize'))
    .set(authHeader(admin.token))
    .send({ expectedTotal: 149.7 });
  const results = await Promise.all([send(), send(), send()]);
  assert.equal(results.filter((res) => res.status === 200).length, 1);
  assert.equal(await CreatorStatement.countDocuments({ instructor: creator.user._id }), 1);
  assert.equal(await Notification.countDocuments({ recipient: creator.user._id }), 1);
  const stored = await CreatorStatement.findOne({ instructor: creator.user._id }).lean();
  assert.equal(stored.revision, 1);
  assert.equal(stored.published.finalTotalMinor, 14970);
});

test('statement keeps the revenue of a chapter that was deleted afterwards', async () => {
  const scenario = await setupCreator();
  const { admin, creator, course } = scenario;
  await addMember(scenario, { completed: 5, eligibleOn: lastMonthDate() });
  const deleted = await request(suite.app).delete(`/api/courses/${course._id}`).set(authHeader(admin.token));
  assert.equal(deleted.status, 200);

  const res = await request(suite.app).get(statementUrl(creator, LAST_PERIOD)).set(authHeader(admin.token));
  assert.equal(res.body.calculatedTotal, 149.7);
  assert.equal(res.body.chapters[0].title, 'Chapter A (deleted)');
});
