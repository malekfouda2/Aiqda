import express from 'express';

import * as teamMembersController from './teamMembers.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';
import { uploadTeamMemberPhoto } from '../../middlewares/upload.middleware.js';

const router = express.Router();

router.get('/', teamMembersController.getPublicList);

router.get('/admin', authenticate, isAdmin, teamMembersController.getAll);
router.get('/admin/:id', authenticate, isAdmin, teamMembersController.getById);
router.post('/', authenticate, isAdmin, uploadTeamMemberPhoto.single('image'), teamMembersController.create);
router.put('/:id', authenticate, isAdmin, uploadTeamMemberPhoto.single('image'), teamMembersController.update);
router.delete('/:id', authenticate, isAdmin, teamMembersController.remove);

export default router;
