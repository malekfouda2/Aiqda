import * as lessonsService from './lessons.service.js';

export const createLesson = async (req, res) => {
  try {
    const lesson = await lessonsService.createLesson(req.body);
    res.status(201).json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getLessonsByCourse = async (req, res) => {
  try {
    const lessons = await lessonsService.getLessonsByCourse(req.params.courseId);
    res.json(lessons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getLessonById = async (req, res) => {
  try {
    const result = await lessonsService.getLessonById(req.params.id, req.user?.id);
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const updateLesson = async (req, res) => {
  try {
    const lesson = await lessonsService.updateLesson(req.params.id, req.body);
    res.json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteLesson = async (req, res) => {
  try {
    const result = await lessonsService.deleteLesson(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const reorderLessons = async (req, res) => {
  try {
    const lessons = await lessonsService.reorderLessons(req.params.courseId, req.body.lessonOrders);
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
      req.body.watchPercentage
    );
    res.json(progress);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getSecureVideoToken = async (req, res) => {
  try {
    const token = await lessonsService.getSecureVideoToken(req.params.id, req.user.id);
    res.json(token);
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
};
