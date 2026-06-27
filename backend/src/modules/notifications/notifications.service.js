import Notification from './notification.model.js';
import User from '../users/user.model.js';
import { APPLICATION_REVIEW_ROLES, ADMIN_ROLE } from '../../utils/roles.js';

const DEFAULT_LIST_LIMIT = 30;
const MAX_LIST_LIMIT = 100;

const toObjectIdStrings = (values = []) => [...new Set(
  values
    .map((value) => value?._id?.toString?.() || value?.toString?.() || '')
    .filter(Boolean)
)];

const buildNotificationDoc = (recipient, payload) => ({
  recipient,
  type: payload.type,
  title: payload.title,
  titleAr: payload.titleAr || '',
  message: payload.message || '',
  messageAr: payload.messageAr || '',
  link: payload.link || null,
  metadata: payload.metadata || {},
});

// Create a notification for a single user. Returns the created document.
export const createNotification = async (recipientId, payload) => {
  if (!recipientId || !payload?.type || !payload?.title) {
    return null;
  }
  return Notification.create(buildNotificationDoc(recipientId, payload));
};

// Create the same notification for many users in one write.
export const notifyUsers = async (recipientIds, payload) => {
  const ids = toObjectIdStrings(recipientIds);
  if (ids.length === 0 || !payload?.type || !payload?.title) {
    return { created: 0 };
  }
  const docs = ids.map((id) => buildNotificationDoc(id, payload));
  const result = await Notification.insertMany(docs, { ordered: false });
  return { created: result.length };
};

// Notify every active user holding one of the given roles. Optionally exclude a user
// (e.g. the actor who triggered the event).
export const notifyRoles = async (roles, payload, { excludeUserId = null } = {}) => {
  const query = { role: { $in: Array.isArray(roles) ? roles : [roles] }, isActive: true };
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }
  const users = await User.find(query).select('_id').lean();
  return notifyUsers(users.map((user) => user._id), payload);
};

// Convenience: notify all back-office reviewers (admin + applications_admin).
export const notifyAdmins = async (payload, options = {}) => (
  notifyRoles(APPLICATION_REVIEW_ROLES, payload, options)
);

// Convenience: notify full admins only.
export const notifyFullAdmins = async (payload, options = {}) => (
  notifyRoles([ADMIN_ROLE], payload, options)
);

export const getForUser = async (userId, { unreadOnly = false, limit = DEFAULT_LIST_LIMIT } = {}) => {
  const query = { recipient: userId };
  if (unreadOnly) {
    query.isRead = false;
  }
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
  return Notification.find(query).sort({ createdAt: -1 }).limit(safeLimit).lean();
};

export const getUnreadCount = async (userId) => (
  Notification.countDocuments({ recipient: userId, isRead: false })
);

export const markRead = async (userId, notificationId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );
  if (!notification) {
    throw new Error('Notification not found');
  }
  return notification;
};

export const markAllRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return { updated: result.modifiedCount || 0 };
};

export const remove = async (userId, notificationId) => {
  const result = await Notification.deleteOne({ _id: notificationId, recipient: userId });
  if (result.deletedCount === 0) {
    throw new Error('Notification not found');
  }
  return { message: 'Notification deleted' };
};

export const clearAll = async (userId) => {
  const result = await Notification.deleteMany({ recipient: userId });
  return { deleted: result.deletedCount || 0 };
};
