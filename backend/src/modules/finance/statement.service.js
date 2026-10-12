import mongoose from 'mongoose';
import Course from '../courses/course.model.js';
import Lesson from '../lessons/lesson.model.js';
import User from '../users/user.model.js';
import { LessonProgress } from '../analytics/progress.model.js';
import InstructorEarning from './instructorEarning.model.js';
import CreatorStatement from './creatorStatement.model.js';
import {
  toMinor, fromMinor, FULL_BPS, COMPLETION_THRESHOLD_BPS,
} from './finance.money.js';
import { recordFinanceAudit } from './audit.service.js';
import { notify } from '../notifications/notify.js';
import { sendEmail } from '../../utils/email.js';
import { buildCreatorStatementFinalizedEmail } from '../../utils/emailTemplates.js';

// Statement months follow the platform's business timezone (Asia/Riyadh, UTC+3, no DST).
const BUSINESS_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
const EXCLUDED_EARNING_STATUSES = ['pending_completion', 'voided', 'reversed'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const toId = (value) => (value?._id || value)?.toString();
const actorIdOf = (actor) => actor?.id || actor?._id || null;

const parsePeriod = (period) => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(period || ''));
  if (!match) throw new Error('Period must be a month in YYYY-MM format.');
  return { year: Number(match[1]), month: Number(match[2]) };
};

// [start, end) of a statement month as UTC instants.
export const periodBounds = (period) => {
  const { year, month } = parsePeriod(period);
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - BUSINESS_UTC_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - BUSINESS_UTC_OFFSET_MS),
  };
};

export const periodLabel = (period, arabic = false) => {
  const { year, month } = parsePeriod(period);
  return `${(arabic ? MONTH_NAMES_AR : MONTH_NAMES)[month - 1]} ${year}`;
};

const hasPeriodEnded = (period, now = new Date()) => periodBounds(period).end <= now;

const assertInstructorId = (instructorId) => {
  if (!mongoose.isValidObjectId(instructorId)) throw new Error('Creator not found.');
};

// Enrolled / reached-80% / not-yet counts for one chapter, as of now. Uses the same
// completion maths as eligibility.service.js. Returns numbers only.
const countChapterMembers = async (course) => {
  const enrolledIds = course.enrolledStudents || [];
  const enrolledCount = enrolledIds.length;
  if (enrolledCount === 0) return { enrolledCount: 0, reachedCount: 0, notYetCount: 0 };

  const publishedLessons = await Lesson.find({ course: course._id, isPublished: true }).select('_id').lean();
  const totalRequired = publishedLessons.length;
  if (totalRequired === 0) return { enrolledCount, reachedCount: 0, notYetCount: enrolledCount };

  const completedByMember = await LessonProgress.aggregate([
    {
      $match: {
        course: course._id,
        isQualified: true,
        user: { $in: enrolledIds },
        lesson: { $in: publishedLessons.map((lesson) => lesson._id) },
      },
    },
    { $group: { _id: '$user', completed: { $sum: 1 } } },
  ]);
  const reachedCount = completedByMember.filter((row) => (
    Math.floor((row.completed / totalRequired) * FULL_BPS) >= COMPLETION_THRESHOLD_BPS
  )).length;

  return { enrolledCount, reachedCount, notYetCount: enrolledCount - reachedCount };
};

