import { useEffect, useMemo, useState } from 'react';

import { authAPI } from '../services/api';
import { useLocale } from '../i18n/useLocale';

const providerIcons = {
  google: {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4a9.6 9.6 0 1 0 0 19.2c5.6 0 9.3-4 9.3-9.6 0-.6-.1-1.2-.2-1.8H12Z" />
        <path fill="#4285F4" d="M3.5 7.6 6.7 10c.9-2.1 3-3.6 5.3-3.6 1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4c-3.7 0-7 2.1-8.5 5.2Z" />
        <path fill="#FBBC05" d="M12 21.6c2.6 0 4.8-.9 6.5-2.4l-3-2.5c-.8.6-1.9 1.1-3.5 1.1-3.9 0-5.2-2.6-5.5-3.9l-3.1 2.4A9.6 9.6 0 0 0 12 21.6Z" />
        <path fill="#34A853" d="M3.5 16.4 6.6 14c-.2-.5-.3-1.2-.3-2s.1-1.4.3-2L3.5 7.6A9.6 9.6 0 0 0 2.4 12c0 1.6.4 3.1 1.1 4.4Z" />
      </svg>
    ),
  },
  linkedin: {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#0A66C2" d="M20.45 20.45h-3.56v-5.58c0-1.33-.03-3.05-1.86-3.05-1.86 0-2.14 1.45-2.14 2.95v5.68H9.33V9h3.42v1.56h.05c.48-.9 1.64-1.86 3.37-1.86 3.6 0 4.27 2.37 4.27 5.45v6.3ZM5.32 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.1 20.45H3.53V9H7.1v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.8 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z" />
      </svg>
    ),
  },
};

const buildProviderHref = (startPath, redirectPath) => {
  const url = new URL(startPath, window.location.origin);
  if (redirectPath) {
    url.searchParams.set('redirect', redirectPath);
  }

  return `${url.pathname}${url.search}`;
};

function SocialAuthButtons({ redirectPath = '' }) {
  const { t } = useLocale();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchProviders = async () => {
      try {
        const response = await authAPI.getSocialProviders();
        if (!cancelled) {
          setProviders(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        if (!cancelled) {
          setProviders([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProviders();

    return () => {
      cancelled = true;
    };
  }, []);

  const socialProviders = useMemo(
    () => providers.filter((provider) => providerIcons[provider.key]),
    [providers]
  );

  if (loading || socialProviders.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-4 text-sm font-medium text-gray-400">{t('social.continueWith')}</span>
        </div>
      </div>

      <div className="grid gap-3">
        {socialProviders.map((provider) => (
          <a
            key={provider.key}
            href={buildProviderHref(provider.startPath, redirectPath)}
            className="w-full flex items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm font-semibold text-gray-700 transition-all hover:border-primary-200 hover:bg-primary-50/40 hover:text-gray-900"
          >
            <span className="shrink-0">{providerIcons[provider.key].icon}</span>
            <span>{t(`social.${provider.key}`)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export default SocialAuthButtons;
