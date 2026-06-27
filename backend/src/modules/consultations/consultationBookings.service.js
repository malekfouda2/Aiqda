import ConsultationBooking from './consultationBooking.model.js';
import Consultation from './consultation.model.js';
import Payment from '../payments/payment.model.js';
import { refundSuccessfulPayment } from '../payments/payments.service.js';
import { sendEmail } from '../../utils/email.js';
import { sendAdminNotificationEmail } from '../../utils/adminNotifications.js';
import {
  buildConsultationBookingReceivedEmail,
  buildConsultationBookingAdminNotificationEmail,
  buildConsultationBookingConfirmedEmail,
  buildConsultationBookingRejectedEmail,
  buildConsultationBookingCancelledEmail
} from '../../utils/emailTemplates.js';
import { notify } from '../notifications/notify.js';

const attachLatestPayments = async (bookings) => {
  const bookingList = Array.isArray(bookings) ? bookings : bookings ? [bookings] : [];
  if (bookingList.length === 0) {
    return Array.isArray(bookings) ? [] : null;
  }

  const bookingIds = bookingList.map((booking) => booking._id);
  const payments = await Payment.find({
    consultationBooking: { $in: bookingIds },
  }).sort({ createdAt: -1 });

  const paymentByBookingId = new Map();
  for (const payment of payments) {
    const bookingId = payment.consultationBooking?.toString?.();
    if (bookingId && !paymentByBookingId.has(bookingId)) {
      paymentByBookingId.set(bookingId, payment);
    }
  }

  const enrichedBookings = bookingList.map((booking) => {
    const normalized = typeof booking.toObject === 'function' ? booking.toObject() : booking;
    return {
      ...normalized,
      latestPayment: paymentByBookingId.get(booking._id.toString()) || null,
    };
  });

  return Array.isArray(bookings) ? enrichedBookings : enrichedBookings[0];
};

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

  const adminNotificationEmail = buildConsultationBookingAdminNotificationEmail({
    recipientName: populatedBooking.user.name,
    recipientEmail: populatedBooking.user.email,
    consultationTitle: populatedBooking.consultation.title,
    amount: populatedBooking.amount,
    currency: populatedBooking.currency || populatedBooking.consultation?.currency || 'SAR',
    priceType: populatedBooking.priceType,
    paymentReference: populatedBooking.paymentReference,
  });

  try {
    await sendAdminNotificationEmail({
      replyTo: populatedBooking.user.email,
      subject: adminNotificationEmail.subject,
      text: adminNotificationEmail.text,
      html: adminNotificationEmail.html,
    });
  } catch (error) {
    console.error('Failed to send consultation booking admin notification email:', error.message);
  }

  await notify.admins({
    type: 'consultation.booking_created',
    title: 'New consultation booking',
    titleAr: 'حجز استشارة جديد',
    message: `${populatedBooking.user.name} booked "${populatedBooking.consultation.title}".`,
    messageAr: `${populatedBooking.user.name} حجز "${populatedBooking.consultation.title}".`,
    link: '/admin/consultation-bookings',
    metadata: { bookingId: populatedBooking._id },
  });

  return populatedBooking;
};

export const getByUser = async (userId) => {
  const bookings = await ConsultationBooking.find({ user: userId })
    .populate('consultation')
    .sort({ createdAt: -1 });
  return attachLatestPayments(bookings);
};

export const getAll = async (filters) => {
  const query = {};
  if (filters && filters.status) {
    query.status = filters.status;
  }
  const bookings = await ConsultationBooking.find(query)
    .populate('consultation user')
    .sort({ createdAt: -1 });
  return attachLatestPayments(bookings);
};

export const getById = async (id) => {
  const booking = await ConsultationBooking.findById(id)
    .populate('consultation user reviewedBy');
  return attachLatestPayments(booking);
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

  await notify.user(booking.user._id, {
    type: 'consultation.confirmed',
    title: 'Your consultation was confirmed',
    titleAr: 'تم تأكيد استشارتك',
    message: `"${booking.consultation.title}" is confirmed. Check your booking for the meeting link.`,
    messageAr: `تم تأكيد "${booking.consultation.title}". راجع حجزك للحصول على رابط الاجتماع.`,
    link: '/dashboard/consultations',
    metadata: { bookingId: booking._id },
  });

  return booking;
};

export const reject = async (id, adminId, reason) => {
  const booking = await ConsultationBooking.findById(id).populate('consultation user');
  if (!booking) throw new Error('Booking not found');

  const latestPayment = await Payment.findOne({
    consultationBooking: booking._id,
    status: { $in: ['approved', 'captured'] },
  }).sort({ createdAt: -1 });

  if (latestPayment && latestPayment.refundStatus !== 'refunded') {
    await refundSuccessfulPayment(latestPayment._id, {
      reason: reason || 'Consultation booking rejected.',
      refundedBy: adminId,
    });
  }
  
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

  await notify.user(booking.user._id, {
    type: 'consultation.rejected',
    title: 'Update on your consultation booking',
    titleAr: 'تحديث بخصوص حجز استشارتك',
    message: reason
      ? `"${booking.consultation.title}" was not approved: ${reason}`
      : `"${booking.consultation.title}" was not approved.`,
    messageAr: reason
      ? `لم تتم الموافقة على "${booking.consultation.title}": ${reason}`
      : `لم تتم الموافقة على "${booking.consultation.title}".`,
    link: '/dashboard/consultations',
    metadata: { bookingId: booking._id },
  });

  return booking;
};

export const cancelByUser = async (id, userId) => {
  const booking = await ConsultationBooking.findById(id).populate('consultation user');
  if (!booking) throw new Error('Booking not found');
  
  const bookingUserId = booking.user?._id ? booking.user._id.toString() : booking.user.toString();
  if (bookingUserId !== userId) {
    throw new Error('Not authorized to cancel this booking');
  }
  
  if (!['pending', 'payment_pending'].includes(booking.status)) {
    throw new Error('Can only cancel pending bookings');
  }

  const latestPayment = await Payment.findOne({
    consultationBooking: booking._id,
    status: { $in: ['approved', 'captured'] },
  }).sort({ createdAt: -1 });

  if (latestPayment && latestPayment.refundStatus !== 'refunded') {
    await refundSuccessfulPayment(latestPayment._id, {
      reason: 'Consultation booking cancelled by member.',
    });
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

  await notify.admins({
    type: 'consultation.cancelled_by_member',
    title: 'Consultation booking cancelled',
    titleAr: 'تم إلغاء حجز استشارة',
    message: `${booking.user.name} cancelled "${booking.consultation.title}".`,
    messageAr: `${booking.user.name} ألغى "${booking.consultation.title}".`,
    link: '/admin/consultation-bookings',
    metadata: { bookingId: booking._id },
  });

  return booking;
};

export const remove = async (id) => {
  const booking = await ConsultationBooking.findById(id);
  if (!booking) {
    throw new Error('Booking not found');
  }

  await Payment.deleteMany({ consultationBooking: booking._id });
  await booking.deleteOne();

  return booking;
};
