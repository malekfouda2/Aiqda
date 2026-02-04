import express from 'express';
import * as paymentsController from './payments.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';
import { uploadPaymentProof } from '../../middlewares/upload.middleware.js';

const router = express.Router();

router.get('/bank-details', paymentsController.getBankDetails);

router.use(authenticate);

router.post('/', uploadPaymentProof.single('proofFile'), paymentsController.submitPayment);
router.get('/my', paymentsController.getUserPayments);

router.get('/', isAdmin, paymentsController.getAllPayments);
router.get('/:id', paymentsController.getPaymentById);
router.patch('/:id/approve', isAdmin, paymentsController.approvePayment);
router.patch('/:id/reject', isAdmin, paymentsController.rejectPayment);

export default router;
