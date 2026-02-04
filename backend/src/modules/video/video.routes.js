import express from 'express';
import * as videoController from './video.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.post('/upload', isAdmin, videoController.uploadToVimeo);
router.get('/list', isAdmin, videoController.getVimeoVideos);
router.post('/assign', isAdmin, videoController.assignVideoToLesson);
router.delete('/:videoId', isAdmin, videoController.deleteVimeoVideo);

router.get('/embed/:lessonId', videoController.getVideoEmbedData);

export default router;
