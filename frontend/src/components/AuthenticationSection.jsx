import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { authenticationAPI } from '../services/api';
import { buildUploadUrl } from '../utils/uploads';
import { getSafeExternalHref } from '../utils/url';
import { fadeInUp } from '../utils/animations';
import { getLocalizedField } from '../i18n/translations';
import { useLocale } from '../i18n/useLocale';

function AuthenticationSection() {
  const { locale, isRTL } = useLocale();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await authenticationAPI.getPublic();
        setItems(response.data || []);
      } catch (error) {
        console.error('Failed to load authentication items:', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  // Hidden entirely until an admin adds content.
  if (loading || items.length === 0) {
    return null;
  }

  return (
    <section className="content-auto relative py-24 overflow-hidden border-t border-gray-100 bg-gradient-to-b from-white via-gray-50/70 to-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="floating-orb w-[300px] h-[300px] bg-primary-100/25 top-[-80px] left-[-60px] animate-float-slow" />
        <div className="floating-orb w-[260px] h-[260px] bg-cyan-100/25 bottom-[-80px] right-[-40px] animate-float" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-4">
            <span className="w-2 h-2 bg-primary-400 rounded-full animate-pulse" />
            <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">
              {locale === 'ar' ? 'الاعتمادات' : 'Authentication'}
            </span>
          </div>
          <h2 className="text-4xl font-bold text-gray-900">
            {locale === 'ar' ? 'موثوق ' : 'Trusted & '}
            <span className="gradient-text">{locale === 'ar' ? 'ومعتمد' : 'Authenticated'}</span>
          </h2>
        </motion.div>

        <div className="relative overflow-hidden rounded-[2rem] border border-gray-200/80 bg-white/70 px-4 py-6 shadow-sm sm:px-5">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white via-white/90 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white via-white/90 to-transparent" />

          <div
            className="partners-marquee-track flex"
            style={{
              '--partners-marquee-duration': `${Math.max(24, items.length * 7)}s`,
              animationDirection: isRTL ? 'reverse' : 'normal',
            }}
          >
            {[0, 1].map((copyIndex) => (
              <div key={`authentication-copy-${copyIndex}`} className="flex shrink-0 items-stretch gap-5 pe-5">
                {items.map((item) => {
                  const logoUrl = buildUploadUrl(item.image);
                  const safeWebsiteHref = getSafeExternalHref(item.website);
                  const Wrapper = safeWebsiteHref ? 'a' : 'div';
                  const wrapperProps = safeWebsiteHref ? {
                    href: safeWebsiteHref,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  } : {};

                  return (
                    <Wrapper
                      key={`${item._id}-${copyIndex}`}
                      {...wrapperProps}
                      className="group flex min-h-[152px] w-[240px] shrink-0 items-center justify-center rounded-3xl border border-gray-200 bg-white px-8 py-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-xl sm:w-[280px]"
                    >
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={getLocalizedField(item, 'name', locale)}
                          loading="lazy"
                          decoding="async"
                          className="max-h-24 w-full object-contain opacity-80 transition duration-300 group-hover:opacity-100"
                        />
                      ) : (
                        <span className="text-lg font-semibold text-gray-500 text-center">{getLocalizedField(item, 'name', locale)}</span>
                      )}
                    </Wrapper>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default AuthenticationSection;
