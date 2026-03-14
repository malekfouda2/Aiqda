import * as consultationBookingsService from './consultationBookings.service.js';
import * as consultationsService from './consultations.service.js';

export const submitBooking = async (req, res) => {
  try {
    const { consultationId, paymentReference } = req.body;
    const consultation = await consultationsService.getById(consultationId);
    
    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    
    if (consultation.priceType === 'fixed' && !paymentReference) {
      return res.status(400).json({ error: 'Payment reference is required for fixed price consultations' });
    }
    
    const bookingData = {
      consultation: consultationId,
      user: req.user.id,
      priceType: consultation.priceType,
      amount: consultation.price,
      paymentReference
    };
    
    const booking = await consultationBookingsService.create(bookingData);
    res.status(201).json(booking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getMyBookings = async (req, res) => {
  try {
    const bookings = await consultationBookingsService.getByUser(req.user.id);
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllBookings = async (req, res) => {
  try {
    const bookings = await consultationBookingsService.getAll(req.query);
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getBookingById = async (req, res) => {
  try {
    const booking = await consultationBookingsService.getById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const confirmBooking = async (req, res) => {
  try {
    const booking = await consultationBookingsService.confirm(req.params.id, req.user.id);
    res.json(booking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const rejectBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await consultationBookingsService.reject(req.params.id, req.user.id, reason);
    res.json(booking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const booking = await consultationBookingsService.cancelByUser(req.params.id, req.user.id.toString());
    res.json(booking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
