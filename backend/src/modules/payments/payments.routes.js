import express from 'express';
import * as paymentsController from './payments.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/tap/webhook', paymentsController.processTapWebhook);

router.use(authenticate);

router.get('/tap/config', paymentsController.getTapCheckoutConfig);
router.post('/tap/charge', paymentsController.createTapSubscriptionCharge);
router.post('/tap/billing-profile/setup', paymentsController.createTapBillingProfileSetupCharge);
router.get('/tap/charges/:chargeId', paymentsController.syncTapChargeForUser);
router.delete('/tap/billing-profile', paymentsController.removeTapBillingProfile);

router.get('/my', paymentsController.getUserPayments);

router.get('/', isAdmin, paymentsController.getAllPayments);
router.post('/:id/refund', isAdmin, paymentsController.refundPayment);
router.get('/:id', paymentsController.getPaymentById);
router.delete('/:id', isAdmin, paymentsController.removePayment);

export default router;
