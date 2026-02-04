import express from 'express';
import * as coursesController from './courses.controller.js';
import { authenticate, isAdmin, isInstructor } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/published', coursesController.getPublishedCourses);
router.get('/:id', coursesController.getCourseById);

router.use(authenticate);

router.get('/', isInstructor, coursesController.getAllCourses);
router.post('/', isAdmin, coursesController.createCourse);
router.put('/:id', isInstructor, coursesController.updateCourse);
router.delete('/:id', isAdmin, coursesController.deleteCourse);

router.post('/:id/enroll', coursesController.enrollStudent);
router.get('/my/enrolled', coursesController.getEnrolledCourses);
router.get('/my/teaching', isInstructor, coursesController.getInstructorCourses);

export default router;
