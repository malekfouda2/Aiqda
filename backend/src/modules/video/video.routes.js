import express from 'express';
import * as videoController from './video.controller.js';
import { authenticate, isAdmin, requirePlatformNoticeAcknowledgement } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/list', isAdmin, videoController.getVimeoVideos);
router.get('/details/:videoId', isAdmin, videoController.getVideoDetails);
router.post('/assign', isAdmin, videoController.assignVideoToLesson);
router.get('/validate-token', isAdmin, videoController.validateToken);

router.get('/embed/:lessonId', requirePlatformNoticeAcknowledgement, videoController.getVideoEmbedData);

export default router;
