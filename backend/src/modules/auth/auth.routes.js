import express from 'express';
import * as authController from './auth.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import {
  authLoginRateLimit,
  authRegisterRateLimit,
  authSocialRateLimit,
  inviteAcceptRateLimit
} from '../../middlewares/rateLimit.middleware.js';

const router = express.Router();

router.post('/register', authRegisterRateLimit, authController.register);
router.post('/login', authLoginRateLimit, authController.login);
router.get('/social/providers', authController.getSocialProviders);
router.get('/social/:provider/start', authSocialRateLimit, authController.startSocialLogin);
router.get('/social/:provider/callback', authSocialRateLimit, authController.handleSocialCallback);
router.post('/social/complete', authSocialRateLimit, authController.completeSocialLogin);
router.post('/invite/accept', inviteAcceptRateLimit, authController.acceptInstructorInvite);
router.get('/profile', authenticate, authController.getProfile);

export default router;
