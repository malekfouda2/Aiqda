import express from 'express';
import * as usersController from './users.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';
import { isAdminRole } from '../../utils/roles.js';

const router = express.Router();

// Public: creator profile page (teaser + published chapters). Must precede authenticate.
router.get('/creators/:id/public', usersController.getPublicCreatorProfile);

router.use(authenticate);

// Admin-only: manage a creator's teaser video (Vimeo ID).
router.post('/:id/teaser', isAdmin, usersController.setCreatorTeaser);
router.delete('/:id/teaser', isAdmin, usersController.deleteCreatorTeaser);

// Admin-only: configure how many chapters a creator may create.
router.patch('/:id/chapter-limit', isAdmin, usersController.setCreatorChapterLimit);

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
