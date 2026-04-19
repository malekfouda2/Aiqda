import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { partnersAPI } from '../services/api';
import { buildUploadUrl } from '../utils/uploads';
import { fadeInUp, staggerContainer, cardVariants } from '../utils/animations';
import { getLocalizedField } from '../i18n/translations';
import { useLocale } from '../i18n/useLocale';

function PartnersSection() {
  const { locale, t } = useLocale();
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
    <section className="relative py-24 overflow-hidden border-t border-gray-100 bg-gradient-to-b from-white via-gray-50/70 to-white">
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
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {partners.map((partner) => {
              const logoUrl = buildUploadUrl(partner.image);
              const Wrapper = partner.website ? 'a' : 'div';
              const wrapperProps = partner.website ? {
                href: partner.website,
                target: '_blank',
                rel: 'noreferrer',
              } : {};

              return (
                <motion.div
                  key={partner._id}
                  variants={cardVariants}
                  className="h-full"
                >
                  <Wrapper
                    {...wrapperProps}
                    className="group flex h-full min-h-[180px] items-center justify-center rounded-3xl border border-gray-200 bg-white px-8 py-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-xl"
                  >
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={getLocalizedField(partner, 'name', locale)}
                        className="max-h-24 w-full object-contain opacity-80 transition duration-300 group-hover:opacity-100"
                      />
                    ) : (
                      <span className="text-lg font-semibold text-gray-500">{getLocalizedField(partner, 'name', locale)}</span>
                    )}
                  </Wrapper>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </section>
  );
}

export default PartnersSection;
