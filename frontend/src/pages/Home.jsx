import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import useAuthStore from "../store/authStore";
import PartnersSection from "../components/PartnersSection";
import { subscriptionsAPI } from "../services/api";
import { getLocalizedField } from "../i18n/translations";
import { useLocale } from "../i18n/useLocale";
import {
  SUBSCRIPTION_DEVICE_LIMIT_DISCLAIMER,
  SUBSCRIPTION_DEVICE_LIMIT_TITLE,
} from "../content/subscriptionPolicy";
import {
  formatMoney,
  getActiveBillingOptions,
  getAnnualSavings,
  getBillingCadenceLabel,
  getBillingOption,
  getBillingTermLabel,
  getDefaultBillingTerm,
  getPackageAccessNames,
} from "../utils/subscriptions";

function Home() {
  const { locale, pick, isRTL, brandName } = useLocale();
  const { user } = useAuthStore();
  const [packages, setPackages] = useState([]);
  const [selectedTerms, setSelectedTerms] = useState({});

  useEffect(() => {
    subscriptionsAPI
      .getPackages(true)
      .then((res) => {
        const nextPackages = res.data || [];
        setPackages(nextPackages);
        setSelectedTerms(
          nextPackages.reduce((accumulator, pkg) => {
            const defaultTerm = getDefaultBillingTerm(pkg);
            if (defaultTerm) {
              accumulator[pkg._id] = defaultTerm;
            }
            return accumulator;
          }, {})
        );
      })
      .catch(() => {});
  }, []);

  const updateSelectedTerm = (packageId, billingTerm) => {
    setSelectedTerms((current) => ({
      ...current,
      [packageId]: billingTerm,
    }));
  };

  const heroStats = [
    { value: "10K+", label: isRTL ? "عضو" : "Members" },
    { value: "200+", label: isRTL ? "فصل" : "Chapters" },
    { value: "50+", label: isRTL ? "صانع محتوى" : "Creators" },
  ];

  const featureCards = [
    {
      icon: "🎯",
      iconClass: "icon-box-primary",
      title: isRTL ? "خبرات من أهل المجالء" : "Expert Creators",
      description: isRTL
        ? "استكشف كيف يشتغل المحترفون فعلًا."
        : "Improve your skills from industry professionals with years of experience in their fields.",
    },
    {
      icon: "📚",
      iconClass: "icon-box-success",
      title: isRTL ? "محتوى مبني على الممارسة" : "Project Based Chapters",
      description: isRTL
        ? "فيديوهات وموارد وأمثلة من قلب الإنتاج.."
        : "Carefully curated chapters with video contents, quizzes, and resources.",
    },
{
  icon: "📊",
  iconClass: "icon-box-accent",
  title: isRTL ? "تفاعل أذكى مع المحتوى" : "See How You Improve",
  description: isRTL
        ? "اكتشف المحتوى بطريقة تمنحك رؤية أوسع وتجربة أغنى."
        : "Monitor your skills improvement journey with detailed analytics and insights.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        <div className="absolute inset-0 mesh-gradient" />

        <div className="absolute inset-0 overflow-hidden">
          <div className="floating-orb w-[420px] h-[420px] bg-primary-100/35 top-[-120px] left-[-60px] animate-float" />
          <div className="floating-orb w-[340px] h-[340px] bg-cyan-100/35 bottom-[-120px] right-[-80px] animate-float-slow" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
            >
              <span className="w-2 h-2 bg-brand-teal rounded-full animate-pulse" />
              <span className="text-sm text-gray-600">
                {isRTL ? "منصة مميزة لتطوير المهارات" : "Premium Skills Improvement Platform"}
              </span>
            </motion.div>

            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold mb-8 tracking-tight">
              {isRTL ? (
                <>
                  <span className="gradient-text text-glow">ارتقِ</span>
                  <br />
                  <span className="text-gray-900">بمهاراتك</span>
                  <br />
                  <span className="text-gray-400">{`مع ${brandName}`}</span>
                </>
              ) : (
                <>
                  <span className="gradient-text text-glow">Elevate</span>
                  <br />
                  <span className="text-gray-900">Your Skills</span>
                  <br />
                  <span className="text-gray-400">{`With ${brandName}`}</span>
                </>
              )}
            </h1>

            <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-12 leading-relaxed">
              {isRTL
                ? `${brandName} منصة مميزة لتطوير المهارات صُممت لكل من يسعى إلى التميز الإبداعي. اكتشف محتوى مرئيًا يلهمك ويمنحك أدوات التطور.`
                : `${brandName} is a premium skills improvement platform designed for those who seek excellence in creativity. Discover videos that inspire and transform.`}
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              {user ? (
                <Link
                  to="/dashboard"
                  className="btn-primary text-lg px-10 py-4"
                >
                  {isRTL ? "اذهب إلى لوحة التحكم" : "Go to Dashboard"}
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="btn-primary text-lg px-10 py-4"
                  >
                    {isRTL ? "ابدأ تطوير مهاراتك" : "Start Improving Your Skills"}
                    <span className={isRTL ? "mr-2" : "ml-2"}>{isRTL ? "←" : "→"}</span>
                  </Link>
                  <Link
                    to="/chapters"
                    className="btn-secondary text-lg px-10 py-4"
                  >
                    {isRTL ? "تصفح الفصول" : "Browse Chapters"}
                  </Link>
                  <a
                    href="#home-creators"
                    className="btn-secondary text-lg px-10 py-4"
                  >
                    {isRTL ? "انضم إلى صنّاع المحتوى لدينا" : "Join Our Creators"}
                  </a>
                </>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="mt-20 flex items-center justify-center gap-12 text-center"
            >
              {heroStats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.9 + index * 0.1 }}
                >
                  <p className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
                    {stat.value}
                  </p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

      <section className="content-auto relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-gray-50/50 to-white" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <span className="text-primary-500 text-sm font-medium tracking-widest uppercase mb-4 block">
              {isRTL ? "لماذا نحن" : "Why Choose Us"}
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              {isRTL ? "مصممة للمبدعين اللي يبغون" : "Designed for"}
              <span className="gradient-text"> {isRTL ? "أكثر" : "Excellence"}</span>
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-lg">
              {isRTL
                ? "ادخل تجربة محتوى مختلفة تجمع الإلهام، التطبيق، ورؤى من محترفين في الصناعة."
                : "Improve your skills like never before with our curated chapters and expert creators."}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {featureCards.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
                className="card-hover text-center group"
              >
                <div
                  className={`icon-box ${feature.iconClass} mx-auto mb-6 transition-transform duration-500 group-hover:scale-110`}
                >
                  <span className="relative z-10">{feature.icon}</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-primary-500 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-500 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {packages.length > 0 && (
        <section className="content-auto relative py-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white via-primary-50/30 to-white" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <span className="text-primary-500 text-sm font-medium tracking-widest uppercase mb-4 block">
                {isRTL ? "خطط اشتراك تناسب طموحك " : "Subscription Plans"}
              </span>
<h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
  {isRTL ? "اختر" : "Choose Your"}
  <span className="gradient-text"> {isRTL ? "المسار اللي يشبهك" : "Workthrough Path"}</span>
</h2>
<p className="text-gray-500 max-w-xl mx-auto text-lg">
  {isRTL
    ? "اختر الباقة المناسبة لأهدافك، وابدأ رحلتك الإبداعية بطريقتك. استكشف الخيارات، وابدأ من المستوى اللي يناسبك اليوم."
    : "Pick the package that fits your goals and start your creative journey today."}
</p>

              <div className="mt-6 mx-auto max-w-3xl rounded-2xl border border-blue-100 bg-blue-50/80 px-5 py-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-semibold text-blue-700 shadow-sm">
                    i
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                      {pick(SUBSCRIPTION_DEVICE_LIMIT_TITLE)}
                    </p>
                    <p className="mt-1 text-sm leading-7 text-blue-900/80">
                      {pick(SUBSCRIPTION_DEVICE_LIMIT_DISCLAIMER)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <div
              className={`grid gap-8 ${packages.length === 1 ? "max-w-md mx-auto" : packages.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : "md:grid-cols-2 lg:grid-cols-3"}`}
            >
              {packages.map((pkg, index) => {
                const isContactOnly = pkg.purchaseMode === "contact_only";
                const activeBillingOptions = getActiveBillingOptions(pkg);
                const selectedTerm = selectedTerms[pkg._id] || getDefaultBillingTerm(pkg);
                const selectedOption = getBillingOption(pkg, selectedTerm);
                const annualSavings = getAnnualSavings(pkg);
                const accessNames = getPackageAccessNames(pkg);

                return (
                  <motion.div
                    key={pkg._id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.15, duration: 0.6 }}
                    className="relative bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col"
                  >
                    {index === 1 && packages.length > 1 && !isContactOnly && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-gradient-to-r from-primary-500 to-brand-teal text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                          {isRTL ? "الأكثر شيوعًا" : "Most Popular"}
                        </span>
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {getLocalizedField(pkg, "name", locale)}
                        </h3>
                        {accessNames.length > 1 && (
                          <p className="text-sm text-primary-600">
                            {isRTL
                              ? `يشمل الوصول إلى ${accessNames.slice(1).join("، ")}`
                              : `Includes access to ${accessNames.slice(1).join(", ")}`}
                          </p>
                        )}
                      </div>
                      {isContactOnly && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                          {isRTL ? "مخصص" : "Custom"}
                        </span>
                      )}
                    </div>

                    {!isContactOnly && activeBillingOptions.length > 1 && (
                      <div className="mb-5 rounded-2xl bg-gray-100 p-1 flex gap-1">
                        {activeBillingOptions.map((option) => (
                          <button
                            key={option.term}
                            type="button"
                            onClick={() => updateSelectedTerm(pkg._id, option.term)}
                            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                              selectedOption?.term === option.term
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                            }`}
                          >
                            {getBillingTermLabel(option.term, locale) || option.label || option.term}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mb-5">
                      {isContactOnly ? (
                        <>
                          <span className="text-4xl font-bold text-gray-900">
                            {isRTL ? "مخصص" : "Custom"}
                          </span>
                          <p className="text-sm text-gray-500 mt-2">
                            {isRTL
                              ? "يتم تحديد تسعير التعاون الاستراتيجي بعد جلسة التعارف والاستكشاف."
                              : "Strategic collaboration pricing is tailored after the discovery conversation."}
                          </p>
                        </>
                      ) : selectedOption ? (
                        <>
                          <span className="text-4xl font-bold text-gray-900">
                            {formatMoney(selectedOption.price, locale)}
                          </span>
                          <span className="text-gray-500 ml-1">SAR</span>
                          <p className="text-sm text-gray-500 mt-2">
                            {getBillingCadenceLabel(selectedOption.term, locale)}
                          </p>
                          {selectedOption.term === "annual" && annualSavings && (
                            <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                              <p className="text-sm font-semibold text-emerald-700">
                                {isRTL
                                  ? `وفّر ${formatMoney(annualSavings.savings, locale)} ريال سنويًا`
                                  : `Save ${formatMoney(annualSavings.savings, locale)} SAR per year`}
                              </p>
                              <p className="text-xs text-emerald-600 mt-1">
                                {isRTL
                                  ? `ما يعادل ${formatMoney(annualSavings.monthlyEquivalent, locale)} ريال شهريًا.`
                                  : `Equivalent to ${formatMoney(annualSavings.monthlyEquivalent, locale)} SAR per month.`}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">
                          {isRTL ? "سيظهر السعر عند اكتمال إعداد هذه الباقة." : "Pricing will be available once this package is configured."}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3 mb-6 flex-1">
                      {pkg.scheduleDuration && (
                        <div className="flex items-center gap-2.5 text-sm text-gray-600">
                          <span className="w-5 h-5 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0 text-xs">
                            📅
                          </span>
                          {getLocalizedField(pkg, "scheduleDuration", locale)}
                        </div>
                      )}
                      {pkg.learningMode && (
                        <div className="flex items-center gap-2.5 text-sm text-gray-600">
                          <span className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-xs">
                            💻
                          </span>
                          {getLocalizedField(pkg, "learningMode", locale)}
                        </div>
                      )}
                      {pkg.focus && (
                        <div className="flex items-center gap-2.5 text-sm text-gray-600">
                          <span className="w-5 h-5 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0 text-xs">
                            🎯
                          </span>
                          {getLocalizedField(pkg, "focus", locale)}
                        </div>
                      )}

                      {pkg.courses?.length > 0 && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                            {isRTL ? "الفصول المشمولة" : "Chapters Included"}
                          </p>
                          <ul className="space-y-1.5">
                            {pkg.courses.map((course, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-sm text-gray-600"
                              >
                                <svg
                                  className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                                {typeof course === "object"
                                  ? getLocalizedField(course, "title", locale)
                                  : course}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {pkg.softwareExposure?.length > 0 && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                            {isRTL ? "البرامج المشمولة" : "Software Exposure"}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {pkg.softwareExposure.map((sw, i) => (
                              <span
                                key={i}
                                className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full"
                              >
                                {sw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {pkg.outcome && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                            {isRTL ? "النتيجة" : "Outcome"}
                          </p>
                          <p className="text-sm text-gray-600">{getLocalizedField(pkg, "outcome", locale)}</p>
                        </div>
                      )}
                    </div>

                    <Link
                      to={isContactOnly ? "/contact-us" : user ? "/dashboard/subscription" : "/register"}
                      className={`block text-center font-semibold py-3 px-6 rounded-xl transition-all duration-300 ${
                        index === 1 && packages.length > 1 && !isContactOnly
                          ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:shadow-lg hover:shadow-primary-500/25"
                          : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                      }`}
                    >
                      {isContactOnly ? (isRTL ? "احجز موعدًا" : "Book Appointment") : (isRTL ? "ابدأ الآن" : "Get Started")}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="content-auto relative py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500 via-primary-600 to-brand-teal" />
            <div className="absolute inset-0 mesh-gradient opacity-30" />

            <div className="relative py-20 px-8 text-center">
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/20 mb-8"
>
  <span className="text-2xl">✨</span>
  <span className="text-sm text-white/90">
    {isRTL ? "انضم إلى مجتمع المبدعين" : "Join Our Community"}
  </span>
</motion.div>

              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                {isRTL ? "جاهز تدخل المرحلة الجاية؟" : "Ready to Begin Your"}
                <span className="block text-white/90">{isRTL ? "رحلة التحول؟" : "Transformation?"}</span>
              </h2>
              <p className="text-white/70 max-w-xl mx-auto mb-10 text-lg">
                {isRTL
                  ? `ابدأ رحلتك الإبداعية مع مجتمع من المبدعين يكتشف، يصنع، ويوسّع آفاقه مع أقدع. ${brandName}.`
                  : `Join thousands of members who have elevated their skills with ${brandName}.`}
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-white text-primary-600 font-semibold text-lg px-10 py-4 rounded-xl hover:bg-gray-50 transition-all duration-300 hover:scale-[1.02] shadow-2xl shadow-black/10"
              >
                {isRTL ? "ابدأ اليوم" : "Get Started Today"}
                <span>{isRTL ? "←" : "→"}</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="home-creators" className="content-auto relative py-24 overflow-hidden scroll-mt-36">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-gray-50/50 to-white" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-brand-teal text-sm font-medium tracking-widest uppercase mb-4 block">
                {isRTL ? "لصنّاع المحتوى" : "For Creators"}
              </span>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
                {isRTL ? "شارك" : "Share Your"}
                <span className="gradient-text"> {isRTL ? "خبرتك" : "Expertise"}</span>
              </h2>
              <p className="text-gray-500 text-lg mb-6 leading-relaxed">
                {isRTL
                  ? ` إذا كنت صانع محتوى في عالم التحريك والإبداع، انضم إلى أقدع وكن جزءًا من مجتمع يشارك المعرفة ويصنع أثرًا.
نبحث عن مبدعين في:
`
                  : `Are you a skilled animator or creative professional? Join ${brandName} as a creator and inspire the next generation of artists. We're looking for passionate educators in 2D, 3D, Storyboarding, Stop Motion, and more.`}
              </p>
<ul className="space-y-3 mb-8">
  {[
    isRTL ? "التحريك ثنائي وثلاثي الأبعاد" : "Reach members worldwide",
    isRTL ? "الستوري بورد والتطوير البصري" : "Professional platform & support",
    isRTL ? "  خطوط الإنتاج وسير العمل" : "Share your unique creative vision",
  ].map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex items-center gap-3 text-gray-600"
                  >
                    <span className="w-6 h-6 rounded-full bg-brand-teal/10 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-3.5 h-3.5 text-brand-teal"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                    {item}
                  </motion.li>
                ))}
              </ul>
              <Link
                to="/apply-creator"
                className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4"
              >
                {isRTL ? "قدّم كصانع محتوى" : "Apply as Creator"}
                <span>{isRTL ? "←" : "→"}</span>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative bg-gradient-to-br from-brand-teal/5 to-primary-50 rounded-3xl p-8 border border-gray-100">
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-brand-teal/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary-100/40 rounded-full blur-2xl" />
                <div className="relative space-y-6">
{[
  {
    icon: "🎬",
    title: isRTL ? "صُنّاع التحريك" : "Animation Experts",
    desc: isRTL ? "ثنائي وثلاثي الأبعاد وستوب موشن وأكثر" : "2D, 3D, Stop Motion & more",
  },
  {
    icon: "🎨",
    title: isRTL ? "مبدعون بصريون" : "Creative Professionals",
    desc: isRTL ? "ستوري بورد، تصميم بصري، وفنون إنتاج" : "Storyboarding & visual arts",
  },
  {
    icon: "📐",
    title: isRTL ? "مختصو سير العمل" : "Technical Artists",
    desc: isRTL ? "تقنيات الإنتاج ومختصو خطوط الإنتاج" : "Software & pipeline specialists",
  },
                    {
                      icon: "🌟",
                      title: isRTL ? "خبرات من الصناعة" : "Industry Veterans",
                      desc: isRTL ? " رؤى وتجارب من بيئات إنتاج حقيقية" : "Studio & production experience",
                    },
                  ].map((item, i) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="flex items-start gap-4 p-4 rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-100 shadow-sm"
                    >
                      <span className="text-3xl">{item.icon}</span>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {item.title}
                        </h4>
                        <p className="text-sm text-gray-500">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="content-auto relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-gray-50/50 to-white" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-primary-500 text-sm font-medium tracking-widest uppercase mb-4 block">
                {isRTL ? "للاستوديوهات" : "For Studios"}
              </span>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
                {isRTL ? "شاركنا كـ" : "Partner as a "}
                <span className="gradient-text">{isRTL ? "استوديو" : "Studio"}</span>
              </h2>
              <p className="text-gray-500 text-lg mb-6 leading-relaxed">
                {isRTL
                  ? `اجلب خبرة استوديو التحريك والمؤثرات البصرية الخاص بك إلى ${brandName}. انشر فصولًا قائمة على المشاريع واصل إلى جمهور عالمي من المحترفين.`
                  : `Bring your Animation & VFX studio's expertise to ${brandName}. Publish project-based chapters and reach a global audience of professionals.`}
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  isRTL ? "الوصول إلى جمهور مهني عالمي" : "Reach a global professional audience",
                  isRTL ? " تعزيز حضور الاستوديو والهوية المؤسسية" : "Brand visibility and institutional exposure",
                  isRTL ? " استعراض خبراتك ومشاريعك أمام مجتمع متخصص" : "Showcase Animation & VFX expertise",
                ].map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex items-center gap-3 text-gray-600"
                  >
                    <span className="w-6 h-6 rounded-full bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-3.5 h-3.5 text-primary-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                    {item}
                  </motion.li>
                ))}
              </ul>
              <Link
                to="/apply-studio"
                className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4"
              >
                {isRTL ? "قدّم كاستوديو" : "Apply as Studio"}
                <span>{isRTL ? "←" : "→"}</span>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative bg-gradient-to-br from-primary-500/5 to-cyan-50 rounded-3xl p-8 border border-gray-100">
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary-500/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-cyan-100/40 rounded-full blur-2xl" />
                <div className="relative space-y-6">
              {[
{
  icon: "🏢",
  title: isRTL ? "استوديوهات تقود الإبداع" : "Animation Studios",
  desc: isRTL ? "خبرات في التحريك ثنائي وثلاثي الأبعاد" : "2D & 3D production houses",
},
{
  icon: "✨",
  title: isRTL ? "ابتكار في المؤثرات البصرية" : "VFX Houses",
  desc: isRTL ? "تجارب إنتاج متقدمة ورؤى بصرية متميزة." : "Visual effects & compositing",
},
{
  icon: "🌍",
  title: isRTL ? "وصول يتجاوز الحدود" : "Global Reach",
  desc: isRTL ? "عرّف أعمالك أمام مجتمع إبداعي عالمي." : "Connect with international talent",
},
                    {
                      icon: "🤝",
                      title: isRTL ? "شراكات تنمو معك " : "Strategic Partnership",
                      desc: isRTL ? " فرص تعاون استراتيجية تمتد أبعد من المشاريع." : "Long-term collaboration opportunities",
                    },
                  ].map((item, i) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="flex items-start gap-4 p-4 rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-100 shadow-sm"
                    >
                      <span className="text-3xl">{item.icon}</span>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {item.title}
                        </h4>
                        <p className="text-sm text-gray-500">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <PartnersSection />
    </div>
  );
}

export default Home;
