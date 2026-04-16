import express from 'express';
import * as lessonsController from './lessons.controller.js';
import {
  authenticate,
  authenticateOptional,
  isInstructor,
  requirePlatformNoticeAcknowledgement
} from '../../middlewares/auth.middleware.js';
import { uploadLessonFile } from '../../middlewares/upload.middleware.js';

const router = express.Router();

router.get('/course/:courseId', authenticateOptional, lessonsController.getLessonsByCourse);

router.use(authenticate);

router.get('/:id', requirePlatformNoticeAcknowledgement, lessonsController.getLessonById);

router.post('/', isInstructor, lessonsController.createLesson);
router.put('/:id', isInstructor, lessonsController.updateLesson);
router.delete('/:id', isInstructor, lessonsController.deleteLesson);
router.put('/course/:courseId/reorder', isInstructor, lessonsController.reorderLessons);
router.post('/:id/upload-file', isInstructor, uploadLessonFile.single('file'), lessonsController.uploadFile);

router.post('/:id/progress', requirePlatformNoticeAcknowledgement, lessonsController.updateWatchProgress);
router.get('/:id/video-token', requirePlatformNoticeAcknowledgement, lessonsController.getSecureVideoToken);

export default router;