// Live calculation of a creator's month: money from earnings whose member reached the
// completion threshold inside the month, plus current member counts per chapter.
const computeChapters = async (instructorId, period) => {
  const { start, end } = periodBounds(period);
  const earningRows = await InstructorEarning.aggregate([
    {
      $match: {
        instructor: new mongoose.Types.ObjectId(toId(instructorId)),
        eligibilityAt: { $gte: start, $lt: end },
        status: { $nin: EXCLUDED_EARNING_STATUSES },
      },
    },
    { $group: { _id: '$course', calculatedMinor: { $sum: '$eligibleMinor' } } },
  ]);
  const calculatedByCourse = new Map(earningRows.map((row) => [toId(row._id), row.calculatedMinor]));

  const courses = await Course.find({
    $or: [{ instructor: instructorId }, { _id: { $in: earningRows.map((row) => row._id) } }],
  }).select('title enrolledStudents createdAt').sort({ createdAt: 1 }).lean();

  const chapters = [];
  for (const course of courses) {
    const courseId = toId(course._id);
    chapters.push({
      course: course._id,
      courseTitleSnapshot: course.title || '',
      calculatedMinor: calculatedByCourse.get(courseId) || 0,
      ...(await countChapterMembers(course)),
    });
    calculatedByCourse.delete(courseId);
  }
  // Earnings of chapters that were deleted since still belong on the statement.
  for (const [courseId, calculatedMinor] of calculatedByCourse) {
    chapters.push({
      course: new mongoose.Types.ObjectId(courseId),
      courseTitleSnapshot: 'Deleted chapter',
      calculatedMinor,
      enrolledCount: 0,
      reachedCount: 0,
      notYetCount: 0,
    });
  }
  return chapters;
};

const applyOverrides = (chapters, overrides = []) => {
  const overrideByCourse = new Map(overrides.map((entry) => [toId(entry.course), entry.finalMinor]));
  return chapters.map((chapter) => ({
    ...chapter,
    finalMinor: overrideByCourse.has(toId(chapter.course))
      ? overrideByCourse.get(toId(chapter.course))
      : chapter.calculatedMinor,
  }));
};

const sumMinor = (chapters, field) => chapters.reduce((acc, chapter) => acc + (chapter[field] || 0), 0);

const serializeChapter = (chapter) => ({
  courseId: toId(chapter.course),
  title: chapter.courseTitleSnapshot,
  enrolled: chapter.enrolledCount,
  reached: chapter.reachedCount,
  notYet: chapter.notYetCount,
  calculated: fromMinor(chapter.calculatedMinor),
  final: fromMinor(chapter.finalMinor),
  edited: chapter.finalMinor !== chapter.calculatedMinor,
});

// Admin view of one creator's month. Finalized statements are returned exactly as frozen.
const buildAdminView = async (instructor, period, doc) => {
  const finalized = doc?.status === 'finalized';
  const chapters = finalized
    ? doc.published.chapters
    : applyOverrides(await computeChapters(instructor._id, period), doc?.overrides);

  return {
    instructorId: toId(instructor._id),
    name: instructor.name || '',
    email: instructor.email || '',
    period,
    periodLabel: periodLabel(period),
    currency: doc?.currency || 'SAR',
    status: doc?.status || 'draft',
    revision: doc?.revision || 0,
    note: doc?.note || '',
    finalizedAt: finalized ? doc.finalizedAt : null,
    hasPublishedVersion: Boolean(doc?.published),
    canFinalize: !finalized && hasPeriodEnded(period),
    chapters: chapters.map(serializeChapter),
    calculatedTotal: fromMinor(sumMinor(chapters, 'calculatedMinor')),
    finalTotal: fromMinor(sumMinor(chapters, 'finalMinor')),
  };
};

const findInstructor = async (instructorId) => {
  assertInstructorId(instructorId);
  const instructor = await User.findById(instructorId).select('name email role').lean();
  if (!instructor || instructor.role !== 'instructor') throw new Error('Creator not found.');
  return instructor;
};

// Every creator for the month: those owning chapters, with earnings in the month, or with a saved statement.
export const listStatements = async (period) => {
  const { start, end } = periodBounds(period);
  const [courseOwners, earningOwners, docs] = await Promise.all([
    Course.distinct('instructor'),
    InstructorEarning.distinct('instructor', { eligibilityAt: { $gte: start, $lt: end } }),
    CreatorStatement.find({ period }).lean(),
  ]);
  const docByInstructor = new Map(docs.map((doc) => [toId(doc.instructor), doc]));
  const instructorIds = [...new Set([...courseOwners, ...earningOwners, ...docs.map((doc) => doc.instructor)].map(toId))];
  const instructors = await User.find({ _id: { $in: instructorIds }, role: 'instructor' })
    .select('name email')
    .sort({ name: 1 })
    .lean();

  const statements = [];
  for (const instructor of instructors) {
    statements.push(await buildAdminView(instructor, period, docByInstructor.get(toId(instructor._id))));
  }
  return { period, periodLabel: periodLabel(period), periodEnded: hasPeriodEnded(period), statements };
};

