import * as quizzesService from './quizzes.service.js';

const isForbiddenError = (message = '') => (
  message === 'Access denied. Insufficient permissions.'
  || message === 'You need an active subscription to access this chapter'
  || message === 'Your current subscription does not include access to this chapter'
);

export const createQuiz = async (req, res) => {
  try {
    const quiz = await quizzesService.createQuiz(req.body, req.user.id, req.user.role);
    res.status(201).json(quiz);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getQuizByLesson = async (req, res) => {
  try {
    const quiz = await quizzesService.getQuizByLesson(
      req.params.lessonId,
      req.user.id,
      req.user.role
    );
    res.json(quiz);
  } catch (error) {
    const statusCode = isForbiddenError(error.message) ? 403 : 404;
    res.status(statusCode).json({ error: error.message });
  }
};

export const getQuizForStudent = async (req, res) => {
  try {
    const quiz = await quizzesService.getQuizForStudent(
      req.params.lessonId,
      req.user.id,
      req.user.role
    );
    res.json(quiz);
  } catch (error) {
    const statusCode = isForbiddenError(error.message) ? 403 : 404;
    res.status(statusCode).json({ error: error.message });
  }
};

export const updateQuiz = async (req, res) => {
  try {
    const quiz = await quizzesService.updateQuiz(req.params.id, req.body, req.user.id, req.user.role);
    res.json(quiz);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteQuiz = async (req, res) => {
  try {
    const result = await quizzesService.deleteQuiz(req.params.id, req.user.id, req.user.role);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const submitQuiz = async (req, res) => {
  try {
    const result = await quizzesService.submitQuiz(
      req.params.lessonId,
      req.user.id,
      req.body.answers,
      req.user.role
    );
    res.json(result);
  } catch (error) {
    const statusCode = isForbiddenError(error.message) ? 403 : 400;
    res.status(statusCode).json({ error: error.message });
  }
};
