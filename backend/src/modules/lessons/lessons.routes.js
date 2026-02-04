import express from 'express';
import * as lessonsController from './lessons.controller.js';
import { authenticate, isAdmin, isInstructor } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/course/:courseId', lessonsController.getLessonsByCourse);
router.get('/:id', lessonsController.getLessonById);

router.post('/', isAdmin, lessonsController.createLesson);
router.put('/:id', isAdmin, lessonsController.updateLesson);
router.delete('/:id', isAdmin, lessonsController.deleteLesson);
router.put('/course/:courseId/reorder', isAdmin, lessonsController.reorderLessons);

router.post('/:id/progress', lessonsController.updateWatchProgress);
router.get('/:id/video-token', lessonsController.getSecureVideoToken);

export default router;
