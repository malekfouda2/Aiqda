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
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-white mb-4">
            Explore Our Courses
          </h1>
          <p className="text-dark-400 max-w-xl mx-auto">
            Discover courses designed to help you master new skills and advance your career.
          </p>
        </motion.div>

        <div className="flex justify-center gap-3 mb-10">
          {['all', 'beginner', 'intermediate', 'advanced'].map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === level
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>

        {filteredCourses.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-white mb-2">No courses available</h3>
            <p className="text-dark-400">Check back soon for new courses!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course, index) => (
              <motion.div
                key={course._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link to={`/courses/${course._id}`} className="block card-hover h-full">
                  <div className="aspect-video bg-gradient-to-br from-primary-900/50 to-indigo-900/50 rounded-lg mb-4 flex items-center justify-center">
                    <span className="text-4xl">🎓</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      course.level === 'beginner' ? 'bg-green-900/50 text-green-300' :
                      course.level === 'intermediate' ? 'bg-yellow-900/50 text-yellow-300' :
                      'bg-red-900/50 text-red-300'
                    }`}>
                      {course.level}
                    </span>
                    <span className="text-dark-500 text-sm">{course.category}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{course.title}</h3>
                  <p className="text-dark-400 text-sm line-clamp-2 mb-4">{course.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-dark-500">
                      By {course.instructor?.name || 'Instructor'}
                    </span>
                    <span className="text-primary-400">
                      {course.lessonsCount || 0} lessons
                    </span>
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
