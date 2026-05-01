import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { partnersAPI } from '../services/api';
import { buildUploadUrl } from '../utils/uploads';
import { getSafeExternalHref } from '../utils/url';
import { fadeInUp } from '../utils/animations';
import { getLocalizedField } from '../i18n/translations';
import { useLocale } from '../i18n/useLocale';

function PartnersSection() {
  const { locale, isRTL } = useLocale();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const response = await partnersAPI.getPublic();
        setPartners(response.data || []);
      } catch (error) {
        console.error('Failed to load partners:', error);
        setPartners([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPartners();
  }, []);

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
              {locale === 'ar' ? 'شركاؤنا' : 'Our Partners'}
            </span>
          </div>
          <h2 className="text-4xl font-bold text-gray-900">
            {locale === 'ar' ? 'شركاء ' : 'Trusted '}
            <span className="gradient-text">{locale === 'ar' ? 'موثوقون' : 'Partners'}</span>
          </h2>
          <p className="mt-4 text-gray-500 text-lg max-w-2xl mx-auto">
            {locale === 'ar'
              ? 'نتعاون مع مؤسسات ومنظمات إبداعية تساعدنا على توسيع الفرص ورفع الجودة وتعظيم الأثر.'
              : 'We collaborate with institutions and creative organizations that help expand opportunity, quality, and impact.'}
          </p>
        </motion.div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-40 rounded-3xl border border-gray-200 bg-white/80 animate-pulse" />
            ))}
          </div>
        ) : partners.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white/80 px-8 py-12 text-center text-gray-500">
            {locale === 'ar' ? 'ستظهر شعارات الشركاء هنا قريبًا.' : 'Partner logos will appear here soon.'}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[2rem] border border-gray-200/80 bg-white/70 px-4 py-6 shadow-sm sm:px-5">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white via-white/90 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white via-white/90 to-transparent" />

            <div
              className="partners-marquee-track flex"
              style={{
                '--partners-marquee-duration': `${Math.max(24, partners.length * 7)}s`,
                animationDirection: isRTL ? 'reverse' : 'normal',
              }}
            >
              {[0, 1].map((copyIndex) => (
                <div key={`partners-copy-${copyIndex}`} className="flex shrink-0 items-stretch gap-5 pe-5">
                  {partners.map((partner) => {
                    const logoUrl = buildUploadUrl(partner.image);
                    const safeWebsiteHref = getSafeExternalHref(partner.website);
                    const Wrapper = safeWebsiteHref ? 'a' : 'div';
                    const wrapperProps = safeWebsiteHref ? {
                      href: safeWebsiteHref,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                    } : {};

                    return (
                      <Wrapper
                        key={`${partner._id}-${copyIndex}`}
                        {...wrapperProps}
                        className="group flex min-h-[152px] w-[240px] shrink-0 items-center justify-center rounded-3xl border border-gray-200 bg-white px-8 py-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-xl sm:w-[280px]"
                      >
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={getLocalizedField(partner, 'name', locale)}
                            loading="lazy"
                            decoding="async"
                            className="max-h-24 w-full object-contain opacity-80 transition duration-300 group-hover:opacity-100"
                          />
                        ) : (
                          <span className="text-lg font-semibold text-gray-500 text-center">{getLocalizedField(partner, 'name', locale)}</span>
                        )}
                      </Wrapper>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default PartnersSection;
