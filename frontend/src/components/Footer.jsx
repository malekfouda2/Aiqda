import { Link } from 'react-router-dom';

import useAuthStore from '../store/authStore';
import LanguageToggle from './LanguageToggle';
import { useLocale } from '../i18n/useLocale';

function Footer() {
  const { user, isAdmin, isInstructor } = useAuthStore();
  const { t, isRTL, brandName } = useLocale();

  const primaryLinks = [
    { to: '/', label: t('common.home') },
    { to: '/courses', label: t('common.chapters') },
    { to: '/consultations', label: t('common.consultations') },
    { to: '/contact-us', label: t('common.contactUs') },
    { to: '/about', label: t('common.aboutUs') },
  ];

  const legalLinks = [
    { to: '/privacy-policy', label: t('policies.privacyPolicy') },
    { to: '/terms-and-conditions-for-users', label: t('policies.userTerms') },
    { to: '/terms-and-conditions-for-creators', label: t('policies.creatorTerms') },
    { to: '/refund-policy', label: t('policies.refundPolicy') },
  ];

  const accountLinks = user
    ? [
        { to: '/dashboard', label: t('common.dashboard') },
        ...(isAdmin() ? [{ to: '/admin', label: `${t('common.admin')} Panel` }] : []),
        ...(isInstructor() && !isAdmin() ? [{ to: '/instructor', label: `${t('common.creator')} Panel` }] : []),
      ]
    : [
        { to: '/login', label: t('common.login') },
        { to: '/register', label: t('common.register') },
      ];

  return (
    <footer className="py-12 border-t border-gray-200 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className={`flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 ${isRTL ? 'lg:flex-row-reverse text-right' : ''}`}>
          <div className="space-y-3 max-w-sm">
            <img src="/logo.png" alt={brandName} className="h-14 w-auto" />
            <p className="text-sm text-gray-500 leading-relaxed">
              {t('footer.about')}
            </p>
            <div className={`inline-flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
              <img
                src="/partners/24-center-logo.png"
                alt="24 Art Center"
                className="h-12 w-auto object-contain"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                  {t('common.poweredBy')}
                </p>
                <p className="text-sm font-medium text-gray-700">
                  24 Art Center
                </p>
              </div>
            </div>
            <LanguageToggle className={isRTL ? 'justify-center' : ''} />
          </div>

          <div className="grid sm:grid-cols-3 gap-8 lg:gap-12">
            <div>
              <h2 className="text-sm font-semibold tracking-[0.2em] uppercase text-gray-400 mb-4">
                {t('common.explore')}
              </h2>
              <div className="space-y-3">
                {primaryLinks.map((link) => (
                  <Link key={link.to} to={link.to} className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold tracking-[0.2em] uppercase text-gray-400 mb-4">
                {t('common.account')}
              </h2>
              <div className="space-y-3">
                {accountLinks.map((link) => (
                  <Link key={link.to} to={link.to} className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold tracking-[0.2em] uppercase text-gray-400 mb-4">
                {t('common.legal')}
              </h2>
              <div className="space-y-3">
                {legalLinks.map((link) => (
                  <Link key={link.to} to={link.to} className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={`pt-6 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${isRTL ? 'sm:flex-row-reverse text-right' : ''}`}>
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} {brandName}. {t('common.allRightsReserved')}
          </p>
          <p className="text-sm text-gray-400">
            {t('footer.designedFor')}
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
