import express from 'express';

import * as whatsappSettingsController from './whatsappSettings.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', whatsappSettingsController.getPublicSettings);
router.get('/admin', authenticate, isAdmin, whatsappSettingsController.getAdminSettings);
router.put('/admin', authenticate, isAdmin, whatsappSettingsController.updateAdminSettings);

export default router;
