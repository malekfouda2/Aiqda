import express from 'express';
import * as instructorApplicationsController from './instructorApplications.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';
import { uploadInstructorDocs } from '../../middlewares/upload.middleware.js';

const router = express.Router();

router.post(
  '/',
  uploadInstructorDocs.fields([
    { name: 'cvFile', maxCount: 1 },
    { name: 'courseMaterialsFile', maxCount: 1 }
  ]),
  instructorApplicationsController.submitApplication
);

router.get('/', authenticate, isAdmin, instructorApplicationsController.getAllApplications);
router.get('/:id', authenticate, isAdmin, instructorApplicationsController.getApplicationById);
router.patch('/:id/approve', authenticate, isAdmin, instructorApplicationsController.approveApplication);
router.patch('/:id/reject', authenticate, isAdmin, instructorApplicationsController.rejectApplication);

export default router;
