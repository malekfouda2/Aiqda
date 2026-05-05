import express from 'express';
import * as instructorApplicationsController from './instructorApplications.controller.js';
import { authenticate, canReviewApplications } from '../../middlewares/auth.middleware.js';
import { instructorApplicationRateLimit } from '../../middlewares/rateLimit.middleware.js';
import { uploadInstructorDocs } from '../../middlewares/upload.middleware.js';

const router = express.Router();

router.post(
  '/',
  instructorApplicationRateLimit,
  uploadInstructorDocs,
  instructorApplicationsController.submitApplication
);

router.get('/', authenticate, canReviewApplications, instructorApplicationsController.getAllApplications);
router.get('/:id', authenticate, canReviewApplications, instructorApplicationsController.getApplicationById);
router.get('/:id/files/:field', authenticate, canReviewApplications, instructorApplicationsController.downloadApplicationFile);
router.patch('/:id/approve', authenticate, canReviewApplications, instructorApplicationsController.approveApplication);
router.patch('/:id/reject', authenticate, canReviewApplications, instructorApplicationsController.rejectApplication);

export default router;
