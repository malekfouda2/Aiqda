import * as notificationsService from './notifications.service.js';

export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await notificationsService.getForUser(req.user.id, {
      unreadOnly: req.query.unreadOnly === 'true',
      limit: req.query.limit,
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const count = await notificationsService.getUnreadCount(req.user.id);
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const markRead = async (req, res) => {
  try {
    const notification = await notificationsService.markRead(req.user.id, req.params.id);
    res.json(notification);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const markAllRead = async (req, res) => {
  try {
    const result = await notificationsService.markAllRead(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const result = await notificationsService.remove(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const clearAll = async (req, res) => {
  try {
    const result = await notificationsService.clearAll(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
