import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyticsAPI, videoAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, expandVariants } from '../utils/animations';

const DASHBOARD_REFRESH_MS = 15000;
const LESSON_ANALYTICS_REFRESH_MS = 10000;

function StatCard({ label, value, sub, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-50 border-gray-100',
    green: 'bg-green-50 border-green-100',
    blue: 'bg-blue-50 border-blue-100',
    amber: 'bg-amber-50 border-amber-100',
    primary: 'bg-primary-50 border-primary-100',
    cyan: 'bg-cyan-50 border-cyan-100',
    rose: 'bg-rose-50 border-rose-100',
  };

  return (
    <div className={`rounded-xl p-3 border ${colors[color]}`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub ? <p className="text-xs text-gray-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}

function ProgressBar({ value = 0, fillClass = 'from-primary-500 to-cyan-500' }) {
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${fillClass} transition-all duration-300`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function formatRelativeTime(value) {
  if (!value) {
    return 'No activity yet';
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 'No activity yet';
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) {
    return 'Just now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function formatDateTime(value) {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString();
}

function LessonAnalyticsPanel({ analytics, loading, error }) {
  if (loading && !analytics) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        Loading live lesson analytics...
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const { appAnalytics, studentProgress, vimeo, refreshedAt, lesson } = analytics;
  const delivery = vimeo?.delivery || {};
  const capabilities = vimeo?.capabilities || {};

  return (
    <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h6 className="text-sm font-semibold text-gray-900">Live lesson analytics</h6>
          <p className="text-xs text-gray-400">
            Auto-refreshing every 10 seconds. Last updated {formatDateTime(refreshedAt)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500">
            Minimum watch requirement {lesson.minimumWatchPercentage}%
          </span>
          {vimeo?.available ? (
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs text-cyan-700">
              Vimeo {vimeo.accountType || 'connected'}
            </span>
          ) : (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
              Vimeo metrics unavailable
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Enrolled" value={appAnalytics.totalEnrolledStudents} color="blue" />
        <StatCard label="Started" value={appAnalytics.studentsWithActivity} sub={`${appAnalytics.studentsNotStarted} not started`} color="primary" />
        <StatCard label="Active now" value={appAnalytics.activeStudentsNow} sub={`last ${appAnalytics.activeWindowMinutes} min`} color="green" />
        <StatCard label="Avg watch" value={`${appAnalytics.averageWatchPercentage}%`} color="cyan" />
        <StatCard label="Watch met" value={appAnalytics.watchRequirementMetCount} sub={`${appAnalytics.watchRequirementMetRate}% of enrolled`} color="amber" />
        <StatCard label="Qualified" value={appAnalytics.qualifiedCount} sub={`${appAnalytics.qualificationRate}% of enrolled`} color="rose" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h6 className="text-sm font-semibold text-gray-900">Student watch progress</h6>
              <p className="text-xs text-gray-400">Live Aiqda progress updates from this lesson player.</p>
            </div>
            <div className="flex gap-2 text-xs text-gray-400">
              <span>Quiz pass rate {appAnalytics.quizPassRate}%</span>
              <span>Completion rate {appAnalytics.completionRate}%</span>
            </div>
          </div>

          {studentProgress.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              No student activity has been recorded for this lesson yet.
            </div>
          ) : (
            <div className="space-y-3">
              {studentProgress.map((student) => (
                <div key={student.progressId} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-gray-900">{student.name}</p>
                        {student.isActiveNow ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            Active now
                          </span>
                        ) : null}
                        {student.isQualified ? (
                          <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                            Qualified
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{student.email || 'No email available'}</p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3 lg:w-[420px]">
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Watch</span>
                          <span>{student.watchPercentage}%</span>
                        </div>
                        <ProgressBar
                          value={student.watchPercentage}
                          fillClass={student.hasMetWatchRequirement ? 'from-emerald-400 to-emerald-500' : 'from-primary-500 to-cyan-500'}
                        />
                      </div>
                      <div className="text-xs text-gray-500">
                        <p className="font-medium text-gray-700">{student.quizPassed ? 'Quiz passed' : 'Quiz pending'}</p>
                        <p>Score {student.quizScore}%</p>
                        <p>{student.quizAttempts} attempt{student.quizAttempts === 1 ? '' : 's'}</p>
                      </div>
                      <div className="text-xs text-gray-500">
                        <p className="font-medium text-gray-700">{formatRelativeTime(student.lastWatchedAt)}</p>
                        <p>Updated {formatDateTime(student.updatedAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="mb-4">
            <h6 className="text-sm font-semibold text-gray-900">Vimeo video metrics</h6>
            <p className="text-xs text-gray-400">Live values currently available from the connected Vimeo account.</p>
          </div>

          {vimeo?.available ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard label="Plays" value={vimeo.metrics?.plays ?? 0} color="primary" />
                <StatCard label="Likes" value={vimeo.metrics?.likes ?? 0} color="rose" />
                <StatCard label="Comments" value={vimeo.metrics?.comments ?? 0} color="amber" />
                <StatCard label="Versions" value={vimeo.metrics?.versions ?? 0} color="gray" />
                <StatCard label="Text tracks" value={vimeo.metrics?.textTracks ?? 0} color="cyan" />
                <StatCard label="Downloads" value={delivery.downloadableRenditions ?? 0} sub={vimeo.security?.downloadsEnabled ? 'enabled' : 'disabled'} color="blue" />
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500 space-y-1">
                <p><span className="font-medium text-gray-700">Vimeo title:</span> {vimeo.video?.title || 'N/A'}</p>
                <p><span className="font-medium text-gray-700">Privacy:</span> {vimeo.privacy?.view || 'unknown'} / embed {vimeo.privacy?.embed || 'unknown'}</p>
                <p><span className="font-medium text-gray-700">Playable:</span> {vimeo.video?.isPlayable ? 'Yes' : 'No'}</p>
                <p><span className="font-medium text-gray-700">Playback delivery:</span> {delivery.hlsAvailable ? 'HLS' : 'No HLS'} / {delivery.dashAvailable ? 'DASH' : 'No DASH'} / {delivery.progressiveRenditions ?? 0} progressive renditions</p>
                <p><span className="font-medium text-gray-700">Transcode:</span> {delivery.transcodeStatus || 'unknown'} / playback {delivery.playbackStatus || 'unknown'}</p>
                <p><span className="font-medium text-gray-700">Captions & transcript:</span> {delivery.captionsEnabled ? 'captions on' : 'no captions'} / {delivery.transcriptEnabled ? 'transcript on' : 'no transcript'}</p>
                <p><span className="font-medium text-gray-700">Language:</span> {delivery.language || 'N/A'}</p>
                <p><span className="font-medium text-gray-700">Review page:</span> {delivery.reviewPageActive ? 'active' : 'off'}</p>
                <p><span className="font-medium text-gray-700">Last modified:</span> {formatDateTime(vimeo.video?.modifiedAt)}</p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500 space-y-1">
                <p className="font-medium text-gray-700">Vimeo plan capabilities</p>
                <p>Paid plan controls: {capabilities.isPaidPlan ? 'enabled' : 'not detected'}</p>
                <p>Hide from Vimeo: {capabilities.supportsHideFromVimeo ? 'supported' : 'not supported'}</p>
                <p>Domain-level embed privacy: {capabilities.supportsDomainLevelPrivacy ? 'supported' : 'not supported'}</p>
                <p>Player button hiding: {capabilities.supportsPlayerButtonHiding ? 'supported' : 'not supported'}</p>
                <p>Analytics API access: {capabilities.analyticsApiAccess ? 'enterprise enabled' : 'not enabled on this Vimeo account'}</p>
              </div>

              {vimeo.security?.warnings?.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  <p className="font-medium mb-1">Vimeo security attention needed</p>
                  <ul className="space-y-1 list-disc pl-4">
                    {vimeo.security.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!vimeo.advancedAnalyticsAvailable && vimeo.note ? (
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-700">
                  <p className="font-medium mb-1">Advanced Vimeo analytics limitation</p>
                  <p>{vimeo.note}</p>
                  {vimeo.unsupportedAdvancedMetrics?.length > 0 ? (
                    <p className="mt-2">
                      Missing via public API on this account: {vimeo.unsupportedAdvancedMetrics.join(', ')}.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              {vimeo?.note || 'Assign a Vimeo video to start showing live Vimeo metrics here.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminCourses() {
  const { showSuccess, showError, addNotification } = useUIStore();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedInstructor, setExpandedInstructor] = useState(null);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [expandedLesson, setExpandedLesson] = useState(null);
  const [videoInputs, setVideoInputs] = useState({});
  const [assigningVideo, setAssigningVideo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [lessonAnalyticsById, setLessonAnalyticsById] = useState({});
  const [lessonAnalyticsLoadingById, setLessonAnalyticsLoadingById] = useState({});
  const [lessonAnalyticsErrorsById, setLessonAnalyticsErrorsById] = useState({});

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    try {
      const response = await analyticsAPI.getAdminCoursesByInstructor();
      setData(response.data);
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const fetchLessonAnalytics = useCallback(async (lessonId, { silent = false } = {}) => {
    if (!lessonId) {
      return;
    }

    if (!silent) {
      setLessonAnalyticsLoadingById((prev) => ({ ...prev, [lessonId]: true }));
    }

    setLessonAnalyticsErrorsById((prev) => ({ ...prev, [lessonId]: null }));

    try {
      const response = await analyticsAPI.getLessonAnalytics(lessonId);
      setLessonAnalyticsById((prev) => ({ ...prev, [lessonId]: response.data }));
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to load lesson analytics';
      setLessonAnalyticsErrorsById((prev) => ({ ...prev, [lessonId]: message }));
    } finally {
      setLessonAnalyticsLoadingById((prev) => ({ ...prev, [lessonId]: false }));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(() => {
      fetchData({ silent: true });
    }, DASHBOARD_REFRESH_MS);

    return () => clearInterval(intervalId);
  }, [fetchData]);

  useEffect(() => {
    if (!expandedLesson) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      fetchLessonAnalytics(expandedLesson, { silent: true });
    }, LESSON_ANALYTICS_REFRESH_MS);

    return () => clearInterval(intervalId);
  }, [expandedLesson, fetchLessonAnalytics]);

  const handleAssignVideo = async (lessonId) => {
    const vimeoVideoId = videoInputs[lessonId];
    if (!vimeoVideoId?.trim()) {
      showError('Please enter a Vimeo Video ID');
      return;
    }

    setAssigningVideo(lessonId);
    try {
      const response = await videoAPI.assign(lessonId, vimeoVideoId.trim());
      showSuccess('Video assigned to content');
      const warnings = response.data?.videoSecurity?.warnings || [];
      if (warnings.length > 0) {
        addNotification({
          type: 'info',
          message: `Vimeo security warning: ${warnings[0]}`,
        });
      }

      setVideoInputs((prev) => ({ ...prev, [lessonId]: '' }));
      await Promise.all([
        fetchData({ silent: true }),
        fetchLessonAnalytics(lessonId, { silent: false }),
      ]);
      setExpandedLesson(lessonId);
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to assign video');
    } finally {
      setAssigningVideo(null);
    }
  };

  const toggleLesson = async (lessonId) => {
    if (expandedLesson === lessonId) {
      setExpandedLesson(null);
      return;
    }

    setExpandedLesson(lessonId);
    await fetchLessonAnalytics(lessonId, { silent: false });
  };

  const filtered = data.filter((item) => (
    !searchTerm
    || item.instructor.name.toLowerCase().includes(searchTerm.toLowerCase())
    || item.instructor.email.toLowerCase().includes(searchTerm.toLowerCase())
    || item.courses.some((course) => course.title.toLowerCase().includes(searchTerm.toLowerCase()))
  ));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Loading chapter analytics..." />
      </div>
    );
  }

  const totalCourses = data.reduce((acc, item) => acc + item.totalCourses, 0);
  const totalStudents = data.reduce((acc, item) => acc + item.totalStudents, 0);
  const totalRevenue = data.reduce((acc, item) => acc + item.totalRevenue, 0);

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Chapter Management</h1>
        <p className="text-gray-500">Chapters organized by creator with live student progress and Vimeo video metrics.</p>
        {lastUpdatedAt ? (
          <p className="text-xs text-gray-400 mt-3">
            Auto-refreshes every 15 seconds • Last updated {lastUpdatedAt.toLocaleTimeString()}
          </p>
        ) : null}
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <motion.div variants={cardVariants}><StatCard label="Total Creators" value={data.length} color="primary" /></motion.div>
        <motion.div variants={cardVariants}><StatCard label="Total Chapters" value={totalCourses} color="blue" /></motion.div>
        <motion.div variants={cardVariants}><StatCard label="Total Members" value={totalStudents} color="green" /></motion.div>
        <motion.div variants={cardVariants}><StatCard label="Est. Revenue" value={`SAR ${totalRevenue.toLocaleString()}`} color="cyan" /></motion.div>
      </motion.div>

      <motion.div variants={fadeInUp} className="mb-6">
        <input
          type="text"
          placeholder="Search by creator name, email, or chapter title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field"
        />
      </motion.div>

      {filtered.length === 0 ? (
        <motion.div variants={fadeInUp} className="card text-center py-12">
          <p className="text-gray-500">{searchTerm ? 'No results match your search.' : 'No creators with chapters yet.'}</p>
        </motion.div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
          {filtered.map((item) => (
            <motion.div key={item.instructor._id} variants={cardVariants} className="card">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedInstructor(expandedInstructor === item.instructor._id ? null : item.instructor._id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-cyan-100 flex items-center justify-center border border-primary-200 text-lg font-bold text-primary-600">
                    {item.instructor.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{item.instructor.name}</h3>
                    <p className="text-sm text-gray-400">{item.instructor.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex items-center gap-3 text-sm text-gray-500">
                    <span>{item.totalCourses} chapter{item.totalCourses !== 1 ? 's' : ''}</span>
                    <span className="text-gray-300">|</span>
                    <span>{item.totalStudents} member{item.totalStudents !== 1 ? 's' : ''}</span>
                    <span className="text-gray-300">|</span>
                    <span>SAR {item.totalRevenue.toLocaleString()}</span>
                  </div>
                  <motion.span
                    animate={{ rotate: expandedInstructor === item.instructor._id ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-gray-400"
                  >
                    ▼
                  </motion.span>
                </div>
              </div>

              <AnimatePresence>
                {expandedInstructor === item.instructor._id ? (
                  <motion.div
                    variants={expandVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="overflow-hidden"
                  >
                    <div className="mt-6 border-t border-gray-100 pt-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        <StatCard label="Chapters" value={item.totalCourses} color="blue" />
                        <StatCard label="Members" value={item.totalStudents} color="green" />
                        <StatCard label="Revenue" value={`SAR ${item.totalRevenue.toLocaleString()}`} color="cyan" />
                        <StatCard label="Joined" value={new Date(item.instructor.joinedAt).toLocaleDateString()} color="gray" />
                      </div>

                      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                        {item.courses.map((course) => (
                          <motion.div key={course._id} variants={cardVariants} className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                            <div
                              className="cursor-pointer p-4"
                              onClick={() => {
                                setExpandedCourse(expandedCourse === course._id ? null : course._id);
                                setExpandedLesson(null);
                              }}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="mb-1 flex items-center gap-2">
                                    <h4 className="font-semibold text-gray-900">{course.title}</h4>
                                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${course.isPublished ? 'border border-green-100 bg-green-50 text-green-600' : 'border border-gray-200 bg-gray-100 text-gray-500'}`}>
                                      {course.isPublished ? 'Published' : 'Draft'}
                                    </span>
                                  </div>
                                  <p className="mb-2 text-xs text-gray-400">
                                    {course.category} · {course.level} · Created {new Date(course.createdAt).toLocaleDateString()}
                                  </p>
                                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    <div className="rounded-lg border border-gray-100 bg-white p-2 text-center">
                                      <p className="text-sm font-bold text-gray-900">{course.enrolledStudents}</p>
                                      <p className="text-xs text-gray-400">Members</p>
                                    </div>
                                    <div className="rounded-lg border border-gray-100 bg-white p-2 text-center">
                                      <p className="text-sm font-bold text-gray-900">{course.avgWatchPercentage}%</p>
                                      <p className="text-xs text-gray-400">Avg Watch</p>
                                    </div>
                                    <div className="rounded-lg border border-gray-100 bg-white p-2 text-center">
                                      <p className="text-sm font-bold text-gray-900">{course.qualifiedViews}</p>
                                      <p className="text-xs text-gray-400">Qualified</p>
                                    </div>
                                    <div className="rounded-lg border border-gray-100 bg-white p-2 text-center">
                                      <p className="text-sm font-bold text-gray-900">SAR {course.estimatedRevenue}</p>
                                      <p className="text-xs text-gray-400">Revenue</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <div className="flex items-center gap-1">
                                    <span className={`rounded-full border px-2 py-0.5 text-xs ${course.videosPending > 0 ? 'border-amber-200 bg-amber-50 text-amber-600' : 'border-green-200 bg-green-50 text-green-600'}`}>
                                      🎬 {course.videosAssigned}/{course.lessonsCount}
                                    </span>
                                  </div>
                                  <motion.span
                                    animate={{ rotate: expandedCourse === course._id ? 180 : 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="text-sm text-gray-400"
                                  >
                                    ▼
                                  </motion.span>
                                </div>
                              </div>
                            </div>

                            <AnimatePresence>
                              {expandedCourse === course._id ? (
                                <motion.div
                                  variants={expandVariants}
                                  initial="hidden"
                                  animate="visible"
                                  exit="exit"
                                  className="overflow-hidden"
                                >
                                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                                    <h5 className="mb-3 text-sm font-semibold text-gray-700">Contents, live progress, and Vimeo assignment</h5>

                                    {course.lessons.length === 0 ? (
                                      <p className="py-4 text-center text-sm text-gray-400">No contents in this chapter yet.</p>
                                    ) : (
                                      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                                        {course.lessons.map((lesson) => (
                                          <motion.div key={lesson._id} variants={cardVariants} className="rounded-lg border border-gray-100 bg-white p-3">
                                            <div
                                              className="cursor-pointer"
                                              onClick={() => toggleLesson(lesson._id)}
                                            >
                                              <div className="mb-3 flex items-center justify-between gap-3">
                                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-semibold text-gray-500">
                                                    {lesson.order}
                                                  </span>
                                                  <span className="truncate text-sm font-medium text-gray-900">{lesson.title}</span>
                                                  {lesson.hasVideo ? (
                                                    <span className="shrink-0 rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-xs text-green-600">
                                                      🎬 {lesson.vimeoVideoId}
                                                    </span>
                                                  ) : (
                                                    <span className="shrink-0 rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                                                      No video
                                                    </span>
                                                  )}
                                                </div>

                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                  <span>Min watch {lesson.minimumWatchPercentage}%</span>
                                                  <motion.span
                                                    animate={{ rotate: expandedLesson === lesson._id ? 180 : 0 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="text-gray-400"
                                                  >
                                                    ▼
                                                  </motion.span>
                                                </div>
                                              </div>

                                              <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                                                <input
                                                  type="text"
                                                  placeholder="Vimeo Video ID (e.g., 123456789)"
                                                  value={videoInputs[lesson._id] || ''}
                                                  onChange={(event) => setVideoInputs((prev) => ({ ...prev, [lesson._id]: event.target.value }))}
                                                  className="input-field flex-1 !py-1.5 text-sm"
                                                />
                                                <button
                                                  onClick={() => handleAssignVideo(lesson._id)}
                                                  disabled={assigningVideo === lesson._id}
                                                  className="btn-primary shrink-0 px-3 py-1.5 text-xs"
                                                >
                                                  {assigningVideo === lesson._id ? '...' : lesson.hasVideo ? 'Update' : 'Assign'}
                                                </button>
                                              </div>
                                            </div>

                                            <AnimatePresence>
                                              {expandedLesson === lesson._id ? (
                                                <motion.div
                                                  variants={expandVariants}
                                                  initial="hidden"
                                                  animate="visible"
                                                  exit="exit"
                                                  className="overflow-hidden"
                                                >
                                                  <div className="mt-4 border-t border-gray-100 pt-4">
                                                    <LessonAnalyticsPanel
                                                      analytics={lessonAnalyticsById[lesson._id]}
                                                      loading={Boolean(lessonAnalyticsLoadingById[lesson._id])}
                                                      error={lessonAnalyticsErrorsById[lesson._id]}
                                                    />
                                                  </div>
                                                </motion.div>
                                              ) : null}
                                            </AnimatePresence>
                                          </motion.div>
                                        ))}
                                      </motion.div>
                                    )}
                                  </div>
                                </motion.div>
                              ) : null}
                            </AnimatePresence>
                          </motion.div>
                        ))}
                      </motion.div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

export default AdminCourses;
