import express from 'express';
import * as studioApplicationsController from './studioApplications.controller.js';
import { authenticate, canReviewApplications } from '../../middlewares/auth.middleware.js';
import { studioApplicationRateLimit } from '../../middlewares/rateLimit.middleware.js';

const router = express.Router();

router.post('/', studioApplicationRateLimit, studioApplicationsController.submitApplication);

router.get('/', authenticate, canReviewApplications, studioApplicationsController.getAllApplications);
router.get('/:id', authenticate, canReviewApplications, studioApplicationsController.getApplicationById);
router.patch('/:id/approve', authenticate, canReviewApplications, studioApplicationsController.approveApplication);
router.patch('/:id/reject', authenticate, canReviewApplications, studioApplicationsController.rejectApplication);

export default router;
