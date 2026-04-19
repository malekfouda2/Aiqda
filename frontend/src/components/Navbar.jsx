import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/authStore';
import useUIStore from '../store/uiStore';
import LanguageToggle from './LanguageToggle';
import { useLocale } from '../i18n/useLocale';

function Navbar() {
  const { user, logout, isAdmin, isInstructor } = useAuthStore();
  const { sidebarOpen, toggleSidebar, closeSidebar } = useUIStore();
  const navigate = useNavigate();
  const { t, isRTL, brandName } = useLocale();

  const navLinks = [
    { to: '/', label: t('common.home') },
    { to: '/courses', label: t('navbar.chapters') },
    { to: '/consultations', label: t('navbar.consultations') },
    { to: '/contact-us', label: t('common.contactUs') },
    { to: '/about', label: t('common.aboutUs') },
  ];

  if (user) {
    navLinks.push({ to: '/dashboard', label: t('navbar.dashboard') });
    if (isAdmin()) navLinks.push({ to: '/admin', label: t('navbar.admin') });
    if (isInstructor()) navLinks.push({ to: '/instructor', label: t('navbar.creator') });
  }

  const handleLogout = () => {
    logout();
    closeSidebar();
    navigate('/');
  };

  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/80 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex items-center justify-between h-20 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt={brandName} className="h-14 w-auto" />
            </Link>

            <div className={`hidden md:flex items-center gap-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to} className="text-gray-500 hover:text-gray-900 transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="hidden md:block">
              <LanguageToggle />
            </div>

            {user ? (
              <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`hidden sm:block ${isRTL ? 'text-left' : 'text-right'}`}>
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{t(`auth.role.${user.role}`, user.role)}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="btn-secondary text-sm"
                >
                  {t('common.logout')}
                </button>
              </div>
            ) : (
              <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Link to="/login" className="btn-secondary text-sm">
                  {t('common.login')}
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                  {t('navbar.getStarted')}
                </Link>
              </div>
            )}

            <button
              onClick={toggleSidebar}
              className="md:hidden p-2 text-gray-500 hover:text-gray-900"
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
            className="md:hidden fixed inset-0 top-20 z-40"
          >
            <div className="absolute inset-0 bg-black/20" onClick={closeSidebar} />
            <motion.div
              initial={{ x: isRTL ? -24 : 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isRTL ? -24 : 24, opacity: 0 }}
              className={`absolute top-4 w-72 rounded-2xl border border-gray-200 bg-white shadow-xl p-4 ${isRTL ? 'left-4' : 'right-4'}`}
            >
              <div className="space-y-2">
                <LanguageToggle className="w-full justify-center" />
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={closeSidebar}
                    className="block rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
    </motion.nav>
  );
}

export default Navbar;
