import * as lessonsService from './lessons.service.js';

export const createLesson = async (req, res) => {
  try {
    const lesson = await lessonsService.createLesson(req.body, req.user.id, req.user.role);
    res.status(201).json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const lesson = await lessonsService.uploadLessonFile(req.params.id, req.file, req.user.id, req.user.role);
    res.json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getLessonsByCourse = async (req, res) => {
  try {
    const lessons = await lessonsService.getLessonsByCourse(
      req.params.courseId,
      req.user?.id,
      req.user?.role
    );
    res.json(lessons);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const getLessonById = async (req, res) => {
  try {
    const result = await lessonsService.getLessonById(
      req.params.id,
      req.user?.id,
      req.user?.role
    );
    res.json(result);
  } catch (error) {
    const statusCode = error.message === 'Access denied. Insufficient permissions.' ? 403 : 404;
    res.status(statusCode).json({ error: error.message });
  }
};

export const updateLesson = async (req, res) => {
  try {
    const lesson = await lessonsService.updateLesson(req.params.id, req.body, req.user.id, req.user.role);
    res.json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteLesson = async (req, res) => {
  try {
    const result = await lessonsService.deleteLesson(req.params.id, req.user.id, req.user.role);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const reorderLessons = async (req, res) => {
  try {
    const lessons = await lessonsService.reorderLessons(
      req.params.courseId,
      req.body.lessonOrders,
      req.user.id,
      req.user.role
    );
    res.json(lessons);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateWatchProgress = async (req, res) => {
  try {
    const progress = await lessonsService.updateWatchProgress(
      req.params.id,
      req.user.id,
      req.body.watchPercentage,
      req.user.role
    );
    res.json(progress);
  } catch (error) {
    const statusCode = error.message === 'Access denied. Insufficient permissions.' ? 403 : 400;
    res.status(statusCode).json({ error: error.message });
  }
};

export const getSecureVideoToken = async (req, res) => {
  try {
    const token = await lessonsService.getSecureVideoToken(req.params.id, req.user.id, req.user.role);
    res.json(token);
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
};
