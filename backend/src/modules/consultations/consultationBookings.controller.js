import * as consultationBookingsService from './consultationBookings.service.js';
import * as consultationsService from './consultations.service.js';
import * as paymentsService from '../payments/payments.service.js';

const getRequestOrigin = (req) => {
  const originHeader = req.get('origin');
  if (originHeader) {
    return originHeader.replace(/\/$/, '');
  }

  const refererHeader = req.get('referer');
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin.replace(/\/$/, '');
    } catch {
      return null;
    }
  }

  return null;
};

export const submitBooking = async (req, res) => {
  try {
    const { consultationId } = req.body;
    const consultation = await consultationsService.getById(consultationId);
    
    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    
    if (consultation.priceType === 'fixed') {
      return res.status(400).json({ error: 'Fixed-price consultations must be completed through electronic checkout.' });
    }
    
    const bookingData = {
      consultation: consultationId,
      user: req.user.id,
      priceType: consultation.priceType,
      amount: consultation.price,
      currency: consultation.currency,
    };
    
    const booking = await consultationBookingsService.create(bookingData);
    res.status(201).json(booking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createCheckout = async (req, res) => {
  try {
    const result = await paymentsService.createTapConsultationCharge(req.user.id, {
      consultationId: req.body.consultationId,
      tokenId: req.body.tokenId,
      checkoutMethod: req.body.checkoutMethod,
      phoneCountryCode: req.body.phoneCountryCode,
      phoneNumber: req.body.phoneNumber,
      checkoutDisclaimerAccepted: req.body.checkoutDisclaimerAccepted,
      frontendBaseUrl: getRequestOrigin(req),
    });
    res.status(201).json(result);
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

export const removeBooking = async (req, res) => {
  try {
    await consultationBookingsService.remove(req.params.id);
    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    const statusCode = error.message === 'Booking not found' ? 404 : 400;
    res.status(statusCode).json({ error: error.message });
  }
};
