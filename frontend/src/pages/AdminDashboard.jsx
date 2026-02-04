import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { analyticsAPI, paymentsAPI, subscriptionsAPI, usersAPI } from '../services/api';
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
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-dark-400 mb-10">Manage your platform</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-900/50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">📚</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{analytics?.overview?.totalCourses || 0}</p>
                  <p className="text-dark-400 text-sm">Total Courses</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-900/50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{analytics?.overview?.totalEnrollments || 0}</p>
                  <p className="text-dark-400 text-sm">Enrollments</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-900/50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">💳</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{pendingPayments.length}</p>
                  <p className="text-dark-400 text-sm">Pending Payments</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-900/50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{analytics?.overview?.qualifiedLessons || 0}</p>
                  <p className="text-dark-400 text-sm">Qualified Lessons</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Pending Payments</h2>
                <Link to="/admin/payments" className="text-primary-400 hover:text-primary-300 text-sm">
                  View All
                </Link>
              </div>
              
              {pendingPayments.length === 0 ? (
                <p className="text-dark-400 text-center py-8">No pending payments</p>
              ) : (
                <div className="space-y-3">
                  {pendingPayments.slice(0, 5).map((payment) => (
                    <div key={payment._id} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                      <div>
                        <p className="font-medium text-white">{payment.user?.name}</p>
                        <p className="text-sm text-dark-400">{payment.paymentReference}</p>
                      </div>
                      <span className="text-primary-400 font-medium">{payment.amount} SAR</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Pending Subscriptions</h2>
                <Link to="/admin/subscriptions" className="text-primary-400 hover:text-primary-300 text-sm">
                  View All
                </Link>
              </div>
              
              {pendingSubscriptions.length === 0 ? (
                <p className="text-dark-400 text-center py-8">No pending subscriptions</p>
              ) : (
                <div className="space-y-3">
                  {pendingSubscriptions.slice(0, 5).map((sub) => (
                    <div key={sub._id} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                      <div>
                        <p className="font-medium text-white">{sub.user?.name}</p>
                        <p className="text-sm text-dark-400">{sub.package?.name}</p>
                      </div>
                      <span className="px-2 py-1 bg-yellow-900/50 text-yellow-300 rounded text-sm">Pending</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-6">Quick Actions</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link to="/admin/payments" className="flex items-center gap-3 p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors">
                <span className="text-2xl">💳</span>
                <span className="font-medium text-white">Manage Payments</span>
              </Link>
              <Link to="/admin/subscriptions" className="flex items-center gap-3 p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors">
                <span className="text-2xl">📋</span>
                <span className="font-medium text-white">Manage Subscriptions</span>
              </Link>
              <Link to="/admin/users" className="flex items-center gap-3 p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors">
                <span className="text-2xl">👥</span>
                <span className="font-medium text-white">Manage Users</span>
              </Link>
              <Link to="/admin/courses" className="flex items-center gap-3 p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors">
                <span className="text-2xl">📚</span>
                <span className="font-medium text-white">Manage Courses</span>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default AdminDashboard;
