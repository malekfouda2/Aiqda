import * as notificationsService from './notifications.service.js';

// Notifications must never break the business flow that triggers them. Every
// dispatch is wrapped so a failure is logged and swallowed instead of throwing
// back into the caller (e.g. a payment webhook or subscription activation).
const safe = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    console.error('Notification dispatch failed:', error?.message || error);
    return null;
  }
};

export const notify = {
  user: safe(notificationsService.createNotification),
  users: safe(notificationsService.notifyUsers),
  roles: safe(notificationsService.notifyRoles),
  admins: safe(notificationsService.notifyAdmins),
  fullAdmins: safe(notificationsService.notifyFullAdmins),
};
