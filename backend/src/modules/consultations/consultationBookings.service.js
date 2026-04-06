import ConsultationBooking from './consultationBooking.model.js';
import Consultation from './consultation.model.js';
import { sendEmail } from '../../utils/email.js';
import {
  buildConsultationBookingReceivedEmail,
  buildConsultationBookingConfirmedEmail,
  buildConsultationBookingRejectedEmail,
  buildConsultationBookingCancelledEmail
} from '../../utils/emailTemplates.js';

export const create = async (data) => {
  const booking = new ConsultationBooking(data);
  await booking.save();

  const populatedBooking = await ConsultationBooking.findById(booking._id).populate('consultation user');
  const receivedEmail = buildConsultationBookingReceivedEmail({
    recipientName: populatedBooking.user.name,
    consultationTitle: populatedBooking.consultation.title,
  });

  try {
    await sendEmail({
      to: populatedBooking.user.email,
      subject: receivedEmail.subject,
      text: receivedEmail.text,
      html: receivedEmail.html,
    });
  } catch (error) {
    console.error('Failed to send consultation booking acknowledgement email:', error.message);
  }

  return populatedBooking;
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
  const booking = await ConsultationBooking.findById(id).populate('consultation user');
  if (!booking) throw new Error('Booking not found');
  
  booking.status = 'confirmed';
  booking.reviewedBy = adminId;
  booking.reviewedAt = new Date();
  booking.zoomLink = booking.consultation.zoomSchedulerLink;
  await booking.save();

  const confirmationEmail = buildConsultationBookingConfirmedEmail({
    recipientName: booking.user.name,
    consultationTitle: booking.consultation.title,
    zoomLink: booking.zoomLink,
  });
  try {
    await sendEmail({
      to: booking.user.email,
      subject: confirmationEmail.subject,
      text: confirmationEmail.text,
      html: confirmationEmail.html,
    });
  } catch (error) {
    console.error('Failed to send consultation confirmation email:', error.message);
  }
  
  return booking;
};

export const reject = async (id, adminId, reason) => {
  const booking = await ConsultationBooking.findById(id).populate('consultation user');
  if (!booking) throw new Error('Booking not found');
  
  booking.status = 'rejected';
  booking.reviewedBy = adminId;
  booking.reviewedAt = new Date();
  booking.rejectionReason = reason;
  await booking.save();

  const rejectionEmail = buildConsultationBookingRejectedEmail({
    recipientName: booking.user.name,
    consultationTitle: booking.consultation.title,
    reason,
  });
  try {
    await sendEmail({
      to: booking.user.email,
      subject: rejectionEmail.subject,
      text: rejectionEmail.text,
      html: rejectionEmail.html,
    });
  } catch (error) {
    console.error('Failed to send consultation rejection email:', error.message);
  }
  
  return booking;
};

export const cancelByUser = async (id, userId) => {
  const booking = await ConsultationBooking.findById(id).populate('consultation user');
  if (!booking) throw new Error('Booking not found');
  
  const bookingUserId = booking.user?._id ? booking.user._id.toString() : booking.user.toString();
  if (bookingUserId !== userId) {
    throw new Error('Not authorized to cancel this booking');
  }
  
  if (booking.status !== 'pending') {
    throw new Error('Can only cancel pending bookings');
  }
  
  booking.status = 'cancelled';
  await booking.save();

  const cancellationEmail = buildConsultationBookingCancelledEmail({
    recipientName: booking.user.name,
    consultationTitle: booking.consultation.title,
  });
  try {
    await sendEmail({
      to: booking.user.email,
      subject: cancellationEmail.subject,
      text: cancellationEmail.text,
      html: cancellationEmail.html,
    });
  } catch (error) {
    console.error('Failed to send consultation cancellation email:', error.message);
  }

  return booking;
};
