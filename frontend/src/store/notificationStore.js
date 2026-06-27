import { create } from 'zustand';
import { notificationsAPI } from '../services/api';

const POLL_INTERVAL_MS = 30000;
let pollTimer = null;

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  hasLoadedList: false,

  fetchUnreadCount: async () => {
    try {
      const response = await notificationsAPI.getUnreadCount();
      set({ unreadCount: response.data.count || 0 });
    } catch {
      // Silent: notifications are non-critical; avoid noisy errors on poll.
    }
  },

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const response = await notificationsAPI.getAll({ limit: 30 });
      const notifications = response.data || [];
      set({
        notifications,
        unreadCount: notifications.filter((item) => !item.isRead).length,
        hasLoadedList: true,
      });
    } catch {
      // ignore
    } finally {
      set({ loading: false });
    }
  },

  markRead: async (id) => {
    const target = get().notifications.find((item) => item._id === id);
    if (target && target.isRead) {
      return;
    }
    set((state) => ({
      notifications: state.notifications.map((item) => (
        item._id === id ? { ...item, isRead: true } : item
      )),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
    try {
      await notificationsAPI.markRead(id);
    } catch {
      // ignore; UI already updated optimistically
    }
  },

  markAllRead: async () => {
    set((state) => ({
      notifications: state.notifications.map((item) => ({ ...item, isRead: true })),
      unreadCount: 0,
    }));
    try {
      await notificationsAPI.markAllRead();
    } catch {
      // ignore
    }
  },

  remove: async (id) => {
    const target = get().notifications.find((item) => item._id === id);
    set((state) => ({
      notifications: state.notifications.filter((item) => item._id !== id),
      unreadCount: target && !target.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }));
    try {
      await notificationsAPI.remove(id);
    } catch {
      // ignore
    }
  },

  clearAll: async () => {
    set({ notifications: [], unreadCount: 0 });
    try {
      await notificationsAPI.clearAll();
    } catch {
      // ignore
    }
  },

  startPolling: () => {
    if (pollTimer) {
      return;
    }
    get().fetchUnreadCount();
    pollTimer = setInterval(() => {
      get().fetchUnreadCount();
    }, POLL_INTERVAL_MS);
  },

  stopPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    set({ notifications: [], unreadCount: 0, hasLoadedList: false });
  },
}));

export default useNotificationStore;
