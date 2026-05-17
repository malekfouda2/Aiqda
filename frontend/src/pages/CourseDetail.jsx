import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { analyticsAPI, coursesAPI, lessonsAPI, subscriptionsAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { getLocalizedField } from '../i18n/translations';
import { useLocale } from '../i18n/useLocale';
import { getCourseJourney, getEntityId, getLessonProgressState } from '../utils/courseNavigation';

function CourseDetail() {
  const { locale, t, isRTL } = useLocale();
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
  const [courseProgressData, setCourseProgressData] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id, user?._id]);

  const courseJourney = useMemo(() => (
    getCourseJourney({
      lessons,
      lessonProgress: courseProgressData?.lessonProgress || [],
    })
  ), [courseProgressData?.lessonProgress, lessons]);

  const courseProgressPercentage = useMemo(() => {
    const reportedProgress = Number(courseProgressData?.courseProgress?.progressPercentage);
    if (Number.isFinite(reportedProgress) && reportedProgress > 0) {
      return Math.round(reportedProgress);
    }

    return courseJourney.completionPercentage;
  }, [courseJourney.completionPercentage, courseProgressData?.courseProgress?.progressPercentage]);

  const recommendedLesson = courseJourney.recommendedLesson;
  const recommendedLessonState = recommendedLesson
    ? getLessonProgressState(recommendedLesson, courseJourney.progressMap)
    : null;
  const isCourseCompleted = courseJourney.isCompleted || courseProgressPercentage >= 100;
  const enrolledCount = course?.enrolledStudents?.length || 0;
  const courseAccessContext = course?.accessContext || null;
  const hasActiveCourseSubscription = courseAccessContext?.hasActiveSubscription ?? hasSubscription;
  const hasCurrentCourseAccess = courseAccessContext?.hasCourseAccess ?? false;
  const canResumeEnrolledCourse = isEnrolled && hasActiveCourseSubscription && hasCurrentCourseAccess;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [courseRes, lessonsRes] = await Promise.all([
        coursesAPI.getById(id),
        lessonsAPI.getByCourse(id)
      ]);
      setCourse(courseRes.data);
      setLessons(lessonsRes.data);
      
      if (user) {
        const enrolled = (courseRes.data.enrolledStudents || []).some(
          (studentId) => getEntityId(studentId) === user._id
        );
        setIsEnrolled(enrolled);

        try {
          const subRes = await subscriptionsAPI.getActiveSubscription();
          setHasSubscription(!!subRes.data);
        } catch {
          setHasSubscription(false);
        }

        if (enrolled) {
          const progressRes = await analyticsAPI.getCourseProgress(id).catch(() => null);
          setCourseProgressData(progressRes?.data || null);
        } else {
          setCourseProgressData(null);
        }
      } else {
        setIsEnrolled(false);
        setHasSubscription(false);
        setCourseProgressData(null);
      }
    } catch (error) {
      console.error('Failed to fetch course:', error);
      showError(isRTL ? 'تعذر تحميل الفصل' : 'Failed to load chapter');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/chapters/${id}` } } });
      return;
    }

    if (!hasSubscription) {
      showError(isRTL ? 'تحتاج إلى اشتراك نشط للتسجيل' : 'You need an active subscription to enroll');
      navigate('/dashboard/subscription');
      return;
    }

    setEnrolling(true);
    try {
      await coursesAPI.enroll(id);
      setIsEnrolled(true);
      setCourse((currentCourse) => {
        if (!currentCourse) {
          return currentCourse;
        }

        const nextStudents = [...(currentCourse.enrolledStudents || [])];
        if (!nextStudents.some((studentId) => getEntityId(studentId) === user._id)) {
          nextStudents.push(user._id);
        }

        return {
          ...currentCourse,
          enrolledStudents: nextStudents,
        };
      });
      showSuccess(isRTL ? 'تم التسجيل في الفصل بنجاح!' : 'Successfully enrolled in the chapter!');
    } catch (error) {
      showError(error.response?.data?.error || (isRTL ? 'تعذر التسجيل' : 'Failed to enroll'));
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text={isRTL ? 'جارٍ تحميل الفصل...' : 'Loading chapter...'} />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isRTL ? 'الفصل غير موجود' : 'Chapter not found'}</h2>
          <Link to="/chapters" className="btn-primary">{isRTL ? 'تصفح الفصول' : 'Browse Chapters'}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-8 pb-12 lg:pt-10 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-30" />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb w-[400px] h-[400px] bg-cyan-100/40 top-[-100px] right-[-100px] animate-float-slow" />
        <div className="floating-orb w-[300px] h-[300px] bg-primary-100/40 bottom-[-100px] left-[-50px] animate-float" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link to="/chapters" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 group transition-colors">
            <svg className={`w-5 h-5 transition-transform ${isRTL ? 'group-hover:translate-x-1 flip-in-rtl' : 'group-hover:-translate-x-1'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isRTL ? 'العودة إلى الفصول' : 'Back to Chapters'}
          </Link>

          <div className="card mb-8">
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)]">
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`tag ${
                    course.level === 'beginner' ? 'tag-beginner' :
                    course.level === 'intermediate' ? 'tag-intermediate' :
                    'tag-advanced'
                  }`}>
                    {t(`status.${course.level}`, course.level)}
                  </span>
                  <span className="text-gray-400">{getLocalizedField(course, 'category', locale)}</span>
                </div>
                
                <h1 className="text-4xl font-bold text-gray-900 mb-4">{getLocalizedField(course, 'title', locale)}</h1>
                <p className="text-gray-600 text-lg leading-relaxed mb-6">{getLocalizedField(course, 'description', locale)}</p>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-50 to-cyan-50 flex items-center justify-center">
                      <span className="text-xs">👤</span>
                    </div>
                    <span>{getLocalizedField(course.instructor, 'name', locale) || (isRTL ? 'صانع المحتوى' : 'Creator')}</span>
                  </div>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span className="flex items-center gap-1.5">
                    <span>📹</span> {lessons.length} {isRTL ? 'محتوى' : 'contents'}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span className="flex items-center gap-1.5">
                    <span>👥</span> {enrolledCount} {isRTL ? 'عضو' : 'members'}
                  </span>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">
                      {isRTL ? 'إجمالي المحتويات' : 'Total Contents'}
                    </p>
                    <p className="text-2xl font-semibold text-gray-900">{lessons.length}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">
                      {isRTL ? 'المكتمل' : 'Completed'}
                    </p>
                    <p className="text-2xl font-semibold text-gray-900">{courseJourney.completedCount}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">
                      {isRTL ? 'المرحلة الحالية' : 'Current Stage'}
                    </p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {isCourseCompleted
                        ? (isRTL ? 'مكتمل' : 'Completed')
                        : recommendedLessonState?.hasStarted
                          ? (isRTL ? 'استئناف' : 'Resume')
                          : (isRTL ? 'ابدأ' : 'Start')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  {isEnrolled ? (
                    <div>
                      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.24em] text-gray-400 mb-2">
                            {isRTL ? 'رحلتك داخل الفصل' : 'Your Chapter Journey'}
                          </p>
                          <p className="text-xl font-semibold leading-tight text-gray-900">
                            {isCourseCompleted
                              ? (isRTL ? 'أكملت هذا الفصل' : 'You completed this chapter')
                              : (isRTL ? 'استمر بخطوة واضحة' : 'Continue with a clear next step')}
                          </p>
                        </div>
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50">
                          <span className="text-2xl">{isCourseCompleted ? '🏁' : '🧭'}</span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-500/8 via-white to-cyan-500/8 p-4 mb-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            {isRTL ? 'تقدم الفصل' : 'Chapter Progress'}
                          </span>
                          <span className="text-lg font-semibold text-primary-500">{courseProgressPercentage}%</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-white border border-gray-200 overflow-hidden mb-3">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-cyan-500 transition-all duration-500"
                            style={{ width: `${Math.min(courseProgressPercentage, 100)}%` }}
                          />
                        </div>
                        <p className="text-sm text-gray-500">
                          {isRTL
                            ? `أنجزت ${courseJourney.completedCount} من ${lessons.length} محتوى`
                            : `You've completed ${courseJourney.completedCount} of ${lessons.length} contents`}
                        </p>
                      </div>

                      {recommendedLesson && (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 mb-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">
                            {isCourseCompleted ? (isRTL ? 'للمراجعة' : 'For Review') : (isRTL ? 'الخطوة التالية' : 'Next Best Step')}
                          </p>
                          <p className="font-semibold text-gray-900 mb-1">
                            {getLocalizedField(recommendedLesson, 'title', locale)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {isCourseCompleted
                              ? (isRTL ? 'يمكنك العودة إلى أي محتوى للمراجعة وقتما تشاء.' : 'You can revisit any content whenever you want.')
                              : recommendedLessonState?.hasStarted
                                ? (isRTL ? 'سنأخذك مباشرة إلى المكان الأنسب للمتابعة.' : "We'll take you straight to the best place to resume.")
                                : (isRTL ? 'ابدأ بالمحتوى التالي المقترح داخل هذا الفصل.' : 'Start the next recommended content inside this chapter.')}
                          </p>
                        </div>
                      )}

                      {!canResumeEnrolledCourse && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-4">
                          <p className="font-medium text-amber-800 mb-1">
                            {hasActiveCourseSubscription
                              ? (isRTL ? 'هذا الفصل غير مشمول في اشتراكك الحالي' : 'This chapter is not included in your current subscription')
                              : (isRTL ? 'تحتاج إلى اشتراك نشط للمتابعة' : 'You need an active subscription to continue')}
                          </p>
                          <p className="text-sm text-amber-700/90">
                            {hasActiveCourseSubscription
                              ? (isRTL ? 'يمكنك تغيير باقتك أو العودة إلى الفصول المتاحة ضمن اشتراكك الحالي.' : 'You can switch your package or return to chapters included in your current subscription.')
                              : (isRTL ? 'فعّل اشتراكك أو جدده ثم عد لإكمال هذا الفصل.' : 'Activate or renew your subscription, then return to continue this chapter.')}
                          </p>
                        </div>
                      )}

                      <div className="space-y-3">
                        {canResumeEnrolledCourse ? (
                          <Link
                            to={recommendedLesson ? `/development/${recommendedLesson._id}` : '#'}
                            className="btn-primary w-full px-5 py-3 text-base leading-tight"
                          >
                            {isCourseCompleted
                              ? (isRTL ? 'راجع الفصل ←' : 'Review Chapter →')
                              : recommendedLessonState?.hasStarted
                                ? (isRTL ? 'تابع التطوير ←' : 'Continue Development →')
                                : (isRTL ? 'ابدأ الفصل ←' : 'Start Chapter →')}
                          </Link>
                        ) : (
                          <Link
                            to="/dashboard/subscription"
                            className="btn-primary w-full px-5 py-3 text-base leading-tight"
                          >
                            {hasActiveCourseSubscription
                              ? (isRTL ? 'غيّر الباقة ←' : 'Change Package →')
                              : (isRTL ? 'فعّل الاشتراك ←' : 'Activate Subscription →')}
                          </Link>
                        )}
                        <a href="#chapter-roadmap" className="btn-secondary w-full px-5 py-3 text-base leading-tight">
                          {isRTL ? 'استعرض المسار' : 'View Roadmap'}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-center mb-6">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-50 to-cyan-50 flex items-center justify-center border border-primary-200">
                          <span className="text-3xl">🎓</span>
                        </div>
                        <p className="text-gray-500 text-sm">{isRTL ? 'ابدأ رحلة تطويرك' : 'Start your development journey'}</p>
                      </div>
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 mb-4">
                        <p className="font-medium text-gray-900 mb-1">
                          {hasSubscription
                            ? (isRTL ? 'أنت جاهز للتسجيل' : "You're ready to enroll")
                            : (isRTL ? 'تحتاج اشتراكًا نشطًا أولًا' : 'You need an active subscription first')}
                        </p>
                        <p className="text-sm text-gray-500">
                          {hasSubscription
                            ? (isRTL ? 'بمجرد التسجيل ستحصل على مسار تعلم منظم داخل الفصل.' : 'Once enrolled, you will get a guided chapter path and resume flow.')
                            : (isRTL ? 'فعّل اشتراكك للوصول إلى هذا الفصل ومحتواه.' : 'Activate your subscription to access this chapter and its content.')}
                        </p>
                      </div>
                      <button
                        onClick={handleEnroll}
                        disabled={enrolling}
                        className="btn-primary w-full px-5 py-3 text-base leading-tight"
                      >
                        {enrolling ? (isRTL ? 'جارٍ التسجيل...' : 'Enrolling...') : (isRTL ? 'سجّل الآن ←' : 'Enroll Now →')}
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
            id="chapter-roadmap"
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="icon-box icon-box-primary w-10 h-10 text-lg">
                  <span>📖</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{isRTL ? 'مسار الفصل' : 'Chapter Roadmap'}</h2>
                  <p className="text-sm text-gray-500">
                    {isRTL ? 'كل محتوى مرتب بخطوات واضحة من البداية حتى الإكمال.' : 'Every content item, ordered from first step to completion.'}
                  </p>
                </div>
              </div>

              {isEnrolled && lessons.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-sm text-gray-500">
                    {courseJourney.completedCount}/{lessons.length} {isRTL ? 'مكتمل' : 'completed'}
                  </span>
                  {recommendedLesson && (
                    <span className="px-3 py-1 rounded-full bg-primary-500/10 text-primary-500 border border-primary-100 text-sm">
                      {isRTL ? 'التالي:' : 'Up next:'} {getLocalizedField(recommendedLesson, 'title', locale)}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {lessons.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <span className="text-2xl">📚</span>
                </div>
                <p className="text-gray-500">{isRTL ? 'لا توجد محتويات متاحة بعد.' : 'No contents available yet.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lessons.map((lesson, index) => (
                  <motion.div
                    key={lesson._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    className={`p-4 rounded-2xl border transition-all ${
                      isEnrolled && recommendedLesson?._id === lesson._id
                        ? 'bg-gradient-to-r from-primary-500/8 via-white to-cyan-500/8 border-primary-200 shadow-sm'
                        : 'bg-gray-50 hover:bg-gray-100 border-gray-200 hover:border-primary-200'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-semibold border ${
                          isEnrolled && getLessonProgressState(lesson, courseJourney.progressMap).isQualified
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-white text-gray-500 border-gray-200'
                        }`}>
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="font-medium text-gray-900 truncate">
                              {getLocalizedField(lesson, 'title', locale)}
                            </h3>
                            {isEnrolled && recommendedLesson?._id === lesson._id && !getLessonProgressState(lesson, courseJourney.progressMap).isQualified && (
                              <span className="px-2.5 py-1 rounded-full bg-primary-500/10 text-primary-500 text-xs font-medium border border-primary-100">
                                {isRTL ? 'الخطوة التالية' : 'Up Next'}
                              </span>
                            )}
                            {isEnrolled && getLessonProgressState(lesson, courseJourney.progressMap).isQualified && (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium border border-emerald-200">
                                {isRTL ? 'مكتمل' : 'Completed'}
                              </span>
                            )}
                            {isEnrolled && !getLessonProgressState(lesson, courseJourney.progressMap).isQualified && getLessonProgressState(lesson, courseJourney.progressMap).hasStarted && (
                              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-medium border border-amber-200">
                                {isRTL ? 'قيد التقدم' : 'In Progress'}
                              </span>
                            )}
                          </div>

                          {lesson.description && (
                            <p className="text-sm text-gray-500 line-clamp-2 mb-3">{getLocalizedField(lesson, 'description', locale)}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                            <span>{isRTL ? `المحتوى ${index + 1} من ${lessons.length}` : `Content ${index + 1} of ${lessons.length}`}</span>
                            {isEnrolled && (
                              <span>
                                {getLessonProgressState(lesson, courseJourney.progressMap).watchPercentage}% {isRTL ? 'مشاهدة' : 'watched'}
                              </span>
                            )}
                          </div>

                          {isEnrolled && (
                            <div className="mt-3 h-2 rounded-full bg-white border border-gray-200 overflow-hidden max-w-xl">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  getLessonProgressState(lesson, courseJourney.progressMap).isQualified
                                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                                    : 'bg-gradient-to-r from-primary-500 to-cyan-500'
                                }`}
                                style={{ width: `${Math.min(getLessonProgressState(lesson, courseJourney.progressMap).watchPercentage, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {canResumeEnrolledCourse ? (
                        <Link
                          to={`/development/${lesson._id}`}
                          className={`justify-center whitespace-nowrap ${
                            recommendedLesson?._id === lesson._id
                              ? 'btn-primary'
                              : getLessonProgressState(lesson, courseJourney.progressMap).hasStarted
                                ? 'btn-secondary'
                                : 'btn-secondary'
                          }`}
                        >
                          {getLessonProgressState(lesson, courseJourney.progressMap).isQualified
                            ? (isRTL ? 'راجع ←' : 'Review →')
                            : getLessonProgressState(lesson, courseJourney.progressMap).hasStarted
                              ? (isRTL ? 'تابع ←' : 'Continue →')
                              : (isRTL ? 'ابدأ ←' : 'Start →')}
                        </Link>
                      ) : isEnrolled ? (
                        <Link
                          to="/dashboard/subscription"
                          className="btn-secondary justify-center whitespace-nowrap"
                        >
                          {hasActiveCourseSubscription
                            ? (isRTL ? 'غيّر الباقة ←' : 'Change Package →')
                            : (isRTL ? 'فعّل الاشتراك ←' : 'Activate Subscription →')}
                        </Link>
                      ) : (
                        <div className="text-sm text-gray-400 whitespace-nowrap">
                          {isRTL ? 'سجّل للوصول' : 'Enroll to unlock'}
                        </div>
                      )}
                    </div>
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
