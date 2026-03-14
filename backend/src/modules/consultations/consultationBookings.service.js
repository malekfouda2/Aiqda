import ConsultationBooking from './consultationBooking.model.js';
import Consultation from './consultation.model.js';

export const create = async (data) => {
  const booking = new ConsultationBooking(data);
  await booking.save();
  return ConsultationBooking.findById(booking._id).populate('consultation user');
};

export const getByUser = async (userId) => {
  return ConsultationBooking.find({ user: userId })
    .populate('consultation')
    .sort({ createdAt: -1 });
};

export const getAll = async (filters) => {
  const query = {};
  if (filters && filters.status) {
    query.status = filters.status;
  }
  return ConsultationBooking.find(query)
    .populate('consultation user')
    .sort({ createdAt: -1 });
};

export const getById = async (id) => {
  return ConsultationBooking.findById(id)
    .populate('consultation user reviewedBy');
};

export const confirm = async (id, adminId) => {
  const booking = await ConsultationBooking.findById(id).populate('consultation');
  if (!booking) throw new Error('Booking not found');
  
  booking.status = 'confirmed';
  booking.reviewedBy = adminId;
  booking.reviewedAt = new Date();
  booking.zoomLink = booking.consultation.zoomSchedulerLink;
  
  return booking.save();
};

export const reject = async (id, adminId, reason) => {
  const booking = await ConsultationBooking.findById(id);
  if (!booking) throw new Error('Booking not found');
  
  booking.status = 'rejected';
  booking.reviewedBy = adminId;
  booking.reviewedAt = new Date();
  booking.rejectionReason = reason;
  
  return booking.save();
};

export const cancelByUser = async (id, userId) => {
  const booking = await ConsultationBooking.findById(id);
  if (!booking) throw new Error('Booking not found');
  
  if (booking.user.toString() !== userId) {
    throw new Error('Not authorized to cancel this booking');
  }
  
  if (booking.status !== 'pending') {
    throw new Error('Can only cancel pending bookings');
  }
  
  booking.status = 'cancelled';
  return booking.save();
};
