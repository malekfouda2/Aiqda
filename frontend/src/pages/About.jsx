import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import PartnersSection from '../components/PartnersSection';
import { teamMembersAPI } from '../services/api';
import { getLocalizedArrayField, getLocalizedField } from '../i18n/translations';
import { useLocale } from '../i18n/useLocale';
import { buildUploadUrl } from '../utils/uploads';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, slideInLeft, slideInRight } from '../utils/animations';

function TeamMemberAvatar({ member, locale }) {
  const imageUrl = buildUploadUrl(member.image);
  const localizedName = getLocalizedField(member, 'name', locale);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={localizedName}
        loading="lazy"
        decoding="async"
        className="w-16 h-16 rounded-2xl object-cover shrink-0 shadow-lg border border-white/80"
      />
    );
  }

  return (
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-cyan-100 border border-primary-200 flex items-center justify-center shrink-0 shadow-sm">
      <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 14a4 4 0 10-8 0m8 0a4 4 0 01-8 0m8 0v1a3 3 0 01-3 3H11a3 3 0 01-3-3v-1m8 0H8" />
      </svg>
    </div>
  );
}

function About() {
  const { locale, isRTL, brandName } = useLocale();
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const response = await teamMembersAPI.getPublic();
        setTeamMembers(response.data);
      } catch (error) {
        console.error('Failed to load team members:', error);
        setTeamMembers([]);
      } finally {
        setLoadingTeam(false);
      }
    };

    fetchTeamMembers();
  }, []);

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-white"
    >
      <section className="relative overflow-hidden pt-32 pb-24">
        <div className="absolute inset-0 mesh-gradient" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="floating-orb w-[360px] h-[360px] bg-primary-100/35 top-[-110px] left-[-60px] animate-float" />
          <div className="floating-orb w-[280px] h-[280px] bg-cyan-100/30 bottom-[-80px] right-[-50px] animate-float-slow" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div variants={fadeInUp}>
            <motion.div
              variants={slideInLeft}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6"
            >
              <span className="w-2 h-2 bg-brand-teal rounded-full animate-pulse" />
              <span className="text-sm text-gray-600">{isRTL ? 'قصتنا' : 'Our Story'}</span>
            </motion.div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              {isRTL ? (
                <>
                  مركز واحد،{' '}
                  <span className="gradient-text text-glow">كل ما يخص</span>
                  <br />
                  <span className="text-gray-900">التحريك</span>
                </>
              ) : (
                <>
                  One Center,{' '}
                  <span className="gradient-text text-glow">All Things</span>
                  <br />
                  <span className="text-gray-900">Animation</span>
                </>
              )}
            </h1>

            <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
              {isRTL
                ? 'نلهم وندعم الجيل القادم من رسامي التحريك أصحاب الرؤية في المملكة العربية السعودية، عبر مزج التراث الثقافي بسرد بصري مبتكر.'
                : 'Inspiring and nurturing the next generation of visionary animators in Saudi Arabia — blending cultural heritage with innovative storytelling.'}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="content-auto py-20 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="grid lg:grid-cols-2 gap-12 items-center"
          >
            <motion.div variants={slideInLeft}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-5">
                <span className="w-2 h-2 bg-primary-400 rounded-full" />
                <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">{isRTL ? 'رؤيتنا' : 'Our Vision'}</span>
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6 leading-snug">
                {isRTL ? 'نرسم ' : 'Shaping the '}
                <span className="gradient-text">{isRTL ? 'مستقبل' : 'Future'}</span>{' '}
                {isRTL ? 'التحريك' : 'of Animation'}
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                {isRTL
                  ? `${brandName}، بدعم من 24 Center، تربط الفنانين حول العالم وتبني مجتمعًا عالميًا يستكشف فن التحريك المتطور.`
                  : `${brandName}, powered by 24 Center, connects artists worldwide and fosters a global community exploring the evolving art of animation.`}
              </p>
            </motion.div>

            <motion.div variants={slideInRight}>
              <div className="relative p-8 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary-50 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-50 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
                <div className="relative">
                  <div className="text-5xl font-black gradient-text text-glow mb-4">"</div>
                  <blockquote className="text-xl font-semibold text-gray-800 leading-relaxed">
                    {isRTL
                      ? 'حيث يلتقي المبدعون من مختلف أنحاء العالم لصناعة الفصل القادم من فن التحريك و المؤثرات البصرية'
                      : 'Where global creators meet to shape the next chapter of animation'}
                  </blockquote>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-sm text-gray-400 font-medium uppercase tracking-widest">{isRTL ? 'رسالتنا' : 'Our Message'}</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="content-auto py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-4">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">{isRTL ? 'فريق' : 'Leadership'}</span>
            </div>
            <h2 className="text-4xl font-bold text-gray-900">
              {isRTL ? 'تعرّف إلى ' : 'Meet Our '}<span className="gradient-text">{isRTL ? 'العمل' : 'Team'}</span>
            </h2>
            <p className="mt-4 text-gray-500 text-lg max-w-xl mx-auto">
              {isRTL
                ? `خبراء محترفون حاصلون على جوائز يقودون رسالة ${brandName} للارتقاء بتعليم التحريك.`
                : `Award-winning industry professionals leading ${brandName}'s mission to elevate animation education.`}
            </p>
          </motion.div>

          {loadingTeam ? (
            <div className="grid lg:grid-cols-2 gap-8">
              {[0, 1].map((item) => (
                <div key={item} className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 animate-pulse">
                  <div className="flex items-start gap-5 mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 shrink-0" /> 
                    <div className="flex-1 space-y-3">
                      <div className="h-5 bg-gray-100 rounded-full w-2/3" />
                      <div className="h-4 bg-gray-100 rounded-full w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-100 rounded-full w-full" />
                    <div className="h-4 bg-gray-100 rounded-full w-11/12" />
                    <div className="h-4 bg-gray-100 rounded-full w-10/12" />
                  </div>
                </div>
              ))}
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-3xl px-8 py-12 text-center text-gray-500">
              {isRTL ? 'ستظهر تفاصيل الفريق هنا قريبًا.' : 'Team details will appear here soon.'}
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className="grid lg:grid-cols-2 gap-8"
            >
              {teamMembers.map((member) => (
                <motion.div
                  key={member._id}
                  variants={cardVariants}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden group"
                >
                  <div className="p-8">
                    <div className="flex items-start gap-5 mb-6">
                      <TeamMemberAvatar member={member} locale={locale} />
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {getLocalizedField(member, 'name', locale)}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {getLocalizedField(member, 'title', locale)}
                        </p>
                      </div>
                    </div>

                    <ul className="space-y-3">
                      {getLocalizedArrayField(member, 'achievements', locale).map((item, index) => (
                        <li key={`${member._id}-${index}`} className="flex items-start gap-3">
                          <span className="mt-1.5 w-5 h-5 rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                          </span>
                          <span className="text-gray-600 text-sm leading-relaxed">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="h-1 bg-gradient-to-r from-transparent via-primary-200 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      <section className="content-auto relative overflow-hidden border-t border-gray-100 bg-gradient-to-br from-primary-50 via-white to-cyan-50 py-14 sm:py-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="floating-orb w-[240px] h-[240px] bg-primary-100/25 -top-16 -left-8 animate-float-slow" />
          <div className="floating-orb w-[180px] h-[180px] bg-cyan-100/25 top-1/3 -right-8 animate-float" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            <motion.div
              variants={fadeInUp}
              className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.12),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.14),transparent_34%)]" />
              <div className="absolute top-0 left-0 h-full w-2 bg-gradient-to-b from-primary-400 via-brand-teal to-brand-blue" />
              <div className="absolute -top-16 right-12 h-40 w-40 rounded-full border border-primary-100/80 bg-white/40" />
              <div className="absolute bottom-6 right-6 h-24 w-24 rounded-[2rem] border border-cyan-100/80 bg-cyan-50/60 rotate-12" />

              <div className="relative grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-12 lg:py-12">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/85 px-4 py-2 shadow-sm mb-6">
                    <span className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-pulse" />
                    <span className="text-xs text-gray-500 uppercase tracking-[0.28em] font-semibold">
                      {isRTL ? 'التواصل' : 'Contact'}
                    </span>
                  </div>

                  <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.05] mb-5">
                    {isRTL ? 'هل أنت مستعد لـ ' : 'Ready to '}
                    <span className="gradient-text">{isRTL ? 'الارتقاء' : 'Elevate'}</span>
                    {isRTL ? ' بمهاراتك؟' : ' Your Skills?'}
                  </h2>

                  <p className="text-lg sm:text-xl text-gray-600 leading-relaxed max-w-xl">
                    {isRTL ? 'تواصل معنا وابدأ رحلتك في عالم التحريك اليوم.' : 'Get in touch with us and start your animation journey today.'}
                  </p>
                </div>

                <div className="relative">
                  <div className="rounded-[1.75rem] border border-gray-200/80 bg-white/90 p-5 sm:p-6 shadow-[0_18px_45px_rgba(236,72,153,0.10)]">
                    <div className="flex flex-col gap-4">
                      <Link to="/contact-us" className="btn-primary w-full justify-center text-base sm:text-lg py-4">
                        {isRTL ? 'الذهاب إلى صفحة التواصل' : 'Go to Contact Us'}
                      </Link>

                      <a
                        href="mailto:info@24center.edu.sa"
                        className="group flex items-center justify-between gap-4 rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-50 via-white to-cyan-50 px-5 py-4 transition-all duration-300 hover:border-primary-200 hover:shadow-md"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-gray-400 font-semibold mb-1">
                            {isRTL ? 'البريد الإلكتروني' : 'Email'}
                          </p>
                          <p className="text-base sm:text-lg font-semibold text-primary-500 break-all">
                            info@24center.edu.sa
                          </p>
                        </div>
                        <span className={`shrink-0 text-primary-400 transition-transform duration-300 ${isRTL ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={isRTL ? 'M8 12h8m0 0l-3-3m3 3l-3 3' : 'M5 12h14m0 0l-3-3m3 3l-3 3'} />
                          </svg>
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <PartnersSection />
    </motion.div>
  );
}

export default About;