export const getStatement = async (instructorId, period) => {
  const instructor = await findInstructor(instructorId);
  parsePeriod(period);
  const doc = await CreatorStatement.findOne({ instructor: instructorId, period }).lean();
  return buildAdminView(instructor, period, doc);
};

// Save the admin's per-chapter amounts and note on a draft statement.
// chapters: [{ courseId, final }] in decimal SAR. Amounts equal to the calculated value are not stored
// as overrides, so they keep following the calculation until the statement is finalized.
export const saveStatementDraft = async (instructorId, period, { chapters = [], note = '' } = {}, actor = null) => {
  const instructor = await findInstructor(instructorId);
  const existing = await CreatorStatement.findOne({ instructor: instructorId, period });
  if (existing?.status === 'finalized') {
    throw new Error('This statement is finalized. Reopen it before editing.');
  }

  const computed = await computeChapters(instructorId, period);
  const calculatedByCourse = new Map(computed.map((chapter) => [toId(chapter.course), chapter.calculatedMinor]));
  const overrides = [];
  for (const entry of Array.isArray(chapters) ? chapters : []) {
    const courseId = toId(entry?.courseId);
    if (!calculatedByCourse.has(courseId)) {
      throw new Error('A chapter in this statement does not belong to this creator.');
    }
    const amount = Number(entry.final);
    if (entry.final === '' || entry.final == null || !Number.isFinite(amount) || amount < 0) {
      throw new Error('Chapter amounts must be zero or a positive number.');
    }
    const finalMinor = toMinor(amount);
    if (finalMinor !== calculatedByCourse.get(courseId)) {
      overrides.push({ course: courseId, finalMinor });
    }
  }

  const oldState = existing ? { overrides: existing.toObject().overrides, note: existing.note } : null;
  const doc = existing || new CreatorStatement({ instructor: instructorId, period });
  doc.overrides = overrides;
  doc.note = String(note || '').trim();
  await doc.save();

  await recordFinanceAudit({
    actorType: actor ? 'admin' : 'system',
    actorId: actorIdOf(actor),
    action: 'statement.edited',
    targetType: 'CreatorStatement',
    targetId: doc._id,
    oldState,
    newState: { overrides, note: doc.note },
    relatedRef: period,
  });

  return buildAdminView(instructor, period, doc.toObject());
};

// Tell the creator their month is final. Never throws back into the finalize flow.
const announceStatement = async (instructor, period, totalMinor, currency, updated) => {
  const totalLabel = `${fromMinor(totalMinor).toFixed(2)} ${currency}`;
  const label = periodLabel(period);
  const labelAr = periodLabel(period, true);

  await notify.user(instructor._id, {
    type: updated ? 'creator_statement_updated' : 'creator_statement_finalized',
    title: updated ? 'Revenue statement updated' : 'Revenue statement finalized',
    titleAr: updated ? 'تم تحديث كشف الإيرادات' : 'تم اعتماد كشف الإيرادات',
    message: updated
      ? `We have updated the calculation of your revenue for ${label}: ${totalLabel}.`
      : `We have finalized the calculation of your revenue for ${label}: ${totalLabel}.`,
    messageAr: updated
      ? `قمنا بتحديث حساب إيراداتك عن شهر ${labelAr}: ${totalLabel}.`
      : `انتهينا من حساب إيراداتك عن شهر ${labelAr}: ${totalLabel}.`,
    link: '/creator',
    metadata: { period },
  });

  if (!instructor.email) return;
  try {
    const template = buildCreatorStatementFinalizedEmail({
      fullName: instructor.name || 'Creator',
      periodLabel: label,
      totalLabel,
      updated,
    });
    await sendEmail({
      to: instructor.email, subject: template.subject, text: template.text, html: template.html,
    });
  } catch (error) {
    console.error('Failed to send creator statement email:', error?.message || error);
  }
};

