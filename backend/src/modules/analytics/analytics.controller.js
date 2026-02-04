import * as analyticsService from './analytics.service.js';

export const getStudentProgress = async (req, res) => {
  try {
    const progress = await analyticsService.getStudentProgress(req.user.id);
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCourseProgress = async (req, res) => {
  try {
    const progress = await analyticsService.getCourseProgress(req.user.id, req.params.courseId);
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getInstructorAnalytics = async (req, res) => {
  try {
    const analytics = await analyticsService.getInstructorAnalytics(req.user.id);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAdminAnalytics = async (req, res) => {
  try {
    const analytics = await analyticsService.getAdminAnalytics();
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getLessonAnalytics = async (req, res) => {
  try {
    const analytics = await analyticsService.getLessonAnalytics(req.params.lessonId);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
