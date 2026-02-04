import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { coursesAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await coursesAPI.getPublished();
      setCourses(response.data);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter(course => {
    if (filter === 'all') return true;
    return course.level === filter;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading courses..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-30" />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb w-[400px] h-[400px] bg-primary-500/10 top-[-100px] left-[-100px] animate-float" />
        <div className="floating-orb w-[300px] h-[300px] bg-indigo-500/10 bottom-[-100px] right-[-50px] animate-float-slow" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6"
          >
            <span className="text-lg">✨</span>
            <span className="text-sm text-dark-300">Premium Courses</span>
          </motion.div>

          <h1 className="text-5xl font-bold text-white mb-6">
            Explore Our
            <span className="gradient-text"> Courses</span>
          </h1>
          <p className="text-dark-400 max-w-2xl mx-auto text-lg">
            Discover courses designed to help you master new skills and advance your career.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center gap-3 mb-12"
        >
          {['all', 'beginner', 'intermediate', 'advanced'].map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                filter === level
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                  : 'bg-dark-800/50 text-dark-400 hover:bg-dark-800 hover:text-white border border-dark-700/30'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </motion.div>

        {filteredCourses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary-500/20 to-indigo-500/20 flex items-center justify-center border border-primary-500/10">
              <span className="text-5xl">📚</span>
            </div>
            <h3 className="text-2xl font-semibold text-white mb-3">No courses available</h3>
            <p className="text-dark-400 text-lg">Check back soon for new courses!</p>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCourses.map((course, index) => (
              <motion.div
                key={course._id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.1, duration: 0.5 }}
              >
                <Link to={`/courses/${course._id}`} className="block card-hover h-full group">
                  <div className="aspect-video rounded-xl mb-5 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-900/60 via-indigo-900/60 to-violet-900/60 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                      <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-300">
                        <span className="text-3xl">🎓</span>
                      </div>
                    </div>
                    <div className="absolute top-3 left-3">
                      <span className={`tag ${
                        course.level === 'beginner' ? 'tag-beginner' :
                        course.level === 'intermediate' ? 'tag-intermediate' :
                        'tag-advanced'
                      }`}>
                        {course.level}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-dark-800/60 text-dark-400 text-xs font-medium">
                      {course.category}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-primary-400 transition-colors line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="text-dark-400 text-sm line-clamp-2 mb-5 leading-relaxed">
                    {course.description}
                  </p>

                  <div className="divider mb-4" />

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500/30 to-indigo-500/30 flex items-center justify-center">
                        <span className="text-xs">👤</span>
                      </div>
                      <span className="text-dark-400">
                        {course.instructor?.name || 'Instructor'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-primary-400 font-medium">
                      <span>📹</span>
                      <span>{course.lessonsCount || 0} lessons</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Courses;