// Freeze the month and publish it to the creator.
export const finalizeStatement = async (instructorId, period, actor = null) => {
  const instructor = await findInstructor(instructorId);
  if (!hasPeriodEnded(period)) {
    throw new Error('A statement can only be finalized after its month has ended.');
  }

  const doc = await CreatorStatement.findOne({ instructor: instructorId, period })
    || new CreatorStatement({ instructor: instructorId, period });
  if (doc.status === 'finalized') throw new Error('This statement is already finalized.');

  const chapters = applyOverrides(await computeChapters(instructorId, period), doc.overrides);
  const finalTotalMinor = sumMinor(chapters, 'finalMinor');
  const updated = Boolean(doc.published);
  const previousTotalMinor = doc.published?.finalTotalMinor ?? null;

  doc.status = 'finalized';
  doc.revision = (doc.revision || 0) + 1;
  doc.finalizedAt = new Date();
  doc.finalizedBy = actorIdOf(actor);
  doc.published = {
    chapters,
    finalTotalMinor,
    note: doc.note,
    finalizedAt: doc.finalizedAt,
    revision: doc.revision,
  };
  await doc.save();

  await recordFinanceAudit({
    actorType: actor ? 'admin' : 'system',
    actorId: actorIdOf(actor),
    action: 'statement.finalized',
    targetType: 'CreatorStatement',
    targetId: doc._id,
    oldState: updated ? { finalTotalMinor: previousTotalMinor } : null,
    newState: {
      revision: doc.revision,
      finalTotalMinor,
      calculatedTotalMinor: sumMinor(chapters, 'calculatedMinor'),
      note: doc.note,
    },
    relatedRef: period,
  });

  await announceStatement(instructor, period, finalTotalMinor, doc.currency, updated);
  return buildAdminView(instructor, period, doc.toObject());
};

// Put a finalized statement back into draft. The creator keeps seeing the published version.
export const reopenStatement = async (instructorId, period, actor = null) => {
  const instructor = await findInstructor(instructorId);
  const doc = await CreatorStatement.findOne({ instructor: instructorId, period });
  if (!doc || doc.status !== 'finalized') throw new Error('Only a finalized statement can be reopened.');

  // Carry the finalized amounts into the draft so reopening never silently changes them.
  doc.overrides = doc.published.chapters.map((chapter) => ({
    course: chapter.course, finalMinor: chapter.finalMinor,
  }));
  doc.status = 'draft';
  await doc.save();

  await recordFinanceAudit({
    actorType: actor ? 'admin' : 'system',
    actorId: actorIdOf(actor),
    action: 'statement.reopened',
    targetType: 'CreatorStatement',
    targetId: doc._id,
    oldState: { status: 'finalized', revision: doc.revision },
    newState: { status: 'draft' },
    relatedRef: period,
  });

  return buildAdminView(instructor, period, doc.toObject());
};

// Creator view: finalized months only, money plus anonymous member counts.
export const listPublishedForInstructor = async (instructorId) => {
  const docs = await CreatorStatement.find({ instructor: instructorId, published: { $ne: null } })
    .sort({ period: -1 })
    .lean();

  return docs.map((doc) => ({
    period: doc.period,
    periodLabel: periodLabel(doc.period),
    periodLabelAr: periodLabel(doc.period, true),
    currency: doc.currency || 'SAR',
    total: fromMinor(doc.published.finalTotalMinor),
    note: doc.published.note || '',
    finalizedAt: doc.published.finalizedAt,
    updated: doc.published.revision > 1,
    chapters: doc.published.chapters.map((chapter) => ({
      courseId: toId(chapter.course),
      title: chapter.courseTitleSnapshot,
      amount: fromMinor(chapter.finalMinor),
      enrolled: chapter.enrolledCount,
      reached: chapter.reachedCount,
      notYet: chapter.notYetCount,
    })),
  }));
};
