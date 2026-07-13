import express from 'express';
import * as usersController from './users.controller.js';
import { authenticate, isAdmin, isInstructor } from '../../middlewares/auth.middleware.js';
import { isAdminRole } from '../../utils/roles.js';
import { uploadCreatorTeaser } from '../../middlewares/upload.middleware.js';

const router = express.Router();

// Public: creator profile page (teaser + published chapters). Must precede authenticate.
router.get('/creators/:id/public', usersController.getPublicCreatorProfile);

router.use(authenticate);

router.post('/me/teaser', isInstructor, uploadCreatorTeaser, usersController.uploadCreatorTeaser);
router.delete('/me/teaser', isInstructor, usersController.deleteCreatorTeaser);

router.get('/', isAdmin, usersController.getAllUsers);
router.patch('/:id/toggle-status', isAdmin, usersController.toggleUserStatus);
router.patch('/:id/role', isAdmin, usersController.updateUserRole);
router.patch('/:id/assigned-packages', isAdmin, usersController.assignSubscriptionPackages);
router.delete('/:id', isAdmin, usersController.deleteUser);
router.post('/me/platform-notice-acknowledgement', usersController.acknowledgePlatformNotice);

const selfOrAdmin = (req, res, next) => {
  if (isAdminRole(req.user.role) || req.user.id === req.params.id) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
};

router.get('/:id', selfOrAdmin, usersController.getUserById);
router.put('/:id', selfOrAdmin, usersController.updateUser);

export default router;
