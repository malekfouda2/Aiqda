import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { analyticsAPI, coursesAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

function InstructorDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsRes, coursesRes] = await Promise.all([
        analyticsAPI.getInstructorAnalytics(),
        coursesAPI.getTeaching()
      ]);
      setAnalytics(analyticsRes.data);
      setCourses(coursesRes.data);
    } catch (error) {
      console.error('Failed to fetch instructor data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
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
          <h1 className="text-3xl font-bold text-white mb-2">Instructor Dashboard</h1>
          <p className="text-dark-400 mb-10">Track your courses and student progress</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-900/50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">📚</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{analytics?.totalCourses || 0}</p>
                  <p className="text-dark-400 text-sm">Courses</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-900/50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{analytics?.totalStudents || 0}</p>
                  <p className="text-dark-400 text-sm">Students</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-900/50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{analytics?.totalQualifiedViews || 0}</p>
                  <p className="text-dark-400 text-sm">Qualified Views</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-900/50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">Coming Soon</p>
                  <p className="text-dark-400 text-sm">Revenue</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="card">
              <h2 className="text-xl font-semibold text-white mb-6">My Courses</h2>
              
              {courses.length === 0 ? (
                <p className="text-dark-400 text-center py-8">No courses yet</p>
              ) : (
                <div className="space-y-4">
                  {courses.map((course) => {
                    const stats = analytics?.courseStats?.find(cs => cs.courseId === course._id);
                    return (
                      <Link
                        key={course._id}
                        to={`/courses/${course._id}`}
                        className="block p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-white">{course.title}</h3>
                            <p className="text-dark-500 text-sm">
                              {stats?.enrolledCount || 0} students • {stats?.lessonsCount || 0} lessons
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            course.isPublished ? 'bg-green-900/50 text-green-300' : 'bg-dark-700 text-dark-400'
                          }`}>
                            {course.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-white mb-6">Course Performance</h2>
              
              {analytics?.courseStats?.length === 0 ? (
                <p className="text-dark-400 text-center py-8">No data yet</p>
              ) : (
                <div className="space-y-4">
                  {analytics?.courseStats?.map((stat) => (
                    <div key={stat.courseId} className="p-4 bg-dark-800/50 rounded-lg">
                      <h3 className="font-medium text-white mb-2">{stat.title}</h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-dark-500">Enrolled</p>
                          <p className="text-white font-medium">{stat.enrolledCount}</p>
                        </div>
                        <div>
                          <p className="text-dark-500">Qualified</p>
                          <p className="text-white font-medium">{stat.qualifiedViews}</p>
                        </div>
                        <div>
                          <p className="text-dark-500">Lessons</p>
                          <p className="text-white font-medium">{stat.lessonsCount}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default InstructorDashboard;
