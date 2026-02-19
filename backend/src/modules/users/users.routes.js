import express from 'express';
import * as usersController from './users.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/', isAdmin, usersController.getAllUsers);
router.patch('/:id/toggle-status', isAdmin, usersController.toggleUserStatus);
router.patch('/:id/role', isAdmin, usersController.updateUserRole);

const selfOrAdmin = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.id === req.params.id) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
};

router.get('/:id', selfOrAdmin, usersController.getUserById);
router.put('/:id', selfOrAdmin, usersController.updateUser);

export default router;
