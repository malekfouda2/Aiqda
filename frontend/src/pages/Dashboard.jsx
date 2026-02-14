import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { coursesAPI, subscriptionsAPI, analyticsAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import LoadingSpinner from '../components/LoadingSpinner';

function Dashboard() {
  const { user } = useAuthStore();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [coursesRes, subRes, progressRes] = await Promise.all([
        coursesAPI.getEnrolled(),
        subscriptionsAPI.getActiveSubscription(),
        analyticsAPI.getStudentProgress()
      ]);
      setEnrolledCourses(coursesRes.data);
      setSubscription(subRes.data);
      setProgress(progressRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-30" />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb w-[500px] h-[500px] bg-primary-100/40 top-[-200px] right-[-100px] animate-float-slow" />
        <div className="floating-orb w-[300px] h-[300px] bg-cyan-100/40 bottom-[-100px] left-[-50px] animate-float" />
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
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500">Student Dashboard</span>
            </motion.div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Welcome back, <span className="gradient-text">{user?.name}</span>
            </h1>
            <p className="text-gray-500 text-lg">Continue your learning journey</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="stat-card group"
            >
              <div className="flex items-center gap-4">
                <div className="icon-box icon-box-primary transition-transform duration-300 group-hover:scale-110">
                  <span>📚</span>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{enrolledCourses.length}</p>
                  <p className="text-gray-500 text-sm">Enrolled Courses</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="stat-card group"
            >
              <div className="flex items-center gap-4">
                <div className="icon-box icon-box-success transition-transform duration-300 group-hover:scale-110">
                  <span>✅</span>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{progress?.stats?.completedCourses || 0}</p>
                  <p className="text-gray-500 text-sm">Completed Courses</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="stat-card group"
            >
              <div className="flex items-center gap-4">
                <div className="icon-box icon-box-accent transition-transform duration-300 group-hover:scale-110">
                  <span>🎯</span>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{progress?.stats?.totalLessonsCompleted || 0}</p>
                  <p className="text-gray-500 text-sm">Lessons Completed</p>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">My Courses</h2>
                  <Link to="/courses" className="text-primary-500 hover:text-primary-600 text-sm font-medium transition-colors">
                    Browse More →
                  </Link>
                </div>

                {enrolledCourses.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-50 to-cyan-50 flex items-center justify-center">
                      <span className="text-4xl">📖</span>
                    </div>
                    <p className="text-gray-500 mb-6">You haven't enrolled in any courses yet</p>
                    <Link to="/courses" className="btn-primary">
                      Explore Courses
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {enrolledCourses.slice(0, 4).map((course, index) => {
                      const courseProgress = progress?.courseProgress?.find(
                        cp => cp.course?._id === course._id
                      );
                      return (
                        <motion.div
                          key={course._id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + index * 0.1 }}
                        >
                          <Link
                            to={`/courses/${course._id}`}
                            className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-200 transition-all duration-300 group"
                          >
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-50 to-cyan-50 flex items-center justify-center border border-primary-100 group-hover:scale-105 transition-transform duration-300">
                              <span className="text-2xl">🎓</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 group-hover:text-primary-500 transition-colors truncate">
                                {course.title}
                              </h3>
                              <p className="text-sm text-gray-400">
                                {course.instructor?.name}
                              </p>
                              <div className="mt-2 progress-bar">
                                <div
                                  className="progress-bar-fill"
                                  style={{ width: `${courseProgress?.progressPercentage || 0}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-bold text-gray-900">
                                {Math.round(courseProgress?.progressPercentage || 0)}%
                              </span>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>

              {progress?.recentActivity?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="card"
                >
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Activity</h2>
                  <div className="space-y-3">
                    {progress.recentActivity.slice(0, 5).map((activity, index) => (
                      <motion.div
                        key={activity._id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 + index * 0.05 }}
                        className="flex items-center gap-4 text-sm p-3 rounded-lg bg-gray-50 hover:bg-gray-50 transition-colors"
                      >
                        <div className={`w-3 h-3 rounded-full ${activity.isQualified ? 'bg-emerald-400' : 'bg-primary-500'} shadow-lg ${activity.isQualified ? 'shadow-emerald-400/30' : 'shadow-primary-400/30'}`} />
                        <span className="text-gray-600 flex-1">{activity.lesson?.title}</span>
                        <span className="text-gray-400 font-medium">
                          {activity.watchPercentage}% watched
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="card"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h2>
                {subscription ? (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-md shadow-emerald-200 animate-pulse" />
                      <span className="text-emerald-600 font-medium">Active</span>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-200 mb-4">
                      <p className="text-gray-900 font-medium mb-1">
                        {subscription.package?.name}
                      </p>
                      <p className="text-gray-500 text-sm">
                        Expires: {new Date(subscription.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 mb-4">
                      <p className="text-gray-500 text-sm mb-1">No active subscription</p>
                      <p className="text-gray-400 text-xs">Get access to premium content</p>
                    </div>
                    <Link to="/dashboard/subscription" className="btn-primary w-full text-sm justify-center">
                      Get Subscription
                    </Link>
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="card"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
                <div className="space-y-2">
                  {quickLinks.map((link, index) => (
                    <motion.div
                      key={link.to}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.05 }}
                    >
                      <Link
                        to={link.to}
                        className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-200 transition-all duration-300 group"
                      >
                        <span className="text-xl group-hover:scale-110 transition-transform">{link.icon}</span>
                        <span className="text-gray-600 group-hover:text-gray-900 transition-colors">{link.label}</span>
                        <span className="ml-auto text-gray-400 group-hover:text-primary-500 transition-colors">→</span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const quickLinks = [
  { to: '/dashboard/subscription', icon: '💳', label: 'Subscription' },
  { to: '/dashboard/payments', icon: '📝', label: 'Payment History' },
  { to: '/courses', icon: '🔍', label: 'Browse Courses' }
];

export default Dashboard;
