import express from 'express';
import * as analyticsController from './analytics.controller.js';
import { authenticate, isAdmin, isInstructor } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/student', analyticsController.getStudentProgress);
router.get('/student/course/:courseId', analyticsController.getCourseProgress);

router.get('/instructor', isInstructor, analyticsController.getInstructorAnalytics);

router.get('/admin', isAdmin, analyticsController.getAdminAnalytics);
router.get('/lesson/:lessonId', isAdmin, analyticsController.getLessonAnalytics);

export default router;
