import User from './user.model.js';
import { hashPassword } from '../../utils/password.js';
import { PLATFORM_NOTICE_VERSION } from '../../config/platformNotice.js';
import { USER_ROLES, isAdminRole } from '../../utils/roles.js';
import Course from '../courses/course.model.js';
import Lesson from '../lessons/lesson.model.js';
import Quiz from '../quizzes/quiz.model.js';
import { LessonProgress, CourseProgress } from '../analytics/progress.model.js';
import { SubscriptionPackage, Subscription } from '../subscriptions/subscription.model.js';
import Payment from '../payments/payment.model.js';
import ConsultationBooking from '../consultations/consultationBooking.model.js';
import InstructorApplication from '../instructor-applications/instructorApplication.model.js';
import StudioApplication from '../studio-applications/studioApplication.model.js';
import ContactMessage from '../contact-messages/contactMessage.model.js';

const SELF_UPDATE_FIELDS = new Set(['name', 'avatar', 'password']);
const ADMIN_UPDATE_FIELDS = new Set(['name', 'email', 'avatar', 'password', 'isActive']);

const pickAllowedUpdates = (updates, allowedFields) => {
  return Object.entries(updates).reduce((acc, [key, value]) => {
    if (allowedFields.has(key)) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

export const getAllUsers = async (filters = {}) => {
  const query = {};
  if (filters.role) query.role = filters.role;
  if (filters.isActive !== undefined) query.isActive = filters.isActive;
  
  return User.find(query).sort({ createdAt: -1 });
};

export const getUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

export const updateUser = async (userId, updates, requester) => {
  const isSelfUpdate = requester.id === userId;
  const allowedFields = isAdminRole(requester.role) && !isSelfUpdate
    ? ADMIN_UPDATE_FIELDS
    : SELF_UPDATE_FIELDS;

  const sanitizedUpdates = pickAllowedUpdates(updates, allowedFields);

  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new Error('No valid fields to update');
  }

  if (sanitizedUpdates.password) {
    sanitizedUpdates.password = await hashPassword(sanitizedUpdates.password);
  }
  
  const user = await User.findByIdAndUpdate(userId, sanitizedUpdates, { new: true });
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

export const toggleUserStatus = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  user.isActive = !user.isActive;
  await user.save();
  return user;
};

export const updateUserRole = async (userId, newRole) => {
  if (!USER_ROLES.includes(newRole)) {
    throw new Error('Invalid role');
  }
  
  const user = await User.findByIdAndUpdate(userId, { role: newRole }, { new: true });
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

export const deleteUser = async (userId, requester) => {
  if (requester.id === userId) {
    throw new Error('Admins cannot permanently delete their own account.');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.role === 'admin') {
    const remainingAdminCount = await User.countDocuments({
      role: 'admin',
      _id: { $ne: user._id },
      isActive: true,
    });

    if (remainingAdminCount === 0) {
      throw new Error('You cannot delete the last active admin account.');
    }
  }

  const creatorCourses = await Course.find({ instructor: user._id }).select('_id');
  const creatorCourseIds = creatorCourses.map((course) => course._id);

  if (creatorCourseIds.length > 0) {
    const creatorLessons = await Lesson.find({ course: { $in: creatorCourseIds } }).select('_id');
    const creatorLessonIds = creatorLessons.map((lesson) => lesson._id);

    if (creatorLessonIds.length > 0) {
      await Quiz.deleteMany({ lesson: { $in: creatorLessonIds } });
      await LessonProgress.deleteMany({ lesson: { $in: creatorLessonIds } });
    }

    await LessonProgress.deleteMany({ course: { $in: creatorCourseIds } });
    await CourseProgress.deleteMany({ course: { $in: creatorCourseIds } });
    await Lesson.deleteMany({ course: { $in: creatorCourseIds } });
    await SubscriptionPackage.updateMany(
      { courses: { $in: creatorCourseIds } },
      { $pull: { courses: { $in: creatorCourseIds } } }
    );
    await Course.deleteMany({ _id: { $in: creatorCourseIds } });
  }

  await Course.updateMany(
    { enrolledStudents: user._id },
    { $pull: { enrolledStudents: user._id } }
  );

  await LessonProgress.deleteMany({ user: user._id });
  await CourseProgress.deleteMany({ user: user._id });

  const subscriptions = await Subscription.find({ user: user._id }).select('_id');
  const subscriptionIds = subscriptions.map((subscription) => subscription._id);

  if (subscriptionIds.length > 0) {
    await Payment.deleteMany({ subscription: { $in: subscriptionIds } });
  }

  await Subscription.deleteMany({ user: user._id });
  await Payment.deleteMany({ user: user._id });
  await ConsultationBooking.deleteMany({ user: user._id });

  await Payment.updateMany({ reviewedBy: user._id }, { $set: { reviewedBy: null, reviewedAt: null } });
  await ConsultationBooking.updateMany({ reviewedBy: user._id }, { $set: { reviewedBy: null, reviewedAt: null } });
  await InstructorApplication.updateMany({ reviewedBy: user._id }, { $set: { reviewedBy: null, reviewedAt: null } });
  await StudioApplication.updateMany({ reviewedBy: user._id }, { $set: { reviewedBy: null, reviewedAt: null } });
  await ContactMessage.updateMany({ readBy: user._id }, { $set: { readBy: null, readAt: null, isRead: false } });
  await Subscription.updateMany({ approvedBy: user._id }, { $set: { approvedBy: null, approvedAt: null } });

  await User.findByIdAndDelete(user._id);

  return { message: 'User deleted permanently' };
};

export const acknowledgePlatformNotice = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    {
      platformNoticeAcknowledgement: {
        version: PLATFORM_NOTICE_VERSION,
        acceptedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};
