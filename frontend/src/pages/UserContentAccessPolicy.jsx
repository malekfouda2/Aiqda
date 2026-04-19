import { motion } from 'framer-motion';

import { fadeInUp, pageVariants } from '../utils/animations';
import { useLocale } from '../i18n/useLocale';

function UserContentAccessPolicy() {
  const { t, isRTL } = useLocale();

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
              <span className="text-sm text-gray-600">{t('policies.accessPolicy')}</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 text-gray-900">
              {isRTL ? (
                <>
                  <span className="gradient-text text-glow">وصول المستخدم إلى المحتوى</span> سياسة
                </>
              ) : (
                <>
                  User Content Access <span className="gradient-text text-glow">Policy</span>
                </>
              )}
            </h1>

            <p className="text-lg text-gray-500 leading-relaxed">
              {isRTL
                ? 'هذه الصفحة جاهزة لإضافة الصيغة النهائية لسياسة وصول المستخدم إلى المحتوى.'
                : 'This placeholder page is ready for the final User Content Access Policy content.'}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-gray-200 bg-gray-50 px-8 py-14 text-gray-500">
            {isRTL ? 'سيتم نشر محتوى سياسة وصول المستخدم إلى المحتوى قريبًا.' : 'User Content Access Policy content coming soon.'}
          </div>
        </div>
      </section>
    </motion.div>
  );
}

export default UserContentAccessPolicy;
