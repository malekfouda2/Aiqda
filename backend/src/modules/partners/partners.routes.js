import express from 'express';

import * as partnersController from './partners.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';
import { uploadPartnerLogo } from '../../middlewares/upload.middleware.js';

const router = express.Router();

router.get('/', partnersController.getPublicList);

router.get('/admin', authenticate, isAdmin, partnersController.getAll);
router.get('/admin/:id', authenticate, isAdmin, partnersController.getById);
router.post('/', authenticate, isAdmin, uploadPartnerLogo.single('image'), partnersController.create);
router.put('/:id', authenticate, isAdmin, uploadPartnerLogo.single('image'), partnersController.update);
router.delete('/:id', authenticate, isAdmin, partnersController.remove);

export default router;
