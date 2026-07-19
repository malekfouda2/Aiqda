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
import { deleteUploadPathIfExists } from '../../utils/uploadPaths.js';
import { prepareVimeoVideoForEmbed } from '../video/video.service.js';
import { notify } from '../notifications/notify.js';

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

// Admin-only: sets/replaces a creator's teaser video by Vimeo video ID. The video
// is verified and secured on Vimeo exactly like a lesson video (no watermark).
export const setCreatorTeaser = async (creatorId, vimeoVideoId) => {
  if (!String(vimeoVideoId || '').replace(/[^0-9]/g, '')) {
    throw new Error('A Vimeo video ID is required');
  }
  const user = await User.findById(creatorId);
  if (!user || user.role !== 'instructor') {
    throw new Error('Creator not found');
  }

  const { vimeoVideoId: cleanId, vimeoEmbedUrl } = await prepareVimeoVideoForEmbed(vimeoVideoId);
  user.teaserVimeoVideoId = cleanId;
  user.teaserVimeoEmbedUrl = vimeoEmbedUrl;
  await user.save();

  return { teaserVimeoVideoId: cleanId, teaserVimeoEmbedUrl: vimeoEmbedUrl };
};

export const deleteCreatorTeaser = async (creatorId) => {
  const user = await User.findById(creatorId);
  if (!user || user.role !== 'instructor') {
    throw new Error('Creator not found');
  }
  user.teaserVimeoVideoId = null;
  user.teaserVimeoEmbedUrl = null;
  await user.save();

  return { teaserVimeoVideoId: null, teaserVimeoEmbedUrl: null };
};

// Admin-only: sets how many chapters a creator may create (1 by default).
export const setCreatorChapterLimit = async (creatorId, limit) => {
  const parsed = Number(limit);
  const isProvided = limit !== null && limit !== undefined && limit !== '' && typeof limit !== 'boolean';
  if (!isProvided || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Chapter limit must be a non-negative whole number');
  }
  const user = await User.findById(creatorId);
  if (!user || user.role !== 'instructor') {
    throw new Error('Creator not found');
  }
  user.chapterLimit = parsed;
  await user.save();

  await notify.user(user._id, {
    type: 'creator.chapter_limit_updated',
    title: 'Your chapter limit was updated',
    titleAr: 'تم تحديث حد الفصول الخاص بك',
    message: `You can now create up to ${parsed} chapter${parsed === 1 ? '' : 's'}.`,
    messageAr: `يمكنك الآن إنشاء ما يصل إلى ${parsed} فصل.`,
    link: '/creator',
    metadata: { chapterLimit: parsed },
  });

  return { chapterLimit: user.chapterLimit };
};

