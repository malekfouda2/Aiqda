import express from 'express';
import * as quizzesController from './quizzes.controller.js';
import { authenticate, isAdmin, isInstructor } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/lesson/:lessonId', quizzesController.getQuizForStudent);
router.get('/lesson/:lessonId/full', isInstructor, quizzesController.getQuizByLesson);

router.post('/', isInstructor, quizzesController.createQuiz);
router.put('/:id', isInstructor, quizzesController.updateQuiz);
router.delete('/:id', isInstructor, quizzesController.deleteQuiz);

router.post('/lesson/:lessonId/submit', quizzesController.submitQuiz);

export default router;
