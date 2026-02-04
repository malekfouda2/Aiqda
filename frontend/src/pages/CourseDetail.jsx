import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { coursesAPI, lessonsAPI, subscriptionsAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';

function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { showSuccess, showError } = useUIStore();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [courseRes, lessonsRes] = await Promise.all([
        coursesAPI.getById(id),
        lessonsAPI.getByCourse(id)
      ]);
      setCourse(courseRes.data);
      setLessons(lessonsRes.data);
      
      if (user) {
        setIsEnrolled(courseRes.data.enrolledStudents?.includes(user._id));
        try {
          const subRes = await subscriptionsAPI.getActiveSubscription();
          setHasSubscription(!!subRes.data);
        } catch {
          setHasSubscription(false);
        }
      }
    } catch (error) {
      console.error('Failed to fetch course:', error);
      showError('Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/courses/${id}` } } });
      return;
    }

    if (!hasSubscription) {
      showError('You need an active subscription to enroll');
      navigate('/dashboard/subscription');
      return;
    }

    setEnrolling(true);
    try {
      await coursesAPI.enroll(id);
      setIsEnrolled(true);
      showSuccess('Successfully enrolled in the course!');
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to enroll');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading course..." />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Course not found</h2>
          <Link to="/courses" className="btn-primary">Browse Courses</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link to="/courses" className="inline-flex items-center gap-2 text-dark-400 hover:text-white mb-6">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Courses
          </Link>

          <div className="card mb-8">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-2/3">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    course.level === 'beginner' ? 'bg-green-900/50 text-green-300' :
                    course.level === 'intermediate' ? 'bg-yellow-900/50 text-yellow-300' :
                    'bg-red-900/50 text-red-300'
                  }`}>
                    {course.level}
                  </span>
                  <span className="text-dark-400">{course.category}</span>
                </div>
                
                <h1 className="text-3xl font-bold text-white mb-4">{course.title}</h1>
                <p className="text-dark-300 mb-6">{course.description}</p>
                
                <div className="flex items-center gap-4 text-sm text-dark-400">
                  <span>By {course.instructor?.name || 'Instructor'}</span>
                  <span>•</span>
                  <span>{lessons.length} lessons</span>
                  <span>•</span>
                  <span>{course.enrolledStudents?.length || 0} students</span>
                </div>
              </div>

              <div className="lg:w-1/3">
                <div className="bg-dark-800 rounded-xl p-6">
                  {isEnrolled ? (
                    <div className="text-center">
                      <div className="text-green-400 text-lg font-semibold mb-4">
                        You're enrolled!
                      </div>
                      <Link
                        to={lessons[0] ? `/learn/${lessons[0]._id}` : '#'}
                        className="btn-primary w-full"
                      >
                        Continue Learning
                      </Link>
                    </div>
                  ) : (
                    <button
                      onClick={handleEnroll}
                      disabled={enrolling}
                      className="btn-primary w-full"
                    >
                      {enrolling ? 'Enrolling...' : 'Enroll Now'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-6">Course Content</h2>
            
            {lessons.length === 0 ? (
              <p className="text-dark-400 text-center py-8">
                No lessons available yet.
              </p>
            ) : (
              <div className="space-y-3">
                {lessons.map((lesson, index) => (
                  <div
                    key={lesson._id}
                    className="flex items-center gap-4 p-4 bg-dark-800/50 rounded-lg"
                  >
                    <div className="w-10 h-10 bg-dark-700 rounded-lg flex items-center justify-center text-dark-400 font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white">{lesson.title}</h3>
                      {lesson.description && (
                        <p className="text-sm text-dark-400">{lesson.description}</p>
                      )}
                    </div>
                    {isEnrolled && (
                      <Link
                        to={`/learn/${lesson._id}`}
                        className="btn-secondary text-sm"
                      >
                        Start
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default CourseDetail;
