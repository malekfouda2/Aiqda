import express from 'express';
import * as consultationBookingsController from './consultationBookings.controller.js';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/', authenticate, consultationBookingsController.submitBooking);
router.get('/my', authenticate, consultationBookingsController.getMyBookings);
router.get('/', authenticate, isAdmin, consultationBookingsController.getAllBookings);
router.get('/:id', authenticate, isAdmin, consultationBookingsController.getBookingById);
router.patch('/:id/confirm', authenticate, isAdmin, consultationBookingsController.confirmBooking);
router.patch('/:id/reject', authenticate, isAdmin, consultationBookingsController.rejectBooking);
router.patch('/:id/cancel', authenticate, consultationBookingsController.cancelBooking);

export default router;