// Public creator page payload: profile + teaser + published chapters.
export const getPublicCreatorProfile = async (creatorId) => {
  const creator = await User.findById(creatorId).select('name avatar role teaserVimeoVideoId teaserVimeoEmbedUrl isActive');
  if (!creator || creator.role !== 'instructor' || creator.isActive === false) {
    throw new Error('Creator not found');
  }

  const chapters = await Course.find({ instructor: creatorId, isPublished: true })
    .select('title description category level software order thumbnail lessonsCount')
    .sort({ order: 1, createdAt: 1 })
    .lean();

  return {
    creator: {
      _id: creator._id,
      name: creator.name,
      avatar: creator.avatar,
      teaserVimeoVideoId: creator.teaserVimeoVideoId,
      teaserVimeoEmbedUrl: creator.teaserVimeoEmbedUrl,
    },
    chapters,
  };
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

  // Notify the user when an admin (not the user themselves) changes their account.
  // isActive toggles flow through toggleUserStatus, which sends its own notice.
  const adminEditedFields = Object.keys(sanitizedUpdates).filter((field) => field !== 'isActive');
  if (isAdminRole(requester.role) && !isSelfUpdate && adminEditedFields.length > 0) {
    await notify.user(user._id, {
      type: 'account.updated_by_admin',
      title: 'Your account details were updated',
      titleAr: 'تم تحديث بيانات حسابك',
      message: 'An admin updated your account details.',
      messageAr: 'قام المدير بتحديث بيانات حسابك.',
      link: '/dashboard',
      metadata: { fields: adminEditedFields },
    });
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

  await notify.user(user._id, {
    type: user.isActive ? 'account.activated' : 'account.deactivated',
    title: user.isActive ? 'Your account was activated' : 'Your account was deactivated',
    titleAr: user.isActive ? 'تم تفعيل حسابك' : 'تم إيقاف حسابك',
    message: user.isActive
      ? 'An admin activated your account. You can now sign in and use the platform.'
      : 'An admin deactivated your account. Contact support if you think this is a mistake.',
    messageAr: user.isActive
      ? 'قام المدير بتفعيل حسابك. يمكنك الآن تسجيل الدخول واستخدام المنصة.'
      : 'قام المدير بإيقاف حسابك. تواصل مع الدعم إذا كنت تعتقد أن هذا خطأ.',
    link: '/dashboard',
    metadata: { isActive: user.isActive },
  });

  return user;
};

// When a creator is demoted to a member, their pending/decided creator application
// is removed along with its uploaded files, and any tier assignments are cleared.
const deleteCreatorApplicationsForUser = async (user) => {
  const applications = await InstructorApplication.find({ email: user.email });
  await Promise.all(applications.map(async (application) => {
    await application.deleteOne();
    await Promise.allSettled([
      deleteUploadPathIfExists(application.cvFile),
      deleteUploadPathIfExists(application.courseMaterialsFile),
    ]);
  }));
};

export const updateUserRole = async (userId, newRole) => {
  if (!USER_ROLES.includes(newRole)) {
    throw new Error('Invalid role');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const wasCreator = user.role === 'instructor';
  const isDemotionToMember = wasCreator && newRole === 'student';

  user.role = newRole;
  if (newRole !== 'instructor') {
    user.assignedPackages = [];
  }
  await user.save();

  if (isDemotionToMember) {
    await deleteCreatorApplicationsForUser(user);
  }

  const ROLE_LABELS = { student: 'Member', instructor: 'Creator', admin: 'Admin', applications_admin: 'Applications Admin' };
  const ROLE_LABELS_AR = { student: 'عضو', instructor: 'صانع محتوى', admin: 'مدير', applications_admin: 'مدير الطلبات' };
  await notify.user(user._id, {
    type: 'role.changed',
    title: 'Your account role was updated',
    titleAr: 'تم تحديث دور حسابك',
    message: `Your role is now ${ROLE_LABELS[newRole] || newRole}.`,
    messageAr: `دورك الآن: ${ROLE_LABELS_AR[newRole] || newRole}.`,
    link: newRole === 'instructor' ? '/creator' : '/dashboard',
    metadata: { newRole },
  });

  return user;
};

export const assignSubscriptionPackages = async (userId, packageIdsInput) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.role !== 'instructor') {
    throw new Error('Only creators can be assigned to subscription tiers');
  }

  const packageIds = [...new Set(
    (Array.isArray(packageIdsInput) ? packageIdsInput : [])
      .map((entry) => entry?._id?.toString?.() || entry?.toString?.() || '')
      .filter(Boolean)
  )];

  if (packageIds.length > 0) {
    const found = await SubscriptionPackage.find({ _id: { $in: packageIds } }).select('_id').lean();
    if (found.length !== packageIds.length) {
      throw new Error('One or more selected subscription tiers were not found');
    }
  }

  user.assignedPackages = packageIds;
  await user.save();
  const populated = await user.populate('assignedPackages', 'name nameAr isActive');

  const tierNames = (populated.assignedPackages || []).map((pkg) => pkg.name).filter(Boolean);
  const tierNamesAr = (populated.assignedPackages || []).map((pkg) => pkg.nameAr || pkg.name).filter(Boolean);
  await notify.user(user._id, {
    type: 'creator.tiers_updated',
    title: 'Your subscription tier access was updated',
    titleAr: 'تم تحديث وصولك لباقات الاشتراك',
    message: tierNames.length > 0
      ? `You can now publish content to: ${tierNames.join(', ')}.`
      : 'You are not assigned to any subscription tier right now.',
    messageAr: tierNamesAr.length > 0
      ? `يمكنك الآن نشر المحتوى في: ${tierNamesAr.join('، ')}.`
      : 'لست معيّنًا في أي باقة اشتراك حاليًا.',
    link: '/creator',
    metadata: { packageIds },
  });

  return populated;
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
