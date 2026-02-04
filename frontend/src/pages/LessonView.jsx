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
    <div className="min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link
            to={`/courses/${lesson.course?._id}`}
            className="inline-flex items-center gap-2 text-dark-400 hover:text-white mb-6"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Course
          </Link>

          <h1 className="text-3xl font-bold text-white mb-4">{lesson.title}</h1>
          {lesson.description && (
            <p className="text-dark-400 mb-6">{lesson.description}</p>
          )}

          <div className="card mb-6">
            {videoData ? (
              <div className="aspect-video bg-dark-800 rounded-lg overflow-hidden mb-4">
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
              <div className="aspect-video bg-dark-800 rounded-lg flex items-center justify-center mb-4">
                <div className="text-center">
                  <span className="text-5xl mb-4 block">🎬</span>
                  <p className="text-dark-400">Video not available</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-dark-400 text-sm">
                  Minimum watch: {lesson.minimumWatchPercentage}%
                </p>
                <p className="text-dark-500 text-sm">
                  Your progress: {progress?.watchPercentage || 0}%
                </p>
              </div>

              <div className="flex gap-2">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleUpdateProgress(pct)}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      progress?.watchPercentage >= pct
                        ? 'bg-primary-600 text-white'
                        : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {progress?.isQualified && (
            <div className="card bg-green-900/20 border-green-800 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <h3 className="font-semibold text-green-300">Lesson Completed!</h3>
                  <p className="text-green-400/80 text-sm">
                    You have qualified this lesson.
                  </p>
                </div>
              </div>
            </div>
          )}

          {quiz && !progress?.isQualified && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Quiz</h2>
                {!showQuiz && (
                  <button
                    onClick={() => setShowQuiz(true)}
                    className="btn-primary"
                    disabled={progress?.watchPercentage < lesson.minimumWatchPercentage}
                  >
                    {progress?.watchPercentage >= lesson.minimumWatchPercentage
                      ? 'Take Quiz'
                      : `Watch ${lesson.minimumWatchPercentage}% first`}
                  </button>
                )}
              </div>

              {showQuiz && (
                <div className="space-y-6">
                  {quiz.questions.map((q, qIndex) => (
                    <div key={q._id || qIndex} className="bg-dark-800/50 rounded-lg p-4">
                      <p className="font-medium text-white mb-3">
                        {qIndex + 1}. {q.question}
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
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                              answers[qIndex] === oIndex
                                ? 'bg-primary-600/20 border-primary-500 text-white'
                                : 'bg-dark-900 border-dark-700 text-dark-300 hover:border-dark-500'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleSubmitQuiz}
                    disabled={submitting}
                    className="btn-primary w-full"
                  >
                    {submitting ? 'Submitting...' : 'Submit Quiz'}
                  </button>

                  {quizResult && (
                    <div className={`p-4 rounded-lg ${quizResult.passed ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'}`}>
                      <p className={`font-semibold ${quizResult.passed ? 'text-green-300' : 'text-red-300'}`}>
                        Score: {quizResult.score}/{quizResult.totalQuestions}
                      </p>
                      <p className="text-sm mt-1 text-dark-400">
                        {quizResult.passed ? 'Congratulations! You passed.' : 'Try again to pass the quiz.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default LessonView;
