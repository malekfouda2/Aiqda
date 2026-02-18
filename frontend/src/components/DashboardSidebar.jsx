import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';

const studentLinks = [
  { to: '/dashboard', icon: '🏠', label: 'Overview', end: true },
  { to: '/dashboard/subscription', icon: '💳', label: 'Subscription' },
  { to: '/dashboard/payments', icon: '📝', label: 'Payments' },
  { to: '/courses', icon: '📚', label: 'Browse Courses' },
];

const adminLinks = [
  { to: '/admin', icon: '📊', label: 'Overview', end: true },
  { to: '/admin/payments', icon: '💳', label: 'Payments' },
  { to: '/admin/subscriptions', icon: '📋', label: 'Subscriptions' },
  { to: '/admin/users', icon: '👥', label: 'Users' },
  { to: '/admin/courses', icon: '📚', label: 'Courses' },
  { to: '/admin/instructor-applications', icon: '🎓', label: 'Applications' },
];

const instructorLinks = [
  { to: '/instructor', icon: '📊', label: 'Overview', end: true },
];

function DashboardSidebar({ type }) {
  const { user } = useAuthStore();
  const location = useLocation();

  const links = type === 'admin' ? adminLinks : type === 'instructor' ? instructorLinks : studentLinks;
  const title = type === 'admin' ? 'Admin Panel' : type === 'instructor' ? 'Instructor' : 'My Dashboard';

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="w-64 shrink-0 hidden lg:block"
    >
      <div className="sticky top-24 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{title}</p>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 border border-primary-100'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                }`
              }
            >
              <span className="text-lg">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        {type === 'admin' && (
          <div className="p-3 pt-0">
            <div className="border-t border-gray-100 pt-3">
              <NavLink
                to="/dashboard"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 border border-transparent"
              >
                <span className="text-lg">🔄</span>
                <span>Student View</span>
              </NavLink>
            </div>
          </div>
        )}
      </div>
    </motion.aside>
  );
}

function DashboardMobileNav({ type }) {
  const links = type === 'admin' ? adminLinks : type === 'instructor' ? instructorLinks : studentLinks;

  return (
    <div className="lg:hidden mb-6 overflow-x-auto">
      <div className="flex gap-2 min-w-max pb-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? 'bg-primary-500 text-white shadow-md shadow-primary-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-200 hover:text-primary-600'
              }`
            }
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export { DashboardSidebar, DashboardMobileNav };
