import User from '../users/user.model.js';
import Course from '../courses/course.model.js';
import Lesson from '../lessons/lesson.model.js';
import Payment from '../payments/payment.model.js';
import ConsultationBooking from '../consultations/consultationBooking.model.js';
import Consultation from '../consultations/consultation.model.js';
import InstructorApplication from '../instructor-applications/instructorApplication.model.js';
import StudioApplication from '../studio-applications/studioApplication.model.js';
import ContactMessage from '../contact-messages/contactMessage.model.js';
import { SubscriptionPackage } from '../subscriptions/subscription.model.js';
import { ADMIN_ROLE, APPLICATIONS_ADMIN_ROLE } from '../../utils/roles.js';

const GROUP_LIMIT = 6;
const USER_RESOLVE_LIMIT = 25;
const MIN_QUERY_LENGTH = 2;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const group = (type, label, labelAr, items) => ({ type, label, labelAr, items });

const adminSearch = async (rx) => {
  // Resolve matching users once — reused for payments / bookings owner matching.
  const matchedUsers = await User.find({ $or: [{ name: rx }, { email: rx }] })
    .select('name email role')
    .limit(USER_RESOLVE_LIMIT)
    .lean();
  const matchedUserIds = matchedUsers.map((u) => u._id);

  const [
    courses,
    lessons,
    payments,
    bookings,
    instructorApps,
    studioApps,
    contactMessages,
    packages,
    consultations,
  ] = await Promise.all([
    Course.find({ $or: [{ title: rx }, { description: rx }] })
      .populate('instructor', 'name').limit(GROUP_LIMIT).lean(),
    Lesson.find({ $or: [{ title: rx }, { description: rx }] })
      .populate('course', 'title').limit(GROUP_LIMIT).lean(),
    Payment.find({ $or: [{ paymentReference: rx }, { user: { $in: matchedUserIds } }] })
      .populate('user', 'name email').sort({ createdAt: -1 }).limit(GROUP_LIMIT).lean(),
    ConsultationBooking.find({ $or: [{ paymentReference: rx }, { user: { $in: matchedUserIds } }] })
      .populate('user', 'name').populate('consultation', 'title').sort({ createdAt: -1 }).limit(GROUP_LIMIT).lean(),
    InstructorApplication.find({ $or: [{ fullName: rx }, { email: rx }] })
      .sort({ createdAt: -1 }).limit(GROUP_LIMIT).lean(),
    StudioApplication.find({ $or: [{ studioName: rx }, { contactEmail: rx }] })
      .sort({ createdAt: -1 }).limit(GROUP_LIMIT).lean(),
    ContactMessage.find({ $or: [{ fullName: rx }, { email: rx }, { subject: rx }] })
      .sort({ createdAt: -1 }).limit(GROUP_LIMIT).lean(),
    SubscriptionPackage.find({ $or: [{ name: rx }, { nameAr: rx }] }).limit(GROUP_LIMIT).lean(),
    Consultation.find({ $or: [{ title: rx }, { titleAr: rx }] }).limit(GROUP_LIMIT).lean(),
  ]);

  return [
    group('member', 'Members', 'الأعضاء', matchedUsers.slice(0, GROUP_LIMIT).map((u) => ({
      id: u._id, title: u.name, subtitle: `${u.role} · ${u.email}`, link: '/admin/users',
    }))),
    group('chapter', 'Chapters', 'الفصول', courses.map((c) => ({
      id: c._id, title: c.title, subtitle: c.instructor?.name || '', link: '/admin/chapters',
    }))),
    group('content', 'Content', 'المحتوى', lessons.map((l) => ({
      id: l._id, title: l.title, subtitle: l.course?.title || '', link: '/admin/chapters',
    }))),
    group('payment', 'Payments', 'المدفوعات', payments.map((p) => ({
      id: p._id, title: `${p.amount} ${p.currency} · ${p.user?.name || ''}`.trim(),
      subtitle: p.paymentReference || p.status, link: '/admin/payments',
    }))),
    group('consultation_booking', 'Consultation bookings', 'حجوزات الاستشارات', bookings.map((b) => ({
      id: b._id, title: b.consultation?.title || 'Consultation',
      subtitle: `${b.user?.name || ''} · ${b.status}`, link: '/admin/consultation-bookings',
    }))),
    group('instructor_application', 'Creator applications', 'طلبات المبدعين', instructorApps.map((a) => ({
      id: a._id, title: a.fullName, subtitle: a.email, link: '/admin/creator-applications',
    }))),
    group('studio_application', 'Studio applications', 'طلبات الاستوديوهات', studioApps.map((a) => ({
      id: a._id, title: a.studioName, subtitle: a.contactEmail, link: '/admin/studio-applications',
    }))),
    group('contact_message', 'Contact messages', 'رسائل التواصل', contactMessages.map((m) => ({
      id: m._id, title: m.subject, subtitle: `${m.fullName} · ${m.email}`, link: '/admin/contact-messages',
    }))),
    group('subscription_package', 'Subscription tiers', 'باقات الاشتراك', packages.map((p) => ({
      id: p._id, title: p.name, subtitle: p.nameAr || '', link: '/admin/subscriptions',
    }))),
    group('consultation', 'Consultations', 'الاستشارات', consultations.map((c) => ({
      id: c._id, title: c.title, subtitle: c.titleAr || '', link: '/admin/consultations',
    }))),
  ];
};

