import express from 'express';
import * as consultationsController from './consultations.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', consultationsController.getActive);
router.get('/:id', consultationsController.getById);
router.post('/', authenticate, isAdmin, consultationsController.create);
router.put('/:id', authenticate, isAdmin, consultationsController.update);
router.delete('/:id', authenticate, isAdmin, consultationsController.remove);

export default router;
