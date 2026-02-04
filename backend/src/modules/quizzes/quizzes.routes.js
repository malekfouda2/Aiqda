import express from 'express';
import * as quizzesController from './quizzes.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/lesson/:lessonId', quizzesController.getQuizForStudent);
router.get('/lesson/:lessonId/full', isAdmin, quizzesController.getQuizByLesson);

router.post('/', isAdmin, quizzesController.createQuiz);
router.put('/:id', isAdmin, quizzesController.updateQuiz);
router.delete('/:id', isAdmin, quizzesController.deleteQuiz);

router.post('/lesson/:lessonId/submit', quizzesController.submitQuiz);

export default router;
