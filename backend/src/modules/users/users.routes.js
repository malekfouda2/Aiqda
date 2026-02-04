import express from 'express';
import * as usersController from './users.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/', isAdmin, usersController.getAllUsers);
router.get('/:id', usersController.getUserById);
router.put('/:id', usersController.updateUser);
router.patch('/:id/toggle-status', isAdmin, usersController.toggleUserStatus);
router.patch('/:id/role', isAdmin, usersController.updateUserRole);

export default router;
