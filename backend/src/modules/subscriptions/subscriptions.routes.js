import express from 'express';
import * as subscriptionsController from './subscriptions.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/packages', subscriptionsController.getAllPackages);
router.get('/packages/:id', subscriptionsController.getPackageById);

router.use(authenticate);

router.post('/packages', isAdmin, subscriptionsController.createPackage);
router.put('/packages/:id', isAdmin, subscriptionsController.updatePackage);

router.post('/request', subscriptionsController.requestSubscription);
router.get('/my', subscriptionsController.getUserSubscriptions);
router.get('/active', subscriptionsController.getActiveSubscription);

router.get('/', isAdmin, subscriptionsController.getAllSubscriptions);
router.patch('/:id/approve', isAdmin, subscriptionsController.approveSubscription);
router.patch('/:id/cancel', isAdmin, subscriptionsController.cancelSubscription);

export default router;
