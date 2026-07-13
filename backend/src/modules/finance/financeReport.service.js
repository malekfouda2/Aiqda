import FinanceTransaction from './financeTransaction.model.js';
import InstructorEarning from './instructorEarning.model.js';
import User from '../users/user.model.js';
import { fromMinor, applyBps, INSTRUCTOR_POOL_BPS, PLATFORM_BPS } from './finance.money.js';
import { getSettingsDoc, getExpensesTotalMinor } from './financeSettings.service.js';

const dateMatch = (from, to, field = 'createdAt') => {
  const clause = {};
  if (from) clause.$gte = new Date(from);
  if (to) clause.$lte = new Date(to);
  return Object.keys(clause).length ? { [field]: clause } : {};
};

const sumField = (rows, field) => rows.reduce((acc, r) => acc + (r[field] || 0), 0);

// High-level financial overview. All returned amounts are decimal SAR.
export const getOverview = async ({ from = null, to = null } = {}) => {
  const txnMatch = { parentTransaction: null, ...dateMatch(from, to, 'paidAt') };
  const rootTxns = await FinanceTransaction.find(txnMatch).lean();
  const reversalTxns = await FinanceTransaction.find({
    parentTransaction: { $ne: null }, ...dateMatch(from, to, 'paidAt'),
  }).lean();

  const grossMinor = sumField(rootTxns, 'grossPaidMinor');
  const gatewayFeeMinor = sumField(rootTxns, 'gatewayFeeMinor');
  const discountMinor = sumField(rootTxns, 'discountMinor');
  const refundedMinor = sumField(reversalTxns, 'refundedMinor');
  const chargebackMinor = sumField(reversalTxns, 'chargebackMinor');

  const earnings = await InstructorEarning.find().lean();
  const live = earnings.filter((e) => !['voided'].includes(e.status));
  const unpaidPayable = (e) => Math.max(0, (e.approvedMinor || 0) - (e.paidMinor || 0));
  const eligibleUnpaid = (e) => Math.max(0, (e.eligibleMinor || 0) - (e.paidMinor || 0));

  const maxExposureMinor = applyBps(grossMinor, INSTRUCTOR_POOL_BPS);
  const pendingPotentialMinor = sumField(live.filter((e) => e.status === 'pending_completion'), 'maxPotentialMinor');
  const eligibleLiabilityMinor = live
    .filter((e) => ['eligible', 'approved_for_payout', 'partially_paid'].includes(e.status))
    .reduce((acc, e) => acc + eligibleUnpaid(e), 0);
  const approvedUnpaidMinor = live
    .filter((e) => ['approved_for_payout', 'partially_paid'].includes(e.status))
    .reduce((acc, e) => acc + unpaidPayable(e), 0);
  const paidMinor = sumField(earnings, 'paidMinor');
  const recoveryMinor = sumField(earnings, 'recoveryMinor');
  const platformGrossMinor = applyBps(grossMinor, PLATFORM_BPS);

  // Admin-entered platform costs (bank transfer fee + itemized expenses), deducted
  // from net/platform cash.
  const settings = await getSettingsDoc();
  const bankFeeMinor = settings.bankFeeMinor || 0;
  const expensesTotalMinor = getExpensesTotalMinor(settings);
  const manualFeeMinor = bankFeeMinor + expensesTotalMinor;

  return {
    grossPaid: fromMinor(grossMinor),
    discounts: fromMinor(discountMinor),
    gatewayFees: fromMinor(gatewayFeeMinor),
    bankFees: fromMinor(bankFeeMinor),
    expenses: (settings.expenses || []).map((e) => ({ label: e.label, amount: fromMinor(e.amountMinor) })),
    expensesTotal: fromMinor(expensesTotalMinor),
    refunds: fromMinor(refundedMinor),
    chargebacks: fromMinor(chargebackMinor),
    netCashAfterFees: fromMinor(grossMinor - gatewayFeeMinor - manualFeeMinor - refundedMinor - chargebackMinor),
    maxInstructorExposure: fromMinor(maxExposureMinor),
    pendingInstructorPotential: fromMinor(pendingPotentialMinor),
    eligibleInstructorLiability: fromMinor(eligibleLiabilityMinor),
    approvedUnpaid: fromMinor(approvedUnpaidMinor),
    actualInstructorPayouts: fromMinor(paidMinor),
    instructorRecoveryBalances: fromMinor(recoveryMinor),
    platformGrossShare: fromMinor(platformGrossMinor),
    platformCashAfterFeesAndLiabilities: fromMinor(grossMinor - gatewayFeeMinor - manualFeeMinor - eligibleLiabilityMinor),
    platformCashAfterPayouts: fromMinor(grossMinor - gatewayFeeMinor - manualFeeMinor - paidMinor),
    currency: 'SAR',
  };
};

