import * as analyticsService from './analytics.service.js';
import { getGa4AnalyticsCenter } from './ga4.service.js';

export const trackPublicEvent = async (req, res) => {
  try {
    await analyticsService.trackPublicEvent(req.body, req);
    res.status(204).end();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

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
    const progress = await analyticsService.getCourseProgress(
      req.user.id,
      req.params.courseId,
      req.user.role
    );
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

export const getAdminAnalyticsCenter = async (req, res) => {
  try {
    const days = Number.parseInt(req.query.days, 10) || 30;
    const [internal, ga4] = await Promise.all([
      analyticsService.getAdminAnalytics(),
      getGa4AnalyticsCenter({ days }),
    ]);

    res.json({
      generatedAt: new Date().toISOString(),
      internal,
      ga4,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAdminCoursesByInstructor = async (req, res) => {
  try {
    const data = await analyticsService.getAdminCoursesByInstructor();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAdminAllInstructors = async (req, res) => {
  try {
    const data = await analyticsService.getAdminAllInstructors();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAdminInstructorDetail = async (req, res) => {
  try {
    const data = await analyticsService.getAdminInstructorDetail(req.params.instructorId);
    res.json(data);
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
