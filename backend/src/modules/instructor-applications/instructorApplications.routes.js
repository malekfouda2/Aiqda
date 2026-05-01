import express from 'express';
import * as instructorApplicationsController from './instructorApplications.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';
import { instructorApplicationRateLimit } from '../../middlewares/rateLimit.middleware.js';
import { uploadInstructorDocs } from '../../middlewares/upload.middleware.js';

const router = express.Router();

router.post(
  '/',
  instructorApplicationRateLimit,
  uploadInstructorDocs,
  instructorApplicationsController.submitApplication
);

router.get('/', authenticate, isAdmin, instructorApplicationsController.getAllApplications);
router.get('/:id', authenticate, isAdmin, instructorApplicationsController.getApplicationById);
router.get('/:id/files/:field', authenticate, isAdmin, instructorApplicationsController.downloadApplicationFile);
router.patch('/:id/approve', authenticate, isAdmin, instructorApplicationsController.approveApplication);
router.patch('/:id/reject', authenticate, isAdmin, instructorApplicationsController.rejectApplication);

export default router;
