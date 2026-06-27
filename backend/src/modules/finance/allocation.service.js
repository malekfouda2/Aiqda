import AllocationConfig from './allocationConfig.model.js';
import Course from '../courses/course.model.js';
import { SubscriptionPackage } from '../subscriptions/subscription.model.js';
import { FULL_BPS } from './finance.money.js';
import { recordFinanceAudit } from './audit.service.js';

// Split FULL_BPS evenly across `count` courses (largest-remainder so the parts sum to exactly 10000).
const equalBps = (count) => {
  if (count <= 0) return [];
  const base = Math.floor(FULL_BPS / count);
  const parts = new Array(count).fill(base);
  let remainder = FULL_BPS - base * count;
  for (let i = 0; i < count && remainder > 0; i += 1) {
    parts[i] += 1;
    remainder -= 1;
  }
  return parts;
};

const activeAtClause = (at) => ({
  status: 'active',
  effectiveStart: { $lte: at },
  $or: [{ effectiveEnd: null }, { effectiveEnd: { $gt: at } }],
});

// Returns [{ course, instructor, allocationBps }] for a package's chapters at time `at`.
// If the package has any active admin allocation config, those weights are used (chapters
// without a config get 0 bps → unallocated remainder stays with the platform).
// Otherwise it defaults to an equal split across the package's courses.
export const resolveAllocationsForPackageAt = async (packageId, at = new Date()) => {
  const pkg = await SubscriptionPackage.findById(packageId).select('courses').lean();
  const courseIds = (pkg?.courses || []).map((id) => id.toString());
  if (courseIds.length === 0) {
    return [];
  }

  const courses = await Course.find({ _id: { $in: courseIds } }).select('instructor').lean();
  const instructorByCourse = new Map(courses.map((c) => [c._id.toString(), c.instructor]));

  const activeConfigs = await AllocationConfig.find({
    subscriptionPackage: packageId,
    course: { $in: courseIds },
    ...activeAtClause(at),
  }).lean();

  if (activeConfigs.length > 0) {
    const bpsByCourse = new Map(activeConfigs.map((c) => [c.course.toString(), c.percentageBps]));
    const instructorOverride = new Map(activeConfigs.map((c) => [c.course.toString(), c.instructor]));
    return courseIds.map((courseId) => ({
      course: courseId,
      instructor: instructorOverride.get(courseId) || instructorByCourse.get(courseId) || null,
      allocationBps: bpsByCourse.get(courseId) || 0,
    }));
  }

  const parts = equalBps(courseIds.length);
  return courseIds.map((courseId, index) => ({
    course: courseId,
    instructor: instructorByCourse.get(courseId) || null,
    allocationBps: parts[index],
  }));
};

export const listAllocations = async (packageId = null) => {
  const query = { status: 'active' };
  if (packageId) query.subscriptionPackage = packageId;
  return AllocationConfig.find(query)
    .populate('course', 'title')
    .populate('instructor', 'name email')
    .sort({ subscriptionPackage: 1, createdAt: -1 })
    .lean();
};

// Replace the active allocation set for a package. entries: [{ course, instructor?, percentageBps }].
// Validates the total <= 100%, supersedes prior active configs, and creates new active versions.
export const saveAllocations = async (packageId, entries, actor = null) => {
  const normalized = (entries || []).map((entry) => ({
    course: entry.course,
    instructor: entry.instructor || null,
    percentageBps: Math.round(Number(entry.percentageBps || 0)),
  }));

  for (const entry of normalized) {
    if (!entry.course) throw new Error('Each allocation entry requires a course.');
    if (entry.percentageBps < 0 || entry.percentageBps > FULL_BPS) {
      throw new Error('Allocation percentage must be between 0% and 100%.');
    }
  }

  const total = normalized.reduce((acc, entry) => acc + entry.percentageBps, 0);
  if (total > FULL_BPS) {
    throw new Error('Total chapter allocation cannot exceed 100%.');
  }

  const now = new Date();
  const actorId = actor?.id || actor?._id || null;

  // Supersede currently-active configs for this package.
  await AllocationConfig.updateMany(
    { subscriptionPackage: packageId, status: 'active' },
    { $set: { status: 'superseded', effectiveEnd: now } },
  );

  const created = [];
  for (const entry of normalized) {
    const doc = await AllocationConfig.create({
      subscriptionPackage: packageId,
      course: entry.course,
      instructor: entry.instructor,
      percentageBps: entry.percentageBps,
      effectiveStart: now,
      status: 'active',
      createdBy: actorId,
      audit: [{ action: 'created', actor: actorId, at: now }],
    });
    created.push(doc);
  }

  await recordFinanceAudit({
    actorType: actor ? 'admin' : 'system',
    actorId,
    action: 'allocation.updated',
    targetType: 'SubscriptionPackage',
    targetId: packageId,
    newState: { entries: normalized, totalBps: total },
  });

  return created;
};
