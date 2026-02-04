import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { analyticsAPI, paymentsAPI, subscriptionsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

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
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading admin dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-30" />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb w-[500px] h-[500px] bg-violet-500/10 top-[-200px] right-[-100px] animate-float-slow" />
        <div className="floating-orb w-[300px] h-[300px] bg-primary-500/10 bottom-[-100px] left-[-50px] animate-float" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-4"
            >
              <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
              <span className="text-xs text-dark-400">Admin Dashboard</span>
            </motion.div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Platform <span className="gradient-text">Overview</span>
            </h1>
            <p className="text-dark-400 text-lg">Manage your education platform</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {statsCards.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.1 }}
                className="stat-card group"
              >
                <div className="flex items-center gap-4">
                  <div className={`icon-box ${stat.iconClass} transition-transform duration-300 group-hover:scale-110`}>
                    <span>{stat.icon}</span>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">
                      {stat.key === 'pendingPayments' ? pendingPayments.length : (analytics?.overview?.[stat.key] || 0)}
                    </p>
                    <p className="text-dark-400 text-sm">{stat.label}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="icon-box icon-box-warning w-10 h-10 text-lg">
                    <span>💳</span>
                  </div>
                  <h2 className="text-xl font-semibold text-white">Pending Payments</h2>
                </div>
                <Link to="/admin/payments" className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors">
                  View All →
                </Link>
              </div>
              
              {pendingPayments.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-dark-800/50 flex items-center justify-center">
                    <span className="text-2xl">✅</span>
                  </div>
                  <p className="text-dark-400">No pending payments</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingPayments.slice(0, 5).map((payment, index) => (
                    <motion.div
                      key={payment._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.05 }}
                      className="flex items-center justify-between p-4 rounded-xl bg-dark-800/30 hover:bg-dark-800/50 border border-dark-700/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/20">
                          <span className="text-sm">👤</span>
                        </div>
                        <div>
                          <p className="font-medium text-white">{payment.user?.name}</p>
                          <p className="text-sm text-dark-500">{payment.paymentReference}</p>
                        </div>
                      </div>
                      <span className="text-lg font-semibold text-amber-400">{payment.amount} SAR</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="card"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="icon-box icon-box-accent w-10 h-10 text-lg">
                    <span>📋</span>
                  </div>
                  <h2 className="text-xl font-semibold text-white">Pending Subscriptions</h2>
                </div>
                <Link to="/admin/subscriptions" className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors">
                  View All →
                </Link>
              </div>
              
              {pendingSubscriptions.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-dark-800/50 flex items-center justify-center">
                    <span className="text-2xl">✅</span>
                  </div>
                  <p className="text-dark-400">No pending subscriptions</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingSubscriptions.slice(0, 5).map((sub, index) => (
                    <motion.div
                      key={sub._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.05 }}
                      className="flex items-center justify-between p-4 rounded-xl bg-dark-800/30 hover:bg-dark-800/50 border border-dark-700/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center border border-indigo-500/20">
                          <span className="text-sm">👤</span>
                        </div>
                        <div>
                          <p className="font-medium text-white">{sub.user?.name}</p>
                          <p className="text-sm text-dark-500">{sub.package?.name}</p>
                        </div>
                      </div>
                      <span className="tag tag-intermediate">Pending</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="card"
          >
            <h2 className="text-xl font-semibold text-white mb-6">Quick Actions</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action, index) => (
                <motion.div
                  key={action.to}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.05 }}
                >
                  <Link
                    to={action.to}
                    className="flex items-center gap-4 p-5 rounded-xl bg-dark-800/30 hover:bg-dark-800/60 border border-dark-700/30 hover:border-primary-500/20 transition-all duration-300 group"
                  >
                    <div className={`icon-box ${action.iconClass} w-12 h-12 text-xl transition-transform duration-300 group-hover:scale-110`}>
                      <span>{action.icon}</span>
                    </div>
                    <div>
                      <span className="font-medium text-white group-hover:text-primary-400 transition-colors block">
                        {action.label}
                      </span>
                      <span className="text-xs text-dark-500">{action.description}</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

const statsCards = [
  { key: 'totalCourses', label: 'Total Courses', icon: '📚', iconClass: 'icon-box-primary' },
  { key: 'totalEnrollments', label: 'Enrollments', icon: '👥', iconClass: 'icon-box-success' },
  { key: 'pendingPayments', label: 'Pending Payments', icon: '💳', iconClass: 'icon-box-warning' },
  { key: 'qualifiedLessons', label: 'Qualified Lessons', icon: '🎯', iconClass: 'icon-box-accent' }
];

const quickActions = [
  { to: '/admin/payments', icon: '💳', iconClass: 'icon-box-warning', label: 'Payments', description: 'Review & approve' },
  { to: '/admin/subscriptions', icon: '📋', iconClass: 'icon-box-accent', label: 'Subscriptions', description: 'Manage plans' },
  { to: '/admin/users', icon: '👥', iconClass: 'icon-box-success', label: 'Users', description: 'User management' },
  { to: '/admin/courses', icon: '📚', iconClass: 'icon-box-primary', label: 'Courses', description: 'Course catalog' }
];

export default AdminDashboard;
