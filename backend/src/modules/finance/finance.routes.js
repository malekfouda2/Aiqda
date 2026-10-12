import express from 'express';
import * as controller from './finance.controller.js';
import { authenticate, isInstructor } from '../../middlewares/auth.middleware.js';
import { canDoFinance, FINANCE_ACTIONS } from '../../utils/financePermissions.js';

const router = express.Router();

const requireFinance = (action) => (req, res, next) => {
  if (!canDoFinance(req.user, action)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
};

router.use(authenticate);

// Creator-facing: finalized statements only, never the admin ledger.
router.get('/my-statements', isInstructor, controller.getMyStatements);

router.get('/overview', requireFinance(FINANCE_ACTIONS.VIEW_DASHBOARD), controller.getOverview);

router.get('/settings', requireFinance(FINANCE_ACTIONS.VIEW_DASHBOARD), controller.getSettings);
router.put('/settings', requireFinance(FINANCE_ACTIONS.MANAGE_ALLOCATION_SETTINGS), controller.updateSettings);
router.get('/instructors/:id/profile', requireFinance(FINANCE_ACTIONS.VIEW_INSTRUCTOR_FINANCIALS), controller.getInstructorProfile);

router.get('/earnings', requireFinance(FINANCE_ACTIONS.VIEW_EARNINGS), controller.getEarnings);
router.patch('/earnings/bulk', requireFinance(FINANCE_ACTIONS.MANAGE_EARNINGS), controller.bulkEarnings);
router.get('/export/earnings.csv', requireFinance(FINANCE_ACTIONS.EXPORT_REPORTS), controller.exportEarnings);

router.get('/payout-batches', requireFinance(FINANCE_ACTIONS.APPROVE_PAYOUTS), controller.getPayoutBatches);
router.post('/payout-batches', requireFinance(FINANCE_ACTIONS.CREATE_PAYOUT_BATCHES), controller.createPayoutBatch);
router.patch('/payout-batches/:id/approve', requireFinance(FINANCE_ACTIONS.APPROVE_PAYOUTS), controller.approvePayoutBatch);
router.patch('/payout-batches/:id/settle', requireFinance(FINANCE_ACTIONS.MARK_PAYOUTS_PAID), controller.settlePayoutBatch);
router.patch('/payout-batches/:id/cancel', requireFinance(FINANCE_ACTIONS.CREATE_PAYOUT_BATCHES), controller.cancelPayoutBatch);

router.get('/statements', requireFinance(FINANCE_ACTIONS.MANAGE_STATEMENTS), controller.getStatements);
router.get('/statements/:instructorId/:period', requireFinance(FINANCE_ACTIONS.MANAGE_STATEMENTS), controller.getStatement);
router.put('/statements/:instructorId/:period', requireFinance(FINANCE_ACTIONS.MANAGE_STATEMENTS), controller.saveStatement);
router.post('/statements/:instructorId/:period/finalize', requireFinance(FINANCE_ACTIONS.MANAGE_STATEMENTS), controller.finalizeStatement);
router.post('/statements/:instructorId/:period/reopen', requireFinance(FINANCE_ACTIONS.MANAGE_STATEMENTS), controller.reopenStatement);

router.post('/chargebacks', requireFinance(FINANCE_ACTIONS.MANAGE_ADJUSTMENTS), controller.recordChargeback);
router.get('/recoveries', requireFinance(FINANCE_ACTIONS.VIEW_DASHBOARD), controller.getRecoveries);
router.get('/audit', requireFinance(FINANCE_ACTIONS.VIEW_AUDIT_LOGS), controller.getAudit);

export default router;
