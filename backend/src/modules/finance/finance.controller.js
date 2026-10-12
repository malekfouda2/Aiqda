import * as report from './financeReport.service.js';
import * as payout from './payout.service.js';
import * as recovery from './recovery.service.js';
import { getAuditLog } from './audit.service.js';
import * as financeSettings from './financeSettings.service.js';
import * as statement from './statement.service.js';
import InstructorEarning from './instructorEarning.model.js';
import { fromMinor } from './finance.money.js';

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getOverview = handle(async (req, res) => {
  const [summary, byInstructor] = await Promise.all([
    report.getOverview({ from: req.query.from, to: req.query.to }),
    report.getRevenueByInstructor(),
  ]);
  res.json({ summary, byInstructor });
});

export const getSettings = handle(async (req, res) => {
  res.json(await financeSettings.getSettings());
});

export const updateSettings = handle(async (req, res) => {
  const updated = await financeSettings.updateSettings({
    bankFee: req.body.bankFee,
    expenses: req.body.expenses,
    actorId: req.user?._id || null,
  });
  res.json(updated);
});

export const getInstructorProfile = handle(async (req, res) => {
  res.json(await report.getInstructorProfile(req.params.id));
});

export const getEarnings = handle(async (req, res) => {
  res.json(await report.queryEarnings(req.query));
});

export const bulkEarnings = handle(async (req, res) => {
  const { earningIds, action, reason } = req.body;
  const touched = await payout.bulkUpdateEarnings(earningIds, action, req.user, reason);
  res.json({ updated: touched.length });
});

export const getPayoutBatches = handle(async (req, res) => {
  res.json(await payout.listBatches(req.query.instructor || null));
});

export const createPayoutBatch = handle(async (req, res) => {
  res.status(201).json(await payout.createBatch(req.body.instructor, req.body.earningIds, req.user));
});

export const approvePayoutBatch = handle(async (req, res) => {
  res.json(await payout.approveBatch(req.params.id, req.user));
});

export const settlePayoutBatch = handle(async (req, res) => {
  res.json(await payout.settleBatch(req.params.id, req.body, req.user));
});

export const cancelPayoutBatch = handle(async (req, res) => {
  res.json(await payout.cancelBatch(req.params.id, req.user));
});

export const recordChargeback = handle(async (req, res) => {
  const result = await recovery.handlePaymentReversal(
    { _id: req.body.paymentId },
    { reversedAmount: req.body.amount ?? null, kind: 'chargeback' },
  );
  res.json(result || { affected: 0 });
});

export const getRecoveries = handle(async (req, res) => {
  const rows = await InstructorEarning.find({ recoveryMinor: { $gt: 0 } })
    .populate('instructor', 'name email')
    .populate('course', 'title')
    .sort({ updatedAt: -1 })
    .lean();
  res.json(rows.map((e) => ({
    id: e._id,
    instructor: e.instructor?.name || '',
    course: e.course?.title || '',
    recovery: fromMinor(e.recoveryMinor),
    status: e.status,
  })));
});

export const getAudit = handle(async (req, res) => {
  res.json(await getAuditLog(req.query));
});

export const exportEarnings = handle(async (req, res) => {
  const csv = await report.exportEarningsCsv(req.query);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="earnings.csv"');
  res.send(csv);
});

export const getMyStatements = handle(async (req, res) => {
  res.json(await statement.listPublishedForInstructor(req.user.id));
});

export const getStatements = handle(async (req, res) => {
  res.json(await statement.listStatements(req.query.period));
});

export const getStatement = handle(async (req, res) => {
  res.json(await statement.getStatement(req.params.instructorId, req.params.period));
});

export const saveStatement = handle(async (req, res) => {
  res.json(await statement.saveStatementDraft(
    req.params.instructorId,
    req.params.period,
    { chapters: req.body.chapters, note: req.body.note },
    req.user,
  ));
});

export const finalizeStatement = handle(async (req, res) => {
  res.json(await statement.finalizeStatement(
    req.params.instructorId,
    req.params.period,
    req.user,
    { expectedTotal: req.body?.expectedTotal ?? null },
  ));
});

export const reopenStatement = handle(async (req, res) => {
  res.json(await statement.reopenStatement(req.params.instructorId, req.params.period, req.user));
});
