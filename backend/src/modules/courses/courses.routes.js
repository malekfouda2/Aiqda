import express from 'express';
import * as coursesController from './courses.controller.js';
import { authenticate, authenticateOptional, isInstructor } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/published', coursesController.getPublishedCourses);
router.get('/:id', authenticateOptional, coursesController.getCourseById);

router.use(authenticate);

router.get('/', isInstructor, coursesController.getAllCourses);
router.post('/', isInstructor, coursesController.createCourse);

router.get('/my/enrolled', coursesController.getEnrolledCourses);
router.get('/my/teaching', isInstructor, coursesController.getInstructorCourses);

router.put('/:id', isInstructor, coursesController.updateCourse);
router.delete('/:id', isInstructor, coursesController.deleteCourse);
router.post('/:id/enroll', coursesController.enrollStudent);

export default router;
