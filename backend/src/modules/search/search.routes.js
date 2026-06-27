import express from 'express';
import * as searchController from './search.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticate);
router.get('/', searchController.search);

export default router;
