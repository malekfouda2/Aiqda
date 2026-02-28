import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { analyticsAPI, coursesAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, tableRowVariants } from '../utils/animations';

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
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={fadeInUp}>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Instructor Dashboard</h1>
        <p className="text-gray-500 mb-10">Track your courses and student progress</p>
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { icon: '📚', bg: 'bg-primary-50', value: analytics?.totalCourses || 0, label: 'Courses' },
          { icon: '👥', bg: 'bg-green-50', value: analytics?.totalStudents || 0, label: 'Students' },
          { icon: '✅', bg: 'bg-indigo-50', value: analytics?.totalQualifiedViews || 0, label: 'Qualified Views' },
          { icon: '💰', bg: 'bg-yellow-50', value: 'Coming Soon', label: 'Revenue' },
        ].map((stat) => (
          <motion.div key={stat.label} variants={cardVariants} className="card group">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                <span className="text-2xl">{stat.icon}</span>
              </div>
              <div>
                <p className={`${stat.value === 'Coming Soon' ? 'text-lg' : 'text-2xl'} font-bold text-gray-900`}>{stat.value}</p>
                <p className="text-gray-500 text-sm">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid lg:grid-cols-2 gap-8">
        <motion.div variants={cardVariants} className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">My Courses</h2>
          
          {courses.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No courses yet</p>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
              {courses.map((course) => {
                const stats = analytics?.courseStats?.find(cs => cs.courseId === course._id);
                return (
                  <motion.div key={course._id} variants={tableRowVariants}>
                    <Link
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
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </motion.div>

        <motion.div variants={cardVariants} className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Course Performance</h2>
          
          {analytics?.courseStats?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No data yet</p>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
              {analytics?.courseStats?.map((stat) => (
                <motion.div key={stat.courseId} variants={tableRowVariants} className="p-4 bg-gray-50 rounded-lg">
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
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default InstructorDashboard;
