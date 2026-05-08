import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { analyticsAPI, lessonsAPI, quizzesAPI, videoAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import VimeoPlayer from '../components/VimeoPlayer';
import { pageVariants, fadeInUp } from '../utils/animations';
import { downloadBlobResponse } from '../utils/download';
import { getLocalizedField } from '../i18n/translations';
import { useLocale } from '../i18n/useLocale';
import { getCourseJourney, getEntityId } from '../utils/courseNavigation';

function LessonView() {
  const { locale, isRTL } = useLocale();
  const { id } = useParams();
  const { user, hasAcceptedCurrentPlatformNotice } = useAuthStore();
  const { showSuccess, showError } = useUIStore();
  const [lesson, setLesson] = useState(null);
  const [progress, setProgress] = useState(null);
  const [courseLessons, setCourseLessons] = useState([]);
  const [courseProgressData, setCourseProgressData] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [quizResult, setQuizResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const viewerWatermark = useMemo(() => {
    if (!user) {
      return null;
    }

    const normalizedId = String(user._id || '').toUpperCase();
    const shortCode = normalizedId
      ? `${normalizedId.slice(0, 4)}-${normalizedId.slice(-4)}`
      : 'AIQDA';

    return {
      name: user.name || user.email || (isRTL ? 'عضو' : 'Member'),
      code: shortCode,
    };
  }, [isRTL, user]);
  const courseJourney = useMemo(() => (
    getCourseJourney({
      lessons: courseLessons,
      lessonProgress: courseProgressData?.lessonProgress || [],
      currentLessonId: id,
    })
  ), [courseLessons, courseProgressData?.lessonProgress, id]);
  const chapterProgressPercentage = useMemo(() => {
    const reportedProgress = Number(courseProgressData?.courseProgress?.progressPercentage);
    const derivedProgress = Number(courseJourney.completionPercentage || 0);

    if (Number.isFinite(reportedProgress)) {
      return Math.round(Math.max(reportedProgress, derivedProgress));
    }

    return Math.round(derivedProgress);
  }, [courseJourney.completionPercentage, courseProgressData?.courseProgress?.progressPercentage]);
  const currentLessonPosition = courseJourney.currentIndex >= 0 ? courseJourney.currentIndex + 1 : null;
  const nextLessonAfterCompletion = courseJourney.nextIncompleteAfterCurrent || courseJourney.nextLesson;

  const syncCourseProgressEntry = useCallback((nextProgress) => {
    setCourseProgressData((currentData) => {
      const existingLessonProgress = currentData?.lessonProgress || [];
      const nextLessonId = getEntityId(nextProgress?.lesson) || id;
      const normalizedEntry = {
        ...nextProgress,
        lesson: nextProgress?.lesson || lesson || { _id: id },
        course: nextProgress?.course || lesson?.course || currentData?.courseProgress?.course || null,
      };

      const lessonProgress = existingLessonProgress.some(
        (entry) => getEntityId(entry.lesson) === nextLessonId
      )
        ? existingLessonProgress.map((entry) => (
          getEntityId(entry.lesson) === nextLessonId
            ? { ...entry, ...normalizedEntry }
            : entry
        ))
        : [...existingLessonProgress, normalizedEntry];

      return {
        ...(currentData || {}),
        lessonProgress,
      };
    });
  }, [id, lesson]);

  useEffect(() => {
    if (hasAcceptedCurrentPlatformNotice()) {
      fetchData();
      return;
    }

    setLoading(false);
  }, [hasAcceptedCurrentPlatformNotice, id, user?._id]);

  const fetchData = async () => {
    setLoading(true);
    setShowQuiz(false);
    setQuizResult(null);
    try {
      const [lessonRes, quizRes, videoRes] = await Promise.all([
        lessonsAPI.getById(id),
        quizzesAPI.getByLesson(id).catch(() => null),
        videoAPI.getEmbed(id).catch(() => null)
      ]);
      const lessonData = lessonRes.data.lesson;

      setLesson(lessonData);
      setProgress(lessonRes.data.progress);
      setVideoData(videoRes?.data || null);

      if (quizRes?.data) {
        setQuiz(quizRes.data);
        setAnswers(new Array(quizRes.data.questions.length).fill(-1));
      } else {
        setQuiz(null);
        setAnswers([]);
      }

      if (lessonData?.course?._id) {
        const [courseLessonsRes, courseProgressRes] = await Promise.all([
          lessonsAPI.getByCourse(lessonData.course._id).catch(() => ({ data: [] })),
          user ? analyticsAPI.getCourseProgress(lessonData.course._id).catch(() => null) : Promise.resolve(null),
        ]);

        setCourseLessons(courseLessonsRes.data || []);
        setCourseProgressData(courseProgressRes?.data || null);
      } else {
        setCourseLessons([]);
        setCourseProgressData(null);
      }
    } catch (error) {
      console.error('Failed to fetch lesson:', error);
      showError(isRTL ? 'تعذر تحميل المحتوى' : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const handleProgressUpdate = useCallback(async (percentage) => {
    try {
      const response = await lessonsAPI.updateProgress(id, percentage);
      setProgress(response.data);
      syncCourseProgressEntry(response.data);
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  }, [id, syncCourseProgressEntry]);

  const handleSubmitQuiz = async () => {
    if (answers.some(a => a === -1)) {
      showError(isRTL ? 'يرجى الإجابة عن جميع الأسئلة' : 'Please answer all questions');
      return;
    }

    setSubmitting(true);
    try {
      const response = await quizzesAPI.submit(id, answers);
      setQuizResult(response.data);
      setProgress(response.data.progress);
      syncCourseProgressEntry(response.data.progress);
      if (response.data.passed) {
        showSuccess(isRTL ? 'تم اجتياز الاختبار! اكتمل المحتوى.' : 'Quiz passed! Content completed.');
      } else {
        showError(isRTL ? 'لم يتم اجتياز الاختبار. حاول مرة أخرى!' : 'Quiz not passed. Try again!');
      }
    } catch (error) {
      showError(isRTL ? 'تعذر إرسال الاختبار' : 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadSupportingFile = async () => {
    try {
      const response = await lessonsAPI.downloadFile(id);
      downloadBlobResponse(
        response,
        lesson?.supportingFileName || 'lesson-supporting-file'
      );
    } catch (error) {
      console.error('Failed to download supporting file:', error);
      showError(isRTL ? 'تعذر تنزيل الملف الداعم' : 'Failed to download supporting file');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text={isRTL ? 'جارٍ تحميل المحتوى...' : 'Loading content...'} />
      </div>
    );
  }

  if (!hasAcceptedCurrentPlatformNotice()) {
    return (
      <motion.div
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        className="min-h-screen flex items-center justify-center"
      >
        <motion.div variants={fadeInUp} className="card max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">{isRTL ? 'الوصول إلى المحتوى يتطلب الإقرار' : 'Content Access Requires Acknowledgement'}</h2>
          <p className="text-gray-500">
            {isRTL ? 'يرجى مراجعة الشروط والأحكام الخاصة بالمستخدمين وقبولها للمتابعة إلى هذا المحتوى.' : 'Please review and accept the Terms & Conditions For Users to continue into this content.'}
          </p>
        </motion.div>
      </motion.div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isRTL ? 'المحتوى غير موجود' : 'Content not found'}</h2>
          <Link to="/dashboard" className="btn-primary">{isRTL ? 'الذهاب إلى لوحة التحكم' : 'Go to Dashboard'}</Link>
        </div>
      </div>
    );
  }

  const watchPct = progress?.watchPercentage || 0;
  const minPct = lesson.minimumWatchPercentage || 80;

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen py-8 relative overflow-hidden"
    >
      <div className="absolute inset-0 mesh-gradient opacity-20" />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb w-[400px] h-[400px] bg-primary-100/40 top-[-150px] left-[-100px] animate-float-slow" />
        <div className="floating-orb w-[300px] h-[300px] bg-orange-100/30 bottom-[-100px] right-[-50px] animate-float" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div variants={fadeInUp}>
          <Link
            to={`/courses/${lesson.course?._id}`}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 group transition-colors"
          >
            <svg className={`w-5 h-5 transition-transform ${isRTL ? 'group-hover:translate-x-1 flip-in-rtl' : 'group-hover:-translate-x-1'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isRTL ? 'العودة إلى الفصل' : 'Back to Chapter'}
          </Link>

          <div className="mb-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-4"
            >
              <span className="text-lg">📹</span>
              <span className="text-xs text-gray-500">{isRTL ? 'محتوى الفيديو' : 'Video Content'}</span>
            </motion.div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{getLocalizedField(lesson, 'title', locale)}</h1>
            {lesson.description && (
              <p className="text-gray-500 text-lg">{getLocalizedField(lesson, 'description', locale)}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {currentLessonPosition && (
                <span className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-sm text-gray-500">
                  {isRTL
                    ? `المحتوى ${currentLessonPosition} من ${courseJourney.lessons.length || 1}`
                    : `Content ${currentLessonPosition} of ${courseJourney.lessons.length || 1}`}
                </span>
              )}
              <span className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-sm text-gray-500">
                {isRTL ? 'تقدم الفصل: ' : 'Chapter progress: '}
                <span className="font-semibold text-primary-500">{chapterProgressPercentage}%</span>
              </span>
              {nextLessonAfterCompletion && progress?.isQualified && (
                <span className="px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-100 text-sm text-primary-500">
                  {isRTL ? 'التالي: ' : 'Up next: '}
                  {getLocalizedField(nextLessonAfterCompletion, 'title', locale)}
                </span>
              )}
            </div>
          </div>

          <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
            <div>
              <div className="card mb-6">
                {videoData?.vimeoVideoId ? (
                  <div className="mb-6">
                    <VimeoPlayer
                      vimeoVideoId={videoData.vimeoVideoId}
                      embedUrl={videoData.embedUrl}
                      onProgressUpdate={handleProgressUpdate}
                      initialProgress={watchPct}
                      viewerWatermark={viewerWatermark}
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-white rounded-xl flex items-center justify-center mb-6 border border-gray-200">
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-50 to-cyan-50 flex items-center justify-center border border-primary-100">
                        <span className="text-4xl">🎬</span>
                      </div>
                      <p className="text-gray-500">{isRTL ? 'لم يتم ربط فيديو بهذا المحتوى بعد' : 'Video not yet assigned to this content'}</p>
                      <p className="text-gray-400 text-sm mt-1">{isRTL ? 'تواصل مع صانع المحتوى أو الإدارة' : 'Contact your creator or admin'}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <div className="glass-dark px-4 py-3 rounded-xl">
                      <p className="text-gray-500 text-sm">
                        {isRTL ? 'نسبة المشاهدة: ' : 'Watch progress: '}<span className={`font-semibold ${watchPct >= minPct ? 'text-emerald-500' : 'text-primary-500'}`}>{watchPct}%</span>
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {isRTL ? 'الحد الأدنى المطلوب: ' : 'Minimum required: '}{minPct}%
                      </p>
                    </div>
                    {watchPct >= minPct && (
                      <div className="flex items-center gap-2 text-emerald-500">
                        <span className="text-lg">✅</span>
                        <span className="text-sm font-medium">{isRTL ? 'تم استيفاء شرط المشاهدة' : 'Watch requirement met'}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-40 h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          watchPct >= minPct
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                            : 'bg-gradient-to-r from-primary-500 to-cyan-500'
                        }`}
                        style={{ width: `${Math.min(watchPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right">{watchPct}%</span>
                  </div>
                </div>
              </div>

              {lesson.supportingFile && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="card mb-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="icon-box icon-box-primary w-10 h-10 text-lg">
                      <span>📎</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{isRTL ? 'ملف داعم' : 'Supporting Document'}</h3>
                      <p className="text-gray-400 text-sm">{isRTL ? 'قم بتنزيل المادة المساندة للمحتوى' : 'Download the content material'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadSupportingFile}
                      className="btn-secondary text-sm"
                    >
                      {isRTL ? 'تنزيل' : 'Download'}
                    </button>
                  </div>
                </motion.div>
              )}

              {progress?.isQualified && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card bg-gradient-to-r from-emerald-50 to-cyan-50 border-emerald-200 mb-6"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-cyan-50 flex items-center justify-center border border-emerald-200">
                        <span className="text-2xl">✅</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-emerald-700 text-lg">{isRTL ? 'اكتمل المحتوى!' : 'Content Completed!'}</h3>
                        <p className="text-emerald-600/60 text-sm">
                          {isRTL ? 'لقد اجتزت هذا المحتوى بنجاح.' : 'You have successfully qualified this content.'}
                        </p>
                      </div>
                    </div>

                    {nextLessonAfterCompletion && (
                      <Link to={`/learn/${nextLessonAfterCompletion._id}`} className="btn-primary justify-center whitespace-nowrap">
                        {isRTL ? 'انتقل إلى التالي ←' : 'Go To Next →'}
                      </Link>
                    )}
                  </div>
                </motion.div>
              )}

              {quiz && !progress?.isQualified && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="card mb-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="icon-box icon-box-accent w-10 h-10 text-lg">
                        <span>📝</span>
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900">{isRTL ? 'الاختبار' : 'Quiz'}</h2>
                    </div>
                    {!showQuiz && (
                      <button
                        onClick={() => setShowQuiz(true)}
                        className="btn-primary"
                        disabled={watchPct < minPct}
                      >
                        {watchPct >= minPct
                          ? (isRTL ? 'ابدأ الاختبار ←' : 'Take Quiz →')
                          : (isRTL ? `شاهد ${minPct}% أولًا` : `Watch ${minPct}% first`)}
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
                          className="bg-gray-50 rounded-xl p-5 border border-gray-200"
                        >
                          <p className="font-medium text-gray-900 mb-4">
                            <span className="text-primary-500 mr-2">{qIndex + 1}.</span>
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
                                    ? 'bg-primary-500/10 border-primary-500/50 text-gray-900'
                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-100'
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
                        {submitting ? (isRTL ? 'جارٍ الإرسال...' : 'Submitting...') : (isRTL ? 'إرسال الاختبار' : 'Submit Quiz')}
                      </button>

                      {quizResult && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-5 rounded-xl border ${
                            quizResult.passed
                              ? 'bg-emerald-50 border-emerald-200'
                              : 'bg-rose-50 border-rose-200'
                          }`}
                        >
                          <p className={`font-semibold text-lg ${quizResult.passed ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {isRTL ? 'النتيجة: ' : 'Score: '}{quizResult.score}/{quizResult.totalQuestions}
                          </p>
                          <p className="text-sm mt-1 text-gray-500">
                            {quizResult.passed
                              ? (isRTL ? 'تهانينا! لقد اجتزت الاختبار.' : 'Congratulations! You passed the quiz.')
                              : (isRTL ? 'حاول مرة أخرى لاجتياز الاختبار.' : 'Try again to pass the quiz.')}
                          </p>
                        </motion.div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="card"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-gray-400 mb-2">
                      {isRTL ? 'التنقل داخل الفصل' : 'Chapter Navigation'}
                    </p>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">
                      {nextLessonAfterCompletion
                        ? getLocalizedField(nextLessonAfterCompletion, 'title', locale)
                        : (isRTL ? 'أنت في نهاية هذا الفصل' : 'You are at the end of this chapter')}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {nextLessonAfterCompletion
                        ? (isRTL ? 'انتقل بسلاسة إلى المحتوى التالي أو ارجع لما قبله متى احتجت.' : 'Move smoothly to the next content or jump back whenever you need.')
                        : (isRTL ? 'يمكنك مراجعة المحتوى السابق أو العودة إلى الفصل الكامل.' : 'You can revisit previous content or return to the full chapter roadmap.')}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    {courseJourney.previousLesson ? (
                      <Link to={`/learn/${courseJourney.previousLesson._id}`} className="btn-secondary justify-center whitespace-nowrap">
                        {isRTL ? '← السابق' : '← Previous'}
                      </Link>
                    ) : (
                      <div className="btn-secondary justify-center whitespace-nowrap opacity-50 pointer-events-none">
                        {isRTL ? '← السابق' : '← Previous'}
                      </div>
                    )}

                    {nextLessonAfterCompletion ? (
                      <Link to={`/learn/${nextLessonAfterCompletion._id}`} className="btn-primary justify-center whitespace-nowrap">
                        {isRTL ? 'التالي ←' : 'Next →'}
                      </Link>
                    ) : (
                      <Link to={`/courses/${lesson.course?._id}`} className="btn-primary justify-center whitespace-nowrap">
                        {isRTL ? 'العودة إلى الفصل ←' : 'Back To Chapter →'}
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>

            <aside className="space-y-6 xl:sticky xl:top-28">
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="card"
              >
                <p className="text-xs uppercase tracking-[0.22em] text-gray-400 mb-2">
                  {isRTL ? 'لوحة الفصل' : 'Chapter Panel'}
                </p>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  {getLocalizedField(lesson.course, 'title', locale)}
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  {isRTL ? 'تحكم سريع في مكانك داخل الفصل وخطوتك التالية.' : 'A quick view of where you are and what comes next.'}
                </p>

                <div className="rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-500/8 via-white to-cyan-500/8 p-4 mb-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-sm font-medium text-gray-700">{isRTL ? 'تقدم الفصل' : 'Chapter Progress'}</span>
                    <span className="text-lg font-semibold text-primary-500">{chapterProgressPercentage}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white border border-gray-200 overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary-500 to-cyan-500 transition-all duration-500"
                      style={{ width: `${Math.min(chapterProgressPercentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500">
                    {isRTL
                      ? `أنجزت ${courseJourney.completedCount} من ${courseJourney.lessons.length || 1} محتوى`
                      : `You completed ${courseJourney.completedCount} of ${courseJourney.lessons.length || 1} contents`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {courseJourney.previousLesson ? (
                    <Link to={`/learn/${courseJourney.previousLesson._id}`} className="btn-secondary justify-center text-sm">
                      {isRTL ? 'السابق' : 'Previous'}
                    </Link>
                  ) : (
                    <div className="btn-secondary justify-center text-sm opacity-50 pointer-events-none">
                      {isRTL ? 'السابق' : 'Previous'}
                    </div>
                  )}

                  {courseJourney.nextLesson ? (
                    <Link to={`/learn/${courseJourney.nextLesson._id}`} className="btn-secondary justify-center text-sm">
                      {isRTL ? 'التالي' : 'Next'}
                    </Link>
                  ) : (
                    <div className="btn-secondary justify-center text-sm opacity-50 pointer-events-none">
                      {isRTL ? 'التالي' : 'Next'}
                    </div>
                  )}
                </div>

                {nextLessonAfterCompletion && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">
                      {progress?.isQualified ? (isRTL ? 'جاهز الآن' : 'Ready Now') : (isRTL ? 'بعد هذا المحتوى' : 'After This Content')}
                    </p>
                    <p className="font-semibold text-gray-900 mb-1">
                      {getLocalizedField(nextLessonAfterCompletion, 'title', locale)}
                    </p>
                    <Link to={`/learn/${nextLessonAfterCompletion._id}`} className="text-sm text-primary-500 font-medium">
                      {isRTL ? 'افتح المحتوى ←' : 'Open content →'}
                    </Link>
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="card"
              >
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{isRTL ? 'محتويات الفصل' : 'Chapter Contents'}</h2>
                    <p className="text-sm text-gray-500">{isRTL ? 'تنقل مباشر بين كل خطوة.' : 'Direct navigation across every step.'}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs text-gray-500">
                    {courseJourney.lessons.length}
                  </span>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {courseJourney.lessons.map((courseLesson, index) => {
                    const lessonId = getEntityId(courseLesson);
                    const lessonEntry = courseJourney.lessonStates.find(
                      (state) => getEntityId(state.lesson) === lessonId
                    );
                    const isCurrentLesson = lessonId === id;

                    return (
                      <Link
                        key={courseLesson._id}
                        to={`/learn/${courseLesson._id}`}
                        className={`block rounded-2xl border p-3 transition-all ${
                          isCurrentLesson
                            ? 'border-primary-200 bg-gradient-to-r from-primary-500/8 via-white to-cyan-500/8'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm font-semibold ${
                            lessonEntry?.isQualified
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                              : isCurrentLesson
                                ? 'border-primary-200 bg-primary-500/10 text-primary-500'
                                : 'border-gray-200 bg-gray-50 text-gray-500'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="font-medium text-gray-900 truncate">
                                {getLocalizedField(courseLesson, 'title', locale)}
                              </p>
                              {isCurrentLesson && (
                                <span className="px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500 text-[11px] font-medium border border-primary-100">
                                  {isRTL ? 'الآن' : 'Now'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-3 text-xs text-gray-400">
                              <span>
                                {lessonEntry?.isQualified
                                  ? (isRTL ? 'مكتمل' : 'Completed')
                                  : lessonEntry?.hasStarted
                                    ? (isRTL ? 'قيد التقدم' : 'In Progress')
                                    : (isRTL ? 'لم يبدأ بعد' : 'Not started')}
                              </span>
                              <span>{lessonEntry?.watchPercentage || 0}%</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            </aside>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default LessonView;
