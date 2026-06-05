import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';
import { useLocale } from '../i18n/useLocale';
import { isApplicationsAdminRole } from '../utils/roles';

function DashboardSidebar({ type }) {
  const { user } = useAuthStore();
  const { t, isRTL } = useLocale();

  const studentLinks = [
    { to: '/dashboard', icon: '🏠', label: t('common.overview'), end: true },
    { to: '/dashboard/subscription', icon: '💳', label: t('common.subscriptions') },
    { to: '/dashboard/payments', icon: '📝', label: t('common.payments') },
    { to: '/dashboard/consultations', icon: '🎯', label: t('common.consultations') },
    { to: '/chapters', icon: '📚', label: `${t('common.browseMore')} ${t('common.chapters')}` },
    { to: '/contact-us', icon: '✉️', label: t('common.contactUs') },
  ];

  const adminLinks = [
    { to: '/admin', icon: '📊', label: t('common.overview'), end: true },
    { to: '/admin/contact-messages', icon: '✉️', label: 'Contact Inbox' },
    { to: '/admin/whatsapp-settings', icon: '💬', label: 'WhatsApp Chat' },
    { to: '/admin/team-members', icon: '🧑‍🎨', label: 'Team Members' },
    { to: '/admin/partners', icon: '🤝', label: t('common.partners') },
    { to: '/admin/payments', icon: '💳', label: t('common.payments') },
    { to: '/admin/subscriptions', icon: '📋', label: t('common.subscriptions') },
    { to: '/admin/users', icon: '👥', label: t('common.users') },
    { to: '/admin/chapters', icon: '📚', label: t('common.chapters') },
    { to: '/admin/creators', icon: '👨‍🏫', label: t('common.creators') },
    { to: '/admin/creator-applications', icon: '🎓', label: 'Creator Applications' },
    { to: '/admin/studio-applications', icon: '🎬', label: 'Studio Apps' },
    { to: '/admin/consultations', icon: '🎯', label: t('common.consultations') },
    { to: '/admin/consultation-bookings', icon: '📅', label: 'Consult Bookings' },
  ];

  const reviewerLinks = [
    { to: '/admin/creator-applications', icon: '🎓', label: 'Creator Applications', end: true },
    { to: '/admin/studio-applications', icon: '🎬', label: 'Studio Apps' },
  ];

  const instructorLinks = [
    { to: '/creator', icon: '📊', label: t('common.overview'), end: true },
    { to: '/creator/chapters', icon: '📚', label: `My ${t('common.chapters')}` },
    { to: '/contact-us', icon: '✉️', label: t('common.contactUs') },
  ];

  const isLimitedReviewer = isApplicationsAdminRole(user?.role);
  const links = type === 'admin'
    ? (isLimitedReviewer ? reviewerLinks : adminLinks)
    : type === 'instructor'
      ? instructorLinks
      : studentLinks;
  const title = type === 'admin'
    ? (isLimitedReviewer ? t('auth.role.applications_admin') : `${t('common.admin')} Panel`)
    : type === 'instructor'
      ? t('common.creator')
      : `My ${t('common.dashboard')}`;

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="hidden w-64 shrink-0 lg:block"
    >
      <div className="sticky top-28 xl:top-32 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
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

        {type === 'admin' && !isLimitedReviewer && (
          <div className="p-3 pt-0">
            <div className="border-t border-gray-100 pt-3">
              <NavLink
                to="/dashboard"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 border border-transparent"
              >
                <span className="text-lg">🔄</span>
                <span>{t('common.memberView')}</span>
              </NavLink>
            </div>
          </div>
        )}
      </div>
    </motion.aside>
  );
}

function DashboardMobileNav({ type }) {
  const { t } = useLocale();
  const user = useAuthStore((state) => state.user);
  const studentLinks = [
    { to: '/dashboard', icon: '🏠', label: t('common.overview'), end: true },
    { to: '/dashboard/subscription', icon: '💳', label: t('common.subscriptions') },
    { to: '/dashboard/payments', icon: '📝', label: t('common.payments') },
    { to: '/dashboard/consultations', icon: '🎯', label: t('common.consultations') },
    { to: '/chapters', icon: '📚', label: `${t('common.browseMore')} ${t('common.chapters')}` },
    { to: '/contact-us', icon: '✉️', label: t('common.contactUs') },
  ];
  const adminLinks = [
    { to: '/admin', icon: '📊', label: t('common.overview'), end: true },
    { to: '/admin/contact-messages', icon: '✉️', label: 'Contact Inbox' },
    { to: '/admin/whatsapp-settings', icon: '💬', label: 'WhatsApp Chat' },
    { to: '/admin/team-members', icon: '🧑‍🎨', label: 'Team Members' },
    { to: '/admin/partners', icon: '🤝', label: t('common.partners') },
    { to: '/admin/payments', icon: '💳', label: t('common.payments') },
    { to: '/admin/subscriptions', icon: '📋', label: t('common.subscriptions') },
    { to: '/admin/users', icon: '👥', label: t('common.users') },
    { to: '/admin/chapters', icon: '📚', label: t('common.chapters') },
    { to: '/admin/creators', icon: '👨‍🏫', label: t('common.creators') },
    { to: '/admin/creator-applications', icon: '🎓', label: 'Creator Applications' },
    { to: '/admin/studio-applications', icon: '🎬', label: 'Studio Apps' },
    { to: '/admin/consultations', icon: '🎯', label: t('common.consultations') },
    { to: '/admin/consultation-bookings', icon: '📅', label: 'Consult Bookings' },
  ];
  const reviewerLinks = [
    { to: '/admin/creator-applications', icon: '🎓', label: 'Creator Applications', end: true },
    { to: '/admin/studio-applications', icon: '🎬', label: 'Studio Apps' },
  ];
  const instructorLinks = [
    { to: '/creator', icon: '📊', label: t('common.overview'), end: true },
    { to: '/creator/chapters', icon: '📚', label: `My ${t('common.chapters')}` },
    { to: '/contact-us', icon: '✉️', label: t('common.contactUs') },
  ];
  const links = type === 'admin'
    ? (isApplicationsAdminRole(user?.role) ? reviewerLinks : adminLinks)
    : type === 'instructor'
      ? instructorLinks
      : studentLinks;

  return (
    <div className="mb-4 overflow-x-auto lg:hidden sm:mb-6">
      <div className="flex min-w-max gap-2 pb-2">
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
