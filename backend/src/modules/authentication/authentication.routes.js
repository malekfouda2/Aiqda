import express from 'express';

import * as authenticationController from './authentication.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';
import { uploadAuthenticationLogo } from '../../middlewares/upload.middleware.js';

const router = express.Router();

router.get('/', authenticationController.getPublicList);

router.get('/admin', authenticate, isAdmin, authenticationController.getAll);
router.get('/admin/:id', authenticate, isAdmin, authenticationController.getById);
router.post('/', authenticate, isAdmin, uploadAuthenticationLogo, authenticationController.create);
router.put('/:id', authenticate, isAdmin, uploadAuthenticationLogo, authenticationController.update);
router.delete('/:id', authenticate, isAdmin, authenticationController.remove);

export default router;
