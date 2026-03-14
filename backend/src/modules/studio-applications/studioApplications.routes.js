import express from 'express';
import * as studioApplicationsController from './studioApplications.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/', studioApplicationsController.submitApplication);

router.get('/', authenticate, isAdmin, studioApplicationsController.getAllApplications);
router.get('/:id', authenticate, isAdmin, studioApplicationsController.getApplicationById);
router.patch('/:id/approve', authenticate, isAdmin, studioApplicationsController.approveApplication);
router.patch('/:id/reject', authenticate, isAdmin, studioApplicationsController.rejectApplication);

export default router;
