import express from 'express';
import * as lessonsController from './lessons.controller.js';
import { authenticate, isAdmin, isInstructor } from '../../middlewares/auth.middleware.js';
import { uploadLessonFile } from '../../middlewares/upload.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/course/:courseId', lessonsController.getLessonsByCourse);
router.get('/:id', lessonsController.getLessonById);

router.post('/', isInstructor, lessonsController.createLesson);
router.put('/:id', isInstructor, lessonsController.updateLesson);
router.delete('/:id', isInstructor, lessonsController.deleteLesson);
router.put('/course/:courseId/reorder', isInstructor, lessonsController.reorderLessons);
router.post('/:id/upload-file', isInstructor, uploadLessonFile.single('file'), lessonsController.uploadFile);

router.post('/:id/progress', lessonsController.updateWatchProgress);
router.get('/:id/video-token', lessonsController.getSecureVideoToken);

export default router;