const applicationsAdminSearch = async (rx) => {
  const [instructorApps, studioApps, contactMessages] = await Promise.all([
    InstructorApplication.find({ $or: [{ fullName: rx }, { email: rx }] })
      .sort({ createdAt: -1 }).limit(GROUP_LIMIT).lean(),
    StudioApplication.find({ $or: [{ studioName: rx }, { contactEmail: rx }] })
      .sort({ createdAt: -1 }).limit(GROUP_LIMIT).lean(),
    ContactMessage.find({ $or: [{ fullName: rx }, { email: rx }, { subject: rx }] })
      .sort({ createdAt: -1 }).limit(GROUP_LIMIT).lean(),
  ]);

  return [
    group('instructor_application', 'Creator applications', 'طلبات المبدعين', instructorApps.map((a) => ({
      id: a._id, title: a.fullName, subtitle: a.email, link: '/admin/creator-applications',
    }))),
    group('studio_application', 'Studio applications', 'طلبات الاستوديوهات', studioApps.map((a) => ({
      id: a._id, title: a.studioName, subtitle: a.contactEmail, link: '/admin/studio-applications',
    }))),
    group('contact_message', 'Contact messages', 'رسائل التواصل', contactMessages.map((m) => ({
      id: m._id, title: m.subject, subtitle: `${m.fullName} · ${m.email}`, link: '/admin/contact-messages',
    }))),
  ];
};

const instructorSearch = async (rx, userId) => {
  const ownCourses = await Course.find({ instructor: userId, $or: [{ title: rx }, { description: rx }] })
    .limit(GROUP_LIMIT).lean();
  const allCourseIds = (await Course.find({ instructor: userId }).select('_id').lean()).map((c) => c._id);
  const lessons = await Lesson.find({ course: { $in: allCourseIds }, $or: [{ title: rx }, { description: rx }] })
    .populate('course', 'title').limit(GROUP_LIMIT).lean();

  return [
    group('chapter', 'Chapters', 'الفصول', ownCourses.map((c) => ({
      id: c._id, title: c.title, subtitle: c.reviewStatus, link: '/creator/chapters',
    }))),
    group('content', 'Content', 'المحتوى', lessons.map((l) => ({
      id: l._id, title: l.title, subtitle: l.course?.title || '', link: '/creator/chapters',
    }))),
  ];
};

const memberSearch = async (rx, userId) => {
  const [courses, lessons, bookings, payments] = await Promise.all([
    Course.find({ isPublished: true, $or: [{ title: rx }, { description: rx }] }).limit(GROUP_LIMIT).lean(),
    Lesson.find({ isPublished: true, $or: [{ title: rx }, { description: rx }] })
      .populate('course', 'title').limit(GROUP_LIMIT).lean(),
    ConsultationBooking.find({ user: userId }).populate('consultation', 'title')
      .sort({ createdAt: -1 }).lean(),
    Payment.find({ user: userId, paymentReference: rx }).sort({ createdAt: -1 }).limit(GROUP_LIMIT).lean(),
  ]);

  const matchedBookings = bookings
    .filter((b) => b.consultation?.title && rx.test(b.consultation.title))
    .slice(0, GROUP_LIMIT);

  return [
    group('chapter', 'Chapters', 'الفصول', courses.map((c) => ({
      id: c._id, title: c.title, subtitle: c.category || '', link: `/chapters/${c._id}`,
    }))),
    group('content', 'Content', 'المحتوى', lessons.map((l) => ({
      id: l._id, title: l.title, subtitle: l.course?.title || '',
      link: l.course?._id ? `/chapters/${l.course._id}` : '/chapters',
    }))),
    group('consultation_booking', 'My consultations', 'استشاراتي', matchedBookings.map((b) => ({
      id: b._id, title: b.consultation?.title || 'Consultation', subtitle: b.status, link: '/dashboard/consultations',
    }))),
    group('payment', 'My payments', 'مدفوعاتي', payments.map((p) => ({
      id: p._id, title: `${p.amount} ${p.currency}`, subtitle: p.paymentReference || p.status, link: '/dashboard/payments',
    }))),
  ];
};

export const globalSearch = async (user, rawQuery) => {
  const q = (rawQuery || '').trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return { query: q, groups: [] };
  }

  const rx = new RegExp(escapeRegex(q), 'i');
  let groups;

  if (user.role === ADMIN_ROLE) {
    groups = await adminSearch(rx);
  } else if (user.role === APPLICATIONS_ADMIN_ROLE) {
    groups = await applicationsAdminSearch(rx);
  } else if (user.role === 'instructor') {
    groups = await instructorSearch(rx, user.id);
  } else {
    groups = await memberSearch(rx, user.id);
  }

  return { query: q, groups: groups.filter((g) => g.items.length > 0) };
};
