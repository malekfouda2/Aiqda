import express from 'express';
import * as contactMessagesController from './contactMessages.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';
import { contactSubmissionRateLimit } from '../../middlewares/rateLimit.middleware.js';

const router = express.Router();

router.post('/', contactSubmissionRateLimit, contactMessagesController.submit);

router.get('/', authenticate, isAdmin, contactMessagesController.getAll);
router.get('/:id', authenticate, isAdmin, contactMessagesController.getById);
router.patch('/:id/read', authenticate, isAdmin, contactMessagesController.markAsRead);
router.patch('/:id/unread', authenticate, isAdmin, contactMessagesController.markAsUnread);
router.delete('/:id', authenticate, isAdmin, contactMessagesController.remove);

export default router;
