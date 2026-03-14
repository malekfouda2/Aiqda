import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { analyticsAPI, paymentsAPI, subscriptionsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, slideInLeft, tableRowVariants } from '../utils/animations';

function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [pendingSubscriptions, setPendingSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsRes, paymentsRes, subsRes] = await Promise.all([
        analyticsAPI.getAdminAnalytics(),
        paymentsAPI.getAll('submitted'),
        subscriptionsAPI.getAll('pending')
      ]);
      setAnalytics(analyticsRes.data);
      setPendingPayments(paymentsRes.data);
      setPendingSubscriptions(subsRes.data);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Loading admin dashboard..." />
      </div>
    );
  }

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
              <span className="text-xs text-gray-500">Admin Dashboard</span>
            </motion.div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Platform <span className="gradient-text">Overview</span>
            </h1>
            <p className="text-gray-500 text-lg">Manage your education platform</p>
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
                    <p className="text-3xl font-bold text-gray-900">
                      {stat.key === 'pendingPayments' ? pendingPayments.length : (analytics?.overview?.[stat.key] || 0)}
                    </p>
                    <p className="text-gray-500 text-sm">{stat.label}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid lg:grid-cols-2 gap-8 mb-8">
            <motion.div
              variants={cardVariants}
              className="card"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="icon-box icon-box-warning w-10 h-10 text-lg">
                    <span>💳</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Pending Payments</h2>
                </div>
                <Link to="/admin/payments" className="text-primary-500 hover:text-primary-600 text-sm font-medium transition-colors">
                  View All →
                </Link>
              </div>
              
              {pendingPayments.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <span className="text-2xl">✅</span>
                  </div>
                  <p className="text-gray-500">No pending payments</p>
                </div>
              ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                  {pendingPayments.slice(0, 5).map((payment) => (
                    <motion.div
                      key={payment._id}
                      variants={tableRowVariants}
                      className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center border border-amber-100">
                          <span className="text-sm">👤</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{payment.user?.name}</p>
                          <p className="text-sm text-gray-400">{payment.paymentReference}</p>
                        </div>
                      </div>
                      <span className="text-lg font-semibold text-amber-600">{payment.amount} SAR</span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>

            <motion.div
              variants={cardVariants}
              className="card"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="icon-box icon-box-accent w-10 h-10 text-lg">
                    <span>📋</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Pending Subscriptions</h2>
                </div>
                <Link to="/admin/subscriptions" className="text-primary-500 hover:text-primary-600 text-sm font-medium transition-colors">
                  View All →
                </Link>
              </div>
              
              {pendingSubscriptions.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <span className="text-2xl">✅</span>
                  </div>
                  <p className="text-gray-500">No pending subscriptions</p>
                </div>
              ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                  {pendingSubscriptions.slice(0, 5).map((sub) => (
                    <motion.div
                      key={sub._id}
                      variants={tableRowVariants}
                      className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center border border-cyan-100">
                          <span className="text-sm">👤</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{sub.user?.name}</p>
                          <p className="text-sm text-gray-400">{sub.package?.name}</p>
                        </div>
                      </div>
                      <span className="tag tag-intermediate">Pending</span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="card"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
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

const statsCards = [
  { key: 'totalCourses', label: 'Total Chapters', icon: '📚', iconClass: 'icon-box-primary' },
  { key: 'totalEnrollments', label: 'Enrollments', icon: '👥', iconClass: 'icon-box-success' },
  { key: 'pendingPayments', label: 'Pending Payments', icon: '💳', iconClass: 'icon-box-warning' },
  { key: 'qualifiedLessons', label: 'Qualified Contents', icon: '🎯', iconClass: 'icon-box-accent' }
];

const quickActions = [
  { to: '/admin/payments', icon: '💳', iconClass: 'icon-box-warning', label: 'Payments', description: 'Review & approve' },
  { to: '/admin/subscriptions', icon: '📋', iconClass: 'icon-box-accent', label: 'Subscriptions', description: 'Manage plans' },
  { to: '/admin/users', icon: '👥', iconClass: 'icon-box-success', label: 'Users', description: 'User management' },
  { to: '/admin/courses', icon: '📚', iconClass: 'icon-box-primary', label: 'Chapters', description: 'Chapter catalog' },
  { to: '/admin/instructor-applications', icon: '🎓', iconClass: 'icon-box-accent', label: 'Creator Apps', description: 'Review applications' },
  { to: '/admin/studio-applications', icon: '🎬', iconClass: 'icon-box-primary', label: 'Studio Apps', description: 'Review studio applications' },
  { to: '/admin/consultations', icon: '🎯', iconClass: 'icon-box-success', label: 'Consultations', description: 'Manage types' },
  { to: '/admin/consultation-bookings', icon: '📅', iconClass: 'icon-box-warning', label: 'Consult Bookings', description: 'Review bookings' }
];

export default AdminDashboard;
