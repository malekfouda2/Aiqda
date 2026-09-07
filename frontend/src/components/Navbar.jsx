import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/authStore';
import useUIStore from '../store/uiStore';
import LanguageToggle from './LanguageToggle';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import { useLocale } from '../i18n/useLocale';

function Navbar() {
  const { user, logout, canAccessAdminPanel, canAccessMemberDashboard, isInstructor } = useAuthStore();
  const { sidebarOpen, toggleSidebar, closeSidebar } = useUIStore();
  const navigate = useNavigate();
  const { t, isRTL, brandName } = useLocale();

  const navLinks = [
    { to: '/', label: t('common.home') },
    { to: '/chapters', label: t('navbar.chapters') },
    { to: '/consultations', label: t('navbar.consultations') },
    { to: '/contact-us', label: t('common.contactUs') },
    { to: '/about', label: t('common.aboutUs') },
  ];

  if (user) {
    if (canAccessMemberDashboard()) {
      navLinks.push({ to: '/dashboard', label: t('navbar.dashboard') });
    }
    if (canAccessAdminPanel()) navLinks.push({ to: '/admin', label: t('navbar.admin') });
    if (isInstructor()) navLinks.push({ to: '/creator', label: t('navbar.creator') });
  }

  const handleLogout = () => {
    logout();
    closeSidebar();
    navigate('/');
  };

  return (
    <nav dir={isRTL ? 'rtl' : 'ltr'} className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-5 xl:px-8 2xl:px-12">
        <div className="flex h-24 items-center justify-between gap-3 lg:h-28 xl:gap-5">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-2 xl:gap-4">
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <img src="/logo.png" alt={brandName} className="h-20 w-auto lg:h-24" />
            </Link>

            <div className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] lg:flex xl:gap-3 2xl:gap-5 [&::-webkit-scrollbar]:hidden">
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to} className="shrink-0 text-[0.72rem] font-medium text-gray-600 transition-colors hover:text-gray-900 xl:text-xs 2xl:text-sm">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1.5 xl:gap-2.5">
            <div className="hidden lg:block">
              <LanguageToggle className="px-2 py-2 text-[0.72rem] xl:px-2.5 xl:text-xs" />
            </div>

            {user ? (
              <div className="flex items-center gap-1.5 xl:gap-2.5">
                <div className="hidden w-20 lg:block xl:w-32 2xl:w-48">
                  <GlobalSearch />
                </div>
                <NotificationBell />
                <div className={`${isRTL ? 'text-left' : 'text-right'} hidden max-w-[5.75rem] lg:block xl:max-w-[7rem] 2xl:max-w-[9rem]`}>
                  <p className="truncate text-[0.72rem] font-medium text-gray-900 xl:text-xs 2xl:text-sm">{user.name}</p>
                  <p className="text-[11px] text-gray-500 capitalize">{t(`auth.role.${user.role}`, user.role)}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="btn-secondary hidden px-2.5 py-2 text-[0.72rem] lg:inline-flex xl:px-3 xl:text-xs 2xl:text-sm"
                >
                  {t('common.logout')}
                </button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 lg:flex xl:gap-3">
                <Link to="/login" className="btn-secondary px-3 py-2 text-[0.72rem] xl:text-xs 2xl:text-sm">
                  {t('common.login')}
                </Link>
                <Link to="/register" className="btn-primary px-3 py-2 text-[0.72rem] xl:text-xs 2xl:text-sm">
                  {t('navbar.getStarted')}
                </Link>
              </div>
            )}

            <button
              onClick={toggleSidebar}
              className="p-2 text-gray-500 hover:text-gray-900 lg:hidden"
              aria-label="Open navigation menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 top-24 z-40 lg:hidden"
          >
            <div className="absolute inset-0 bg-black/20" onClick={closeSidebar} />
            <motion.div
              initial={{ x: isRTL ? -24 : 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isRTL ? -24 : 24, opacity: 0 }}
              dir={isRTL ? 'rtl' : 'ltr'}
              className={`absolute top-4 w-72 rounded-2xl border border-gray-200 bg-white shadow-xl p-4 ${isRTL ? 'left-4' : 'right-4'}`}
            >
              <div className="space-y-2">
                {user && (
                  <div className="md:hidden pb-1">
                    <GlobalSearch />
                  </div>
                )}
                <LanguageToggle className="w-full justify-center" />
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={closeSidebar}
                    className={`block rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {link.label}
                  </Link>
                ))}

                {user ? (
                  <button
                    onClick={handleLogout}
                    className={`w-full rounded-xl px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {t('common.logout')}
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Link to="/login" onClick={closeSidebar} className="btn-secondary justify-center text-sm">
                      {t('common.login')}
                    </Link>
                    <Link to="/register" onClick={closeSidebar} className="btn-primary justify-center text-sm">
                      {t('navbar.getStarted')}
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

export default Navbar;
