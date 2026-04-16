import { Link } from 'react-router-dom';

import useAuthStore from '../store/authStore';

function Footer() {
  const { user, isAdmin, isInstructor } = useAuthStore();

  const primaryLinks = [
    { to: '/', label: 'Home' },
    { to: '/courses', label: 'Chapters' },
    { to: '/consultations', label: 'Consultations' },
    { to: '/contact-us', label: 'Contact Us' },
    { to: '/about', label: 'About Us' },
  ];

  const legalLinks = [
    { to: '/privacy-policy', label: 'Privacy Policy' },
    { to: '/terms-and-conditions-for-users', label: 'Terms & Conditions For Users' },
    { to: '/terms-and-conditions-for-creators', label: 'Terms & Conditions For Creators' },
    { to: '/refund-policy', label: 'Refund Policy' },
  ];

  const accountLinks = user
    ? [
        { to: '/dashboard', label: 'Dashboard' },
        ...(isAdmin() ? [{ to: '/admin', label: 'Admin Panel' }] : []),
        ...(isInstructor() && !isAdmin() ? [{ to: '/instructor', label: 'Creator Panel' }] : []),
      ]
    : [
        { to: '/login', label: 'Login' },
        { to: '/register', label: 'Register' },
      ];

  return (
    <footer className="py-12 border-t border-gray-200 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
          <div className="space-y-3 max-w-sm">
            <img src="/logo.png" alt="Aiqda" className="h-14 w-auto" />
            <p className="text-sm text-gray-500 leading-relaxed">
              Aiqda is a premium skills improvement platform designed for those who seek excellence in creativity. Discover videos that inspire and transform.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 lg:gap-12">
            <div>
              <h2 className="text-sm font-semibold tracking-[0.2em] uppercase text-gray-400 mb-4">
                Explore
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
                Account
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
                Legal
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

        <div className="pt-6 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Aiqda. All rights reserved.
          </p>
          <p className="text-sm text-gray-400">
            Designed for professional growth, creator development, and studio collaboration.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
