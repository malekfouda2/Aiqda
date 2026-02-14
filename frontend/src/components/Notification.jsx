import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useUIStore from '../store/uiStore';

function Notification() {
  const { notifications, removeNotification } = useUIStore();

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function NotificationItem({ notification, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-700 shadow-lg',
    error: 'bg-red-50 border-red-200 text-red-700 shadow-lg',
    info: 'bg-primary-50 border-primary-200 text-primary-700 shadow-lg'
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className={`px-4 py-3 rounded-lg border backdrop-blur-sm ${colors[notification.type] || colors.info}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm">{notification.message}</span>
        <button onClick={onClose} className="text-current opacity-60 hover:opacity-100">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

export default Notification;
