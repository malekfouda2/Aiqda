import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { lessonsAPI, quizzesAPI, videoAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';

function LessonView() {
  const { id } = useParams();
  const { showSuccess, showError } = useUIStore();
  const [lesson, setLesson] = useState(null);
  const [progress, setProgress] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [quizResult, setQuizResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [lessonRes, quizRes] = await Promise.all([
        lessonsAPI.getById(id),
        quizzesAPI.getByLesson(id).catch(() => null)
      ]);
      
      setLesson(lessonRes.data.lesson);
      setProgress(lessonRes.data.progress);
      if (quizRes?.data) {
        setQuiz(quizRes.data);
        setAnswers(new Array(3).fill(-1));
      }

      try {
        const videoRes = await videoAPI.getEmbed(id);
        setVideoData(videoRes.data);
      } catch {
        console.log('Video not available');
      }
    } catch (error) {
      console.error('Failed to fetch lesson:', error);
      showError('Failed to load lesson');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProgress = async (percentage) => {
    try {
      const response = await lessonsAPI.updateProgress(id, percentage);
      setProgress(response.data);
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  };

  const handleSubmitQuiz = async () => {
    if (answers.some(a => a === -1)) {
      showError('Please answer all questions');
      return;
    }

    setSubmitting(true);
    try {
      const response = await quizzesAPI.submit(id, answers);
      setQuizResult(response.data);
      setProgress(response.data.progress);
      if (response.data.passed) {
        showSuccess('Quiz passed! Lesson completed.');
      } else {
        showError('Quiz not passed. Try again!');
      }
    } catch (error) {
      showError('Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading lesson..." />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Lesson not found</h2>
          <Link to="/dashboard" className="btn-primary">Go to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-20" />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb w-[400px] h-[400px] bg-primary-500/10 top-[-150px] left-[-100px] animate-float-slow" />
        <div className="floating-orb w-[300px] h-[300px] bg-violet-500/10 bottom-[-100px] right-[-50px] animate-float" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link
            to={`/courses/${lesson.course?._id}`}
            className="inline-flex items-center gap-2 text-dark-400 hover:text-white mb-6 group transition-colors"
          >
            <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Course
          </Link>

          <div className="mb-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-4"
            >
              <span className="text-lg">📹</span>
              <span className="text-xs text-dark-400">Video Lesson</span>
            </motion.div>
            <h1 className="text-3xl font-bold text-white mb-2">{lesson.title}</h1>
            {lesson.description && (
              <p className="text-dark-400 text-lg">{lesson.description}</p>
            )}
          </div>

          <div className="card mb-6">
            {videoData ? (
              <div className="aspect-video bg-dark-800 rounded-xl overflow-hidden mb-6 border border-dark-700/30">
                <iframe
                  src={videoData.embedUrl}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title={lesson.title}
                />
              </div>
            ) : (
              <div className="aspect-video bg-gradient-to-br from-dark-800/80 to-dark-900/80 rounded-xl flex items-center justify-center mb-6 border border-dark-700/30">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500/20 to-indigo-500/20 flex items-center justify-center border border-primary-500/10">
                    <span className="text-4xl">🎬</span>
                  </div>
                  <p className="text-dark-400">Video not available</p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="glass-dark px-4 py-3 rounded-xl">
                <p className="text-dark-400 text-sm">
                  Minimum watch: <span className="text-primary-400 font-medium">{lesson.minimumWatchPercentage}%</span>
                </p>
                <p className="text-dark-500 text-sm">
                  Your progress: <span className="text-white font-medium">{progress?.watchPercentage || 0}%</span>
                </p>
              </div>

              <div className="flex gap-2">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleUpdateProgress(pct)}
                    className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${
                      progress?.watchPercentage >= pct
                        ? 'bg-gradient-to-r from-primary-500 to-cyan-500 text-white shadow-lg shadow-primary-500/20'
                        : 'bg-dark-800/50 text-dark-400 hover:bg-dark-700/50 border border-dark-700/30'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {progress?.isQualified && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card bg-gradient-to-r from-emerald-900/20 to-cyan-900/20 border-emerald-500/20 mb-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 flex items-center justify-center border border-emerald-500/20">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-400 text-lg">Lesson Completed!</h3>
                  <p className="text-emerald-400/60 text-sm">
                    You have successfully qualified this lesson.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {quiz && !progress?.isQualified && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="icon-box icon-box-accent w-10 h-10 text-lg">
                    <span>📝</span>
                  </div>
                  <h2 className="text-xl font-semibold text-white">Quiz</h2>
                </div>
                {!showQuiz && (
                  <button
                    onClick={() => setShowQuiz(true)}
                    className="btn-primary"
                    disabled={progress?.watchPercentage < lesson.minimumWatchPercentage}
                  >
                    {progress?.watchPercentage >= lesson.minimumWatchPercentage
                      ? 'Take Quiz →'
                      : `Watch ${lesson.minimumWatchPercentage}% first`}
                  </button>
                )}
              </div>

              {showQuiz && (
                <div className="space-y-6">
                  {quiz.questions.map((q, qIndex) => (
                    <motion.div
                      key={q._id || qIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: qIndex * 0.1 }}
                      className="bg-dark-800/30 rounded-xl p-5 border border-dark-700/30"
                    >
                      <p className="font-medium text-white mb-4">
                        <span className="text-primary-400 mr-2">{qIndex + 1}.</span>
                        {q.question}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((option, oIndex) => (
                          <button
                            key={oIndex}
                            onClick={() => {
                              const newAnswers = [...answers];
                              newAnswers[qIndex] = oIndex;
                              setAnswers(newAnswers);
                            }}
                            className={`w-full text-left p-4 rounded-xl border transition-all ${
                              answers[qIndex] === oIndex
                                ? 'bg-primary-500/10 border-primary-500/50 text-white'
                                : 'bg-dark-900/50 border-dark-700/30 text-dark-300 hover:border-dark-600 hover:bg-dark-800/50'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ))}

                  <button
                    onClick={handleSubmitQuiz}
                    disabled={submitting}
                    className="btn-primary w-full py-4"
                  >
                    {submitting ? 'Submitting...' : 'Submit Quiz'}
                  </button>

                  {quizResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-5 rounded-xl border ${
                        quizResult.passed 
                          ? 'bg-emerald-900/20 border-emerald-500/20' 
                          : 'bg-rose-900/20 border-rose-500/20'
                      }`}
                    >
                      <p className={`font-semibold text-lg ${quizResult.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                        Score: {quizResult.score}/{quizResult.totalQuestions}
                      </p>
                      <p className="text-sm mt-1 text-dark-400">
                        {quizResult.passed ? 'Congratulations! You passed the quiz.' : 'Try again to pass the quiz.'}
                      </p>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default LessonView;