const summarizeEarnings = (rows) => ({
  maxPotential: fromMinor(sumField(rows.filter((e) => e.status !== 'voided'), 'maxPotentialMinor')),
  eligible: fromMinor(sumField(rows.filter((e) => ['eligible', 'approved_for_payout', 'partially_paid'].includes(e.status)), 'eligibleMinor')),
  approvedUnpaid: fromMinor(rows.filter((e) => ['approved_for_payout', 'partially_paid'].includes(e.status)).reduce((a, e) => a + Math.max(0, (e.approvedMinor || 0) - (e.paidMinor || 0)), 0)),
  paid: fromMinor(sumField(rows, 'paidMinor')),
  recovery: fromMinor(sumField(rows, 'recoveryMinor')),
});

export const getRevenueByInstructor = async () => {
  const earnings = await InstructorEarning.find().lean();
  const byInstructor = new Map();
  for (const e of earnings) {
    const key = e.instructor.toString();
    if (!byInstructor.has(key)) byInstructor.set(key, []);
    byInstructor.get(key).push(e);
  }
  const instructorIds = [...byInstructor.keys()];
  const users = await User.find({ _id: { $in: instructorIds } }).select('name email').lean();
  const nameById = new Map(users.map((u) => [u._id.toString(), u]));
  return instructorIds.map((id) => ({
    instructor: id,
    name: nameById.get(id)?.name || 'Unknown',
    email: nameById.get(id)?.email || '',
    ...summarizeEarnings(byInstructor.get(id)),
  }));
};

export const getInstructorProfile = async (instructorId) => {
  const earnings = await InstructorEarning.find({ instructor: instructorId })
    .populate('user', 'name email')
    .populate('course', 'title')
    .populate('financeTransaction', 'currency paidAt')
    .sort({ createdAt: -1 })
    .lean();

  const user = await User.findById(instructorId).select('name email assignedPackages').lean();

  return {
    instructor: { id: instructorId, name: user?.name || '', email: user?.email || '' },
    summary: summarizeEarnings(earnings),
    ledger: earnings.map((e) => ({
      id: e._id,
      learner: e.user?.name || '',
      course: e.course?.title || '',
      paidAt: e.financeTransaction?.paidAt || e.createdAt,
      maxPotential: fromMinor(e.maxPotentialMinor),
      allocationBps: e.allocationBpsSnapshot,
      completion: e.totalRequired > 0 ? Math.round((e.completedRequired / e.totalRequired) * 100) : 0,
      eligibilityAt: e.eligibilityAt,
      status: e.status,
      paid: fromMinor(e.paidMinor),
      remaining: fromMinor(Math.max(0, (e.approvedMinor || 0) - (e.paidMinor || 0))),
      recovery: fromMinor(e.recoveryMinor),
    })),
  };
};

// Earnings queue with filters.
export const queryEarnings = async (filters = {}) => {
  const query = {};
  if (filters.instructor) query.instructor = filters.instructor;
  if (filters.course) query.course = filters.course;
  if (filters.learner) query.user = filters.learner;
  if (filters.status) query.status = filters.status;
  if (filters.paid === 'paid') query.paidMinor = { $gt: 0 };
  if (filters.paid === 'unpaid') query.paidMinor = { $lte: 0 };
  Object.assign(query, dateMatch(filters.from, filters.to, 'createdAt'));

  let rows = await InstructorEarning.find(query)
    .populate('user', 'name email')
    .populate('instructor', 'name email')
    .populate('course', 'title')
    .sort({ createdAt: -1 })
    .limit(Number(filters.limit) || 500)
    .lean();

  if (filters.minAmount) rows = rows.filter((e) => fromMinor(e.maxPotentialMinor) >= Number(filters.minAmount));
  if (filters.maxAmount) rows = rows.filter((e) => fromMinor(e.maxPotentialMinor) <= Number(filters.maxAmount));

  return rows.map((e) => ({
    id: e._id,
    instructorId: e.instructor?._id || e.instructor,
    instructor: e.instructor?.name || '',
    learner: e.user?.name || '',
    course: e.course?.title || '',
    maxPotential: fromMinor(e.maxPotentialMinor),
    eligible: fromMinor(e.eligibleMinor),
    approved: fromMinor(e.approvedMinor),
    paid: fromMinor(e.paidMinor),
    recovery: fromMinor(e.recoveryMinor),
    completion: e.totalRequired > 0 ? Math.round((e.completedRequired / e.totalRequired) * 100) : 0,
    status: e.status,
    createdAt: e.createdAt,
  }));
};

const csvEscape = (value) => {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

export const exportEarningsCsv = async (filters = {}) => {
  const rows = await queryEarnings(filters);
  const header = ['Instructor', 'Learner', 'Chapter', 'MaxPotential', 'Eligible', 'Approved', 'Paid', 'Recovery', 'Completion%', 'Status', 'Date'];
  const lines = rows.map((r) => [
    r.instructor, r.learner, r.course, r.maxPotential, r.eligible, r.approved, r.paid, r.recovery, r.completion, r.status,
    new Date(r.createdAt).toISOString(),
  ].map(csvEscape).join(','));
  return [header.join(','), ...lines].join('\n');
};
