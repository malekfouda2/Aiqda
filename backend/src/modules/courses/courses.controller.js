import * as coursesService from './courses.service.js';

export const createCourse = async (req, res) => {
  try {
    const course = await coursesService.createCourse(req.body, req.user.id);
    res.status(201).json(course);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllCourses = async (req, res) => {
  try {
    const courses = await coursesService.getAllCourses(req.query);
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPublishedCourses = async (req, res) => {
  try {
    const courses = await coursesService.getPublishedCourses();
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCourseById = async (req, res) => {
  try {
    const course = await coursesService.getCourseById(req.params.id);
    res.json(course);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const updateCourse = async (req, res) => {
  try {
    const course = await coursesService.updateCourse(
      req.params.id,
      req.body,
      req.user.id,
      req.user.role
    );
    res.json(course);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const result = await coursesService.deleteCourse(
      req.params.id,
      req.user.id,
      req.user.role
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const enrollStudent = async (req, res) => {
  try {
    const course = await coursesService.enrollStudent(req.params.id, req.user.id);
    res.json(course);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getEnrolledCourses = async (req, res) => {
  try {
    const courses = await coursesService.getEnrolledCourses(req.user.id);
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getInstructorCourses = async (req, res) => {
  try {
    const courses = await coursesService.getInstructorCourses(req.user.id);
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
