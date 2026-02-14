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
    <div className="min-h-screen py-12 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-30" />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb w-[400px] h-[400px] bg-brand-teal/10 top-[-100px] right-[-100px] animate-float-slow" />
        <div className="floating-orb w-[300px] h-[300px] bg-primary-500/10 bottom-[-100px] left-[-50px] animate-float" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link to="/courses" className="inline-flex items-center gap-2 text-dark-400 hover:text-white mb-8 group transition-colors">
            <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Courses
          </Link>

          <div className="card mb-8">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-2/3">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`tag ${
                    course.level === 'beginner' ? 'tag-beginner' :
                    course.level === 'intermediate' ? 'tag-intermediate' :
                    'tag-advanced'
                  }`}>
                    {course.level}
                  </span>
                  <span className="text-dark-500">{course.category}</span>
                </div>
                
                <h1 className="text-4xl font-bold text-white mb-4">{course.title}</h1>
                <p className="text-dark-300 text-lg leading-relaxed mb-6">{course.description}</p>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-dark-400">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/30 to-brand-teal/30 flex items-center justify-center">
                      <span className="text-xs">👤</span>
                    </div>
                    <span>{course.instructor?.name || 'Instructor'}</span>
                  </div>
                  <span className="w-1 h-1 rounded-full bg-dark-600" />
                  <span className="flex items-center gap-1.5">
                    <span>📹</span> {lessons.length} lessons
                  </span>
                  <span className="w-1 h-1 rounded-full bg-dark-600" />
                  <span className="flex items-center gap-1.5">
                    <span>👥</span> {course.enrolledStudents?.length || 0} students
                  </span>
                </div>
              </div>

              <div className="lg:w-1/3">
                <div className="bg-gradient-to-br from-dark-800/80 to-dark-900/80 backdrop-blur-xl rounded-2xl p-6 border border-dark-700/30">
                  {isEnrolled ? (
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-emerald-500/20">
                        <span className="text-3xl">✅</span>
                      </div>
                      <p className="text-emerald-400 text-lg font-semibold mb-4">
                        You're enrolled!
                      </p>
                      <Link
                        to={lessons[0] ? `/learn/${lessons[0]._id}` : '#'}
                        className="btn-primary w-full justify-center"
                      >
                        Continue Learning →
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div className="text-center mb-6">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500/20 to-brand-teal/20 flex items-center justify-center border border-primary-500/20">
                          <span className="text-3xl">🎓</span>
                        </div>
                        <p className="text-dark-400 text-sm">Start your learning journey</p>
                      </div>
                      <button
                        onClick={handleEnroll}
                        disabled={enrolling}
                        className="btn-primary w-full justify-center"
                      >
                        {enrolling ? 'Enrolling...' : 'Enroll Now →'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="icon-box icon-box-primary w-10 h-10 text-lg">
                <span>📖</span>
              </div>
              <h2 className="text-xl font-semibold text-white">Course Content</h2>
            </div>
            
            {lessons.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-dark-800/50 flex items-center justify-center">
                  <span className="text-2xl">📚</span>
                </div>
                <p className="text-dark-400">No lessons available yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lessons.map((lesson, index) => (
                  <motion.div
                    key={lesson._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-dark-800/30 hover:bg-dark-800/50 border border-dark-700/30 hover:border-primary-500/20 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-dark-700 to-dark-800 flex items-center justify-center text-dark-400 font-semibold group-hover:from-primary-500/20 group-hover:to-brand-teal/20 group-hover:text-primary-400 transition-all border border-dark-600/50">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white group-hover:text-primary-400 transition-colors truncate">
                        {lesson.title}
                      </h3>
                      {lesson.description && (
                        <p className="text-sm text-dark-500 truncate">{lesson.description}</p>
                      )}
                    </div>
                    {isEnrolled && (
                      <Link
                        to={`/learn/${lesson._id}`}
                        className="btn-secondary text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Start →
                      </Link>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export default CourseDetail;
