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
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-dark-400">Continue your learning journey</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-10">
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-900/50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">📚</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{enrolledCourses.length}</p>
                  <p className="text-dark-400 text-sm">Enrolled Courses</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-900/50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{progress?.stats?.completedCourses || 0}</p>
                  <p className="text-dark-400 text-sm">Completed Courses</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-900/50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🎯</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{progress?.stats?.totalLessonsCompleted || 0}</p>
                  <p className="text-dark-400 text-sm">Lessons Completed</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="card">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">My Courses</h2>
                  <Link to="/courses" className="text-primary-400 hover:text-primary-300 text-sm">
                    Browse More
                  </Link>
                </div>

                {enrolledCourses.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="text-5xl mb-4">📖</div>
                    <p className="text-dark-400 mb-4">You haven't enrolled in any courses yet</p>
                    <Link to="/courses" className="btn-primary">
                      Explore Courses
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {enrolledCourses.slice(0, 4).map((course) => {
                      const courseProgress = progress?.courseProgress?.find(
                        cp => cp.course?._id === course._id
                      );
                      return (
                        <Link
                          key={course._id}
                          to={`/courses/${course._id}`}
                          className="flex items-center gap-4 p-4 bg-dark-800/50 rounded-xl hover:bg-dark-800 transition-colors"
                        >
                          <div className="w-16 h-16 bg-gradient-to-br from-primary-900/50 to-indigo-900/50 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">🎓</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-white">{course.title}</h3>
                            <p className="text-sm text-dark-400">
                              {course.instructor?.name}
                            </p>
                            <div className="mt-2 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 rounded-full"
                                style={{ width: `${courseProgress?.progressPercentage || 0}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-dark-400 text-sm">
                            {Math.round(courseProgress?.progressPercentage || 0)}%
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {progress?.recentActivity?.length > 0 && (
                <div className="card">
                  <h2 className="text-xl font-semibold text-white mb-6">Recent Activity</h2>
                  <div className="space-y-3">
                    {progress.recentActivity.slice(0, 5).map((activity) => (
                      <div key={activity._id} className="flex items-center gap-4 text-sm">
                        <div className={`w-2 h-2 rounded-full ${activity.isQualified ? 'bg-green-500' : 'bg-primary-500'}`} />
                        <span className="text-dark-300">{activity.lesson?.title}</span>
                        <span className="text-dark-500 ml-auto">
                          {activity.watchPercentage}% watched
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Subscription</h2>
                {subscription ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-green-400 font-medium">Active</span>
                    </div>
                    <p className="text-dark-300 text-sm mb-2">
                      {subscription.package?.name}
                    </p>
                    <p className="text-dark-500 text-xs">
                      Expires: {new Date(subscription.endDate).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-dark-400 text-sm mb-4">
                      No active subscription
                    </p>
                    <Link to="/dashboard/subscription" className="btn-primary w-full text-sm">
                      Get Subscription
                    </Link>
                  </div>
                )}
              </div>

              <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Quick Links</h2>
                <div className="space-y-2">
                  <Link
                    to="/dashboard/subscription"
                    className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors"
                  >
                    <span>💳</span>
                    <span className="text-dark-300">Subscription</span>
                  </Link>
                  <Link
                    to="/dashboard/payments"
                    className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors"
                  >
                    <span>📝</span>
                    <span className="text-dark-300">Payment History</span>
                  </Link>
                  <Link
                    to="/courses"
                    className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors"
                  >
                    <span>🔍</span>
                    <span className="text-dark-300">Browse Courses</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default Dashboard;
