import express from 'express';
import * as coursesController from './courses.controller.js';
import { authenticate, isAdmin, isInstructor } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/published', coursesController.getPublishedCourses);

router.use(authenticate);

router.get('/', isInstructor, coursesController.getAllCourses);
router.post('/', isInstructor, coursesController.createCourse);

router.get('/my/enrolled', coursesController.getEnrolledCourses);
router.get('/my/teaching', isInstructor, coursesController.getInstructorCourses);

router.get('/:id([0-9a-fA-F]{24})', coursesController.getCourseById);
router.put('/:id([0-9a-fA-F]{24})', isInstructor, coursesController.updateCourse);
router.delete('/:id([0-9a-fA-F]{24})', isInstructor, coursesController.deleteCourse);
router.post('/:id([0-9a-fA-F]{24})/enroll', coursesController.enrollStudent);

export default router;
