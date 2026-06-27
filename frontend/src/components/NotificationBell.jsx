import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useNotificationStore from '../store/notificationStore';
import { useLocale } from '../i18n/useLocale';

const formatRelativeTime = (dateString, isRTL) => {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return isRTL ? 'الآن' : 'just now';
  if (minutes < 60) return isRTL ? `منذ ${minutes} د` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isRTL ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return isRTL ? `منذ ${days} ي` : `${days}d ago`;
  return date.toLocaleDateString();
};

function NotificationBell() {
  const navigate = useNavigate();
  const { isRTL } = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const {
    notifications,
    unreadCount,
    loading,
    startPolling,
    stopPolling,
    fetchNotifications,
    markRead,
    markAllRead,
    remove,
    clearAll,
  } = useNotificationStore();

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    fetchNotifications();
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, fetchNotifications]);

  const handleOpenNotification = (notification) => {
    markRead(notification._id);
    if (notification.link) {
      setOpen(false);
      navigate(notification.link);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 text-gray-500 hover:text-gray-900 transition-colors"
        aria-label={isRTL ? 'الإشعارات' : 'Notifications'}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            dir={isRTL ? 'rtl' : 'ltr'}
            className={`absolute mt-2 w-80 sm:w-96 max-h-[28rem] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl z-50 ${isRTL ? 'left-0' : 'right-0'}`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">{isRTL ? 'الإشعارات' : 'Notifications'}</h3>
              <div className="flex items-center gap-3 text-xs">
                {notifications.some((item) => !item.isRead) && (
                  <button onClick={() => markAllRead()} className="text-primary-600 hover:text-primary-700">
                    {isRTL ? 'تعليم الكل كمقروء' : 'Mark all read'}
                  </button>
                )}
                {notifications.length > 0 && (
                  <button onClick={() => clearAll()} className="text-gray-400 hover:text-red-500">
                    {isRTL ? 'مسح الكل' : 'Clear all'}
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[24rem]">
              {loading && notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</p>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">{isRTL ? 'لا توجد إشعارات' : 'No notifications yet'}</p>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`group flex items-start gap-3 px-4 py-3 border-b border-gray-50 transition-colors hover:bg-gray-50 ${notification.isRead ? '' : 'bg-primary-50/40'}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenNotification(notification)}
                      className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      <div className="flex items-center gap-2">
                        {!notification.isRead && <span className="h-2 w-2 rounded-full bg-primary-500 shrink-0" />}
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {(isRTL && notification.titleAr) || notification.title}
                        </p>
                      </div>
                      {((isRTL && notification.messageAr) || notification.message) && (
                        <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                          {(isRTL && notification.messageAr) || notification.message}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-gray-400">{formatRelativeTime(notification.createdAt, isRTL)}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(notification._id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                      aria-label={isRTL ? 'حذف' : 'Delete'}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NotificationBell;
