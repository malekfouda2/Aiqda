import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { fadeInUp, pageVariants } from '../utils/animations';
import { privacyPolicyMeta, privacyPolicySections } from '../content/privacyPolicy';
import { useLocale } from '../i18n/useLocale';

function PrivacyPolicy() {
  const { pick, t, isRTL, brandName } = useLocale();

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-white"
    >
      <section className="relative overflow-hidden pt-32 pb-24">
        <div className="absolute inset-0 mesh-gradient" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeInUp} className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
              <span className="w-2 h-2 bg-brand-teal rounded-full animate-pulse" />
              <span className="text-sm text-gray-600">{t('policies.privacyPolicy')}</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 text-gray-900">
              {isRTL ? (
                <>
                  <span className="gradient-text text-glow">الخصوصية</span> سياسة
                </>
              ) : (
                <>
                  Privacy <span className="gradient-text text-glow">Policy</span>
                </>
              )}
            </h1>

            <p className="text-lg text-gray-500 leading-relaxed max-w-3xl">
              {pick(privacyPolicySections[0].paragraphs[0])}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/80">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-400 uppercase tracking-[0.2em] font-semibold">{t('common.reference')}</p>
                  <p className="text-lg font-semibold text-gray-900">{privacyPolicyMeta.reference}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 uppercase tracking-[0.2em] font-semibold">{t('common.effectiveDate')}</p>
                  <p className="text-lg font-semibold text-gray-900">{pick(privacyPolicyMeta.effectiveDate)}</p>
                </div>
              </div>
            </div>

            <div className="px-8 py-10 space-y-10">
              {privacyPolicySections.map((section) => (
                <div key={pick(section.title)} className="space-y-4">
                  <h2 className="text-2xl font-bold text-gray-900">{pick(section.title)}</h2>
                  {section.paragraphs?.map((paragraph, index) => (
                    <p key={`${pick(section.title)}-paragraph-${index}`} className="text-gray-600 leading-8">
                      {pick(paragraph)}
                    </p>
                  ))}
                  {section.bullets?.length ? (
                    <div className="space-y-3">
                      {section.bullets.map((item, index) => (
                        <div key={`${pick(section.title)}-bullet-${index}`} className="flex items-start gap-3">
                          <span className="mt-2 h-2.5 w-2.5 rounded-full bg-primary-500 shrink-0" />
                          <p className="text-gray-600 leading-7">{pick(item)}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}

              <div className="rounded-3xl border border-primary-100 bg-primary-50/60 px-6 py-5">
                <p className="text-sm text-gray-600 leading-7">
                  {isRTL
                    ? `للاستفسار عن هذه السياسة أو لممارسة حقوقك، يرجى التواصل معنا عبر قنوات الدعم الرسمية الخاصة بـ ${brandName} أو من خلال صفحة `
                    : `For questions about this policy or to exercise your rights, please contact us through the official ${brandName} support channels or use the `}
                  <Link to="/contact-us" className="text-primary-600 font-medium hover:text-primary-700">{t('common.contactUs')}</Link>
                  {isRTL ? '.' : ' page.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}

export default PrivacyPolicy;
