import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { analyticsAPI, financeAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, slideInLeft, tableRowVariants } from '../utils/animations';
import { useLocale } from '../i18n/useLocale';

const sar = (n) => `${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;

function AdminDashboard() {
  const { isRTL } = useLocale();
  const [analytics, setAnalytics] = useState(null);
  const [finance, setFinance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(() => {
      fetchData({ silent: true });
    }, 15000);

    return () => clearInterval(intervalId);
  }, []);

  const fetchData = async ({ silent = false } = {}) => {
    try {
      const [analyticsRes, financeRes] = await Promise.all([
        analyticsAPI.getAdminAnalytics(),
        financeAPI.getOverview().catch(() => ({ data: { summary: null } })),
      ]);
      setAnalytics(analyticsRes.data);
      setFinance(financeRes.data?.summary || null);
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text={isRTL ? 'جارٍ تحميل لوحة الإدارة...' : 'Loading admin dashboard...'} />
      </div>
    );
  }

  const overview = analytics?.overview || {};

  const statsCards = [
    { value: overview.totalMembers || 0, label: isRTL ? 'إجمالي الأعضاء' : 'Total Members', icon: '👥', iconClass: 'icon-box-success' },
    { value: overview.activeSubscriptions || 0, label: isRTL ? 'الاشتراكات النشطة' : 'Active Subscriptions', icon: '💳', iconClass: 'icon-box-primary' },
    { value: overview.totalCourses || 0, label: isRTL ? 'إجمالي الفصول' : 'Total Chapters', icon: '📚', iconClass: 'icon-box-accent' },
    { value: overview.activeStudentsNow || 0, label: isRTL ? 'أعضاء نشطون الآن' : 'Active Members Now', icon: '📡', iconClass: 'icon-box-warning', sub: overview.activeWindowMinutes ? (isRTL ? `آخر ${overview.activeWindowMinutes} دقائق` : `last ${overview.activeWindowMinutes} min`) : null },
  ];

  const financeRows = [
    { label: isRTL ? 'إجمالي المدفوعات' : 'Gross payments', value: sar(finance?.grossPaid), accent: 'text-gray-900' },
    { label: isRTL ? 'رسوم بوابة الدفع' : 'Gateway fees', value: sar(finance?.gatewayFees), accent: 'text-rose-600' },
    { label: isRTL ? 'رسوم بنكية' : 'Bank fees', value: sar(finance?.bankFees), accent: 'text-rose-600' },
    ...(finance?.expenses || []).map((expense) => (
      { label: expense.label, value: sar(expense.amount), accent: 'text-rose-600' }
    )),
    { label: isRTL ? 'صافي النقد بعد الرسوم' : 'Net cash after fees', value: sar(finance?.netCashAfterFees), accent: 'text-emerald-600' },
    { label: isRTL ? 'التزام المبدعين المستحق' : 'Eligible creator liability', value: sar(finance?.eligibleInstructorLiability), accent: 'text-amber-600' },
    { label: isRTL ? 'المدفوع للمبدعين' : 'Paid to creators', value: sar(finance?.actualInstructorPayouts), accent: 'text-sky-600' },
    { label: isRTL ? 'أرصدة الاسترداد' : 'Recovery balances', value: sar(finance?.instructorRecoveryBalances), accent: 'text-rose-600' },
    { label: isRTL ? 'نقد المنصة بعد المدفوعات' : 'Platform cash after payouts', value: sar(finance?.platformCashAfterPayouts), accent: 'text-gray-900' },
  ];

  const memberRows = [
    { label: isRTL ? 'إجمالي الأعضاء' : 'Total members', value: overview.totalMembers || 0, icon: '👥' },
    { label: isRTL ? 'أعضاء جدد (30 يومًا)' : 'New members (30d)', value: overview.newMembers30d || 0, icon: '🆕' },
    { label: isRTL ? 'الاشتراكات النشطة' : 'Active subscriptions', value: overview.activeSubscriptions || 0, icon: '💳' },
    { label: isRTL ? 'المبدعون' : 'Creators', value: overview.totalInstructors || 0, icon: '👨‍🏫' },
    { label: isRTL ? 'التسجيلات' : 'Enrollments', value: overview.totalEnrollments || 0, icon: '📝' },
    { label: isRTL ? 'فصول مكتملة' : 'Completed chapters', value: overview.completedCourses || 0, icon: '✅' },
  ];

  const quickActions = [
    { to: '/admin/finance', icon: '💰', iconClass: 'icon-box-success', label: isRTL ? 'المالية' : 'Finance', description: isRTL ? 'لوحة المالية' : 'Financial overview' },
    { to: '/admin/payments', icon: '💳', iconClass: 'icon-box-warning', label: isRTL ? 'المدفوعات' : 'Payments', description: isRTL ? 'متابعة Tap' : 'Track Tap status' },
    { to: '/admin/subscriptions', icon: '📋', iconClass: 'icon-box-accent', label: isRTL ? 'الاشتراكات' : 'Subscriptions', description: isRTL ? 'إدارة الخطط' : 'Manage plans' },
    { to: '/admin/users', icon: '👥', iconClass: 'icon-box-success', label: isRTL ? 'المستخدمون' : 'Users', description: isRTL ? 'إدارة المستخدمين' : 'User management' },
    { to: '/admin/chapters', icon: '📚', iconClass: 'icon-box-primary', label: isRTL ? 'الفصول' : 'Chapters', description: isRTL ? 'كتالوج الفصول' : 'Chapter catalog' },
    { to: '/admin/creator-applications', icon: '🎓', iconClass: 'icon-box-accent', label: isRTL ? 'طلبات صنّاع المحتوى' : 'Creator Apps', description: isRTL ? 'مراجعة الطلبات' : 'Review applications' },
    { to: '/admin/consultations', icon: '🎯', iconClass: 'icon-box-success', label: isRTL ? 'الاستشارات' : 'Consultations', description: isRTL ? 'إدارة الأنواع' : 'Manage types' },
    { to: '/admin/consultation-bookings', icon: '📅', iconClass: 'icon-box-warning', label: isRTL ? 'حجوزات الاستشارات' : 'Consult Bookings', description: isRTL ? 'مراجعة الحجوزات' : 'Review bookings' },
  ];

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
          <motion.div variants={fadeInUp} className="mb-10">
            <motion.div
              variants={slideInLeft}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-4"
          >
              <span className="w-2 h-2 bg-primary-400 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500">{isRTL ? 'لوحة الإدارة' : 'Admin Dashboard'}</span>
            </motion.div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {isRTL ? 'نظرة ' : 'Platform '}<span className="gradient-text">{isRTL ? 'عامة' : 'Overview'}</span>
            </h1>
            <p className="text-gray-500 text-lg">{isRTL ? 'أدر منصتك التعليمية' : 'Manage your education platform'}</p>
            {lastUpdatedAt && (
              <p className="text-xs text-gray-400 mt-3">
                {isRTL
                  ? `يتم التحديث تلقائيًا كل 15 ثانية • آخر تحديث ${lastUpdatedAt.toLocaleTimeString()}`
                  : `Auto-refreshes every 15 seconds • Last updated ${lastUpdatedAt.toLocaleTimeString()}`}
              </p>
            )}
          </motion.div>

          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {statsCards.map((stat) => (
              <motion.div
                key={stat.label}
                variants={cardVariants}
                className="stat-card group"
              >
                <div className="flex items-center gap-4">
                  <div className={`icon-box ${stat.iconClass} transition-transform duration-300 group-hover:scale-110`}>
                    <span>{stat.icon}</span>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-gray-500 text-sm">{stat.label}</p>
                    {stat.sub ? <p className="text-xs text-gray-400 mt-1">{stat.sub}</p> : null}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid lg:grid-cols-2 gap-8 mb-8">
            <motion.div variants={cardVariants} className="card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="icon-box icon-box-success w-10 h-10 text-lg"><span>💰</span></div>
                  <h2 className="text-xl font-semibold text-gray-900">{isRTL ? 'لمحة مالية' : 'Finance Snapshot'}</h2>
                </div>
                <Link to="/admin/finance" className="text-primary-500 hover:text-primary-600 text-sm font-medium transition-colors">
                  {isRTL ? 'عرض المالية ←' : 'View Finance →'}
                </Link>
              </div>

              {!finance ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center"><span className="text-2xl">📊</span></div>
                  <p className="text-gray-500">{isRTL ? 'لا توجد بيانات مالية بعد' : 'No financial data yet'}</p>
                </div>
              ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                  {financeRows.map((row, idx) => (
                    <motion.div key={`${row.label}-${idx}`} variants={tableRowVariants} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <span className="text-sm text-gray-600">{row.label}</span>
                      <span className={`text-base font-semibold ${row.accent}`}>{row.value}</span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>

            <motion.div variants={cardVariants} className="card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="icon-box icon-box-primary w-10 h-10 text-lg"><span>👥</span></div>
                  <h2 className="text-xl font-semibold text-gray-900">{isRTL ? 'الأعضاء والنمو' : 'Members & Growth'}</h2>
                </div>
                <Link to="/admin/users" className="text-primary-500 hover:text-primary-600 text-sm font-medium transition-colors">
                  {isRTL ? 'إدارة الأعضاء ←' : 'Manage Members →'}
                </Link>
              </div>

              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 gap-3">
                {memberRows.map((row) => (
                  <motion.div key={row.label} variants={tableRowVariants} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{row.icon}</span>
                      <span className="text-2xl font-bold text-gray-900">{row.value}</span>
                    </div>
                    <p className="text-xs text-gray-500">{row.label}</p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="card"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-6">{isRTL ? 'إجراءات سريعة' : 'Quick Actions'}</h2>
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <motion.div
                  key={action.to}
                  variants={cardVariants}
                  whileHover={{ y: -2 }}
                >
                  <Link
                    to={action.to}
                    className="flex items-center gap-4 p-5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-200 transition-all duration-300 group"
                  >
                    <div className={`icon-box ${action.iconClass} w-12 h-12 text-xl transition-transform duration-300 group-hover:scale-110`}>
                      <span>{action.icon}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900 group-hover:text-primary-500 transition-colors block">
                        {action.label}
                      </span>
                      <span className="text-xs text-gray-400">{action.description}</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
    </motion.div>
  );
}

export default AdminDashboard;
