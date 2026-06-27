import express from 'express';
import * as notificationsController from './notifications.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/', notificationsController.getMyNotifications);
router.get('/unread-count', notificationsController.getUnreadCount);
router.patch('/read-all', notificationsController.markAllRead);
router.patch('/:id/read', notificationsController.markRead);
router.delete('/clear-all', notificationsController.clearAll);
router.delete('/:id', notificationsController.remove);

export default router;
