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
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Instructor Dashboard</h1>
          <p className="text-gray-500 mb-10">Track your courses and student progress</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">📚</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{analytics?.totalCourses || 0}</p>
                  <p className="text-gray-500 text-sm">Courses</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{analytics?.totalStudents || 0}</p>
                  <p className="text-gray-500 text-sm">Students</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{analytics?.totalQualifiedViews || 0}</p>
                  <p className="text-gray-500 text-sm">Qualified Views</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">Coming Soon</p>
                  <p className="text-gray-500 text-sm">Revenue</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">My Courses</h2>
              
              {courses.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No courses yet</p>
              ) : (
                <div className="space-y-4">
                  {courses.map((course) => {
                    const stats = analytics?.courseStats?.find(cs => cs.courseId === course._id);
                    return (
                      <Link
                        key={course._id}
                        to={`/courses/${course._id}`}
                        className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-gray-900">{course.title}</h3>
                            <p className="text-gray-400 text-sm">
                              {stats?.enrolledCount || 0} students • {stats?.lessonsCount || 0} lessons
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            course.isPublished ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
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
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Course Performance</h2>
              
              {analytics?.courseStats?.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No data yet</p>
              ) : (
                <div className="space-y-4">
                  {analytics?.courseStats?.map((stat) => (
                    <div key={stat.courseId} className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-2">{stat.title}</h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Enrolled</p>
                          <p className="text-gray-900 font-medium">{stat.enrolledCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Qualified</p>
                          <p className="text-gray-900 font-medium">{stat.qualifiedViews}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Lessons</p>
                          <p className="text-gray-900 font-medium">{stat.lessonsCount}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
    </motion.div>
  );
}

export default InstructorDashboard;
