import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { analyticsAPI, videoAPI, coursesAPI, lessonsAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, expandVariants } from '../utils/animations';

const DASHBOARD_REFRESH_MS = 15000;
const LESSON_ANALYTICS_REFRESH_MS = 10000;

const REVIEW_BADGE = {
  published: { label: 'Published', className: 'border border-green-100 bg-green-50 text-green-600' },
  pending_review: { label: 'In Review', className: 'border border-amber-100 bg-amber-50 text-amber-600' },
  draft: { label: 'Draft', className: 'border border-gray-200 bg-gray-100 text-gray-500' },
};

const reviewBadge = (item) => {
  const status = item?.isPublished ? 'published' : (item?.reviewStatus || 'draft');
  return REVIEW_BADGE[status] || REVIEW_BADGE.draft;
};

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

function VimeoPreviewPanel({ preview, loading, error }) {
  if (loading && !preview) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-6 text-sm text-gray-500">
        Loading Vimeo preview...
      </div>
    );
  }

  if (error && !preview) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!preview?.embedUrl) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        Assign or preview a Vimeo video ID to review the lesson video here.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h6 className="text-sm font-semibold text-gray-900">Lesson video review</h6>
          <p className="truncate text-xs text-gray-400">
            {preview.title || 'Untitled Vimeo video'}{preview.vimeoId ? ` • Vimeo ${preview.vimeoId}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          {preview.privacy?.view ? (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1">
              View {preview.privacy.view}
            </span>
          ) : null}
          {preview.privacy?.embed ? (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1">
              Embed {preview.privacy.embed}
            </span>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
        <div className="aspect-video">
          <iframe
            src={preview.embedUrl}
            title={preview.title || 'Vimeo lesson preview'}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; web-share"
            allowFullScreen
            frameBorder="0"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>

      <div className="grid gap-2 text-xs text-gray-500 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <span className="font-medium text-gray-700">Duration:</span> {formatDuration(preview.duration)}
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <span className="font-medium text-gray-700">Playable:</span> {preview.isPlayable ? 'Yes' : 'No'}
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <span className="font-medium text-gray-700">Direct page:</span> {preview.security?.isDirectPageProtected ? 'Protected' : 'Open'}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {error}
        </div>
      ) : null}
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

function formatDuration(seconds) {
  const totalSeconds = Number(seconds || 0);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return 'N/A';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, remainingSeconds]
      .map((part) => String(part).padStart(2, '0'))
      .join(':');
  }

  return [minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function formatMetricName(value) {
  if (!value) {
    return 'N/A';
  }

  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
  const resolution = vimeo?.video?.width && vimeo?.video?.height
    ? `${vimeo.video.width} x ${vimeo.video.height}`
    : 'N/A';

  return (
    <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h6 className="text-sm font-semibold text-gray-900">Live lesson analytics</h6>
          <p className="text-xs text-gray-400">
            Aiqda watch progress refreshes every 10 seconds. Vimeo API metadata refreshes about every minute. Last updated {formatDateTime(refreshedAt)}.
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Enrolled" value={appAnalytics.totalEnrolledStudents} color="blue" />
        <StatCard label="Started" value={appAnalytics.studentsWithActivity} sub={`${appAnalytics.studentsNotStarted} not started`} color="primary" />
        <StatCard label="Active now" value={appAnalytics.activeStudentsNow} sub={`last ${appAnalytics.activeWindowMinutes} min`} color="green" />
        <StatCard label="Avg watch" value={`${appAnalytics.averageWatchPercentage}%`} color="cyan" />
        <StatCard label="Watch met" value={appAnalytics.watchRequirementMetCount} sub={`${appAnalytics.watchRequirementMetRate}% of enrolled`} color="amber" />
        <StatCard label="Qualified" value={appAnalytics.qualifiedCount} sub={`${appAnalytics.qualificationRate}% of enrolled`} color="rose" />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.95fr)]">
        <div className="min-w-0 rounded-xl border border-gray-100 bg-white p-4">
          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h6 className="text-sm font-semibold text-gray-900">Member watch progress</h6>
              <p className="text-xs text-gray-400">Live Aiqda progress updates from this development player.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-gray-400">
              <span>Quiz pass rate {appAnalytics.quizPassRate}%</span>
              <span>Completion rate {appAnalytics.completionRate}%</span>
            </div>
          </div>

          {studentProgress.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              No member activity has been recorded for this lesson yet.
            </div>
          ) : (
            <div className="space-y-3">
              {studentProgress.map((student) => (
                <div key={student.progressId} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="grid gap-4 xl:grid-cols-[minmax(180px,0.9fr)_minmax(220px,1.1fr)_minmax(150px,0.9fr)_minmax(160px,0.9fr)] xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-start gap-2">
                        <p className="text-base font-semibold leading-tight text-gray-900 break-words">{student.name}</p>
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
                      <p className="mt-1 break-all text-xs text-gray-400">{student.email || 'No email available'}</p>
                    </div>

                    <div className="min-w-0">
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">Watch progress</span>
                        <span>{student.watchPercentage}%</span>
                      </div>
                      <ProgressBar
                        value={student.watchPercentage}
                        fillClass={student.hasMetWatchRequirement ? 'from-emerald-400 to-emerald-500' : 'from-primary-500 to-cyan-500'}
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                        <span className={`rounded-full border px-2 py-0.5 ${student.hasMetWatchRequirement ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                          {student.hasMetWatchRequirement ? 'Watch requirement met' : 'Below watch target'}
                        </span>
                        <span>Minimum {lesson.minimumWatchPercentage}%</span>
                      </div>
                    </div>

                    <div className="min-w-0 text-xs text-gray-500">
                      <p className="font-medium text-gray-700">{student.quizPassed ? 'Quiz passed' : 'Quiz pending'}</p>
                      <p className="mt-1">Score {student.quizScore}%</p>
                      <p>{student.quizAttempts} attempt{student.quizAttempts === 1 ? '' : 's'}</p>
                    </div>

                    <div className="min-w-0 text-xs text-gray-500">
                      <p className="font-medium text-gray-700">{formatRelativeTime(student.lastWatchedAt)}</p>
                      <p className="mt-1 break-words">Updated {formatDateTime(student.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-gray-100 bg-white p-4">
          <div className="mb-4">
            <h6 className="text-sm font-semibold text-gray-900">Vimeo video metrics</h6>
            <p className="text-xs text-gray-400">Core audience, playback, and security values currently available from the connected Vimeo account.</p>
          </div>

          {vimeo?.available ? (
            <div className="min-w-0 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Plays" value={vimeo.metrics?.plays ?? 0} color="primary" />
                <StatCard label="Likes" value={vimeo.metrics?.likes ?? 0} color="rose" />
                <StatCard label="Comments" value={vimeo.metrics?.comments ?? 0} color="amber" />
                <StatCard label="Versions" value={vimeo.metrics?.versions ?? 0} color="gray" />
                <StatCard label="Text tracks" value={vimeo.metrics?.textTracks ?? 0} color="cyan" />
                <StatCard label="Downloads" value={delivery.downloadableRenditions ?? 0} sub={vimeo.security?.downloadsEnabled ? 'enabled' : 'disabled'} color="blue" />
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
                  <p className="mb-2 font-medium text-gray-700">Playback and asset health</p>
                  <div className="space-y-1 break-words">
                    <p><span className="font-medium text-gray-700">Title:</span> {vimeo.video?.title || 'N/A'}</p>
                    <p><span className="font-medium text-gray-700">Duration:</span> {formatDuration(vimeo.video?.duration)}</p>
                    <p><span className="font-medium text-gray-700">Resolution:</span> {resolution}</p>
                    <p><span className="font-medium text-gray-700">Playable:</span> {vimeo.video?.isPlayable ? 'Yes' : 'No'}</p>
                    <p><span className="font-medium text-gray-700">Audio track:</span> {vimeo.video?.hasAudio ? 'present' : 'not detected'}</p>
                    <p><span className="font-medium text-gray-700">Playback delivery:</span> {delivery.hlsAvailable ? 'HLS' : 'No HLS'} / {delivery.dashAvailable ? 'DASH' : 'No DASH'} / {delivery.progressiveRenditions ?? 0} progressive renditions</p>
                    <p><span className="font-medium text-gray-700">Transcode:</span> {delivery.transcodeStatus || 'unknown'} / playback {delivery.playbackStatus || 'unknown'}</p>
                    <p><span className="font-medium text-gray-700">Captions & transcript:</span> {delivery.captionsEnabled ? 'captions on' : 'no captions'} / {delivery.transcriptEnabled ? 'transcript on' : 'no transcript'}</p>
                    <p><span className="font-medium text-gray-700">Language:</span> {delivery.language || 'N/A'}</p>
                    <p><span className="font-medium text-gray-700">Folder:</span> {delivery.folderName || 'N/A'}</p>
                  </div>
                </div>

                <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
                  <p className="mb-2 font-medium text-gray-700">Privacy and publishing state</p>
                  <div className="space-y-1 break-words">
                    <p><span className="font-medium text-gray-700">Privacy:</span> {vimeo.privacy?.view || 'unknown'} / embed {vimeo.privacy?.embed || 'unknown'}</p>
                    <p><span className="font-medium text-gray-700">Review page:</span> {delivery.reviewPageActive ? 'active' : 'off'} / {delivery.reviewPageShareable ? 'shareable' : 'not shareable'}</p>
                    <p><span className="font-medium text-gray-700">Whitelisted domains:</span> {vimeo.security?.whitelistedDomains?.length ? vimeo.security.whitelistedDomains.join(', ') : 'none reported'}</p>
                    <p><span className="font-medium text-gray-700">Created:</span> {formatDateTime(vimeo.video?.createdAt)}</p>
                    <p><span className="font-medium text-gray-700">Last modified:</span> {formatDateTime(vimeo.video?.modifiedAt)}</p>
                    <p><span className="font-medium text-gray-700">Last owner action:</span> {formatDateTime(vimeo.video?.lastUserActionAt)}</p>
                    <p><span className="font-medium text-gray-700">Vimeo status:</span> {vimeo.video?.status || 'unknown'}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <div className="min-w-0 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-800">
                  <p className="mb-2 font-medium text-cyan-900">Vimeo analytics access</p>
                  <div className="space-y-2 break-words">
                    <p>{vimeo.note || 'Aiqda is ingesting the full Vimeo analytics dataset available to this account through the official API.'}</p>
                    <div>
                      <p className="font-medium text-cyan-900">Live in Aiqda now</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {['plays', 'likes', 'comments', 'text_tracks', 'versions', 'playback_status', 'privacy', 'delivery'].map((metric) => (
                          <span key={metric} className="rounded-full border border-cyan-300 bg-white/80 px-2 py-1 text-[11px] text-cyan-800">
                            {formatMetricName(metric)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {vimeo.dashboardAnalyticsAvailable ? (
                      <div>
                        <p className="font-medium text-cyan-900">Visible in Vimeo dashboard</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {vimeo.dashboardOnlyMetrics?.map((metric) => (
                            <span key={metric} className="rounded-full border border-cyan-300 bg-white/80 px-2 py-1 text-[11px] text-cyan-800">
                              {formatMetricName(metric)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {vimeo.unsupportedAdvancedMetrics?.length > 0 ? (
                      <div>
                        <p className="font-medium text-cyan-900">Enterprise Analytics API only</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {vimeo.unsupportedAdvancedMetrics.map((metric) => (
                            <span key={metric} className="rounded-full border border-cyan-300 bg-white/80 px-2 py-1 text-[11px] text-cyan-800">
                              {formatMetricName(metric)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
                  <p className="mb-2 font-medium text-gray-700">Vimeo plan capabilities</p>
                  <div className="space-y-1 break-words">
                    <p>Paid plan controls: {capabilities.isPaidPlan ? 'enabled' : 'not detected'}</p>
                    <p>Hide from Vimeo: {capabilities.supportsHideFromVimeo ? 'supported' : 'not supported'}</p>
                    <p>Domain-level embed privacy: {capabilities.supportsDomainLevelPrivacy ? 'supported' : 'not supported'}</p>
                    <p>Player button hiding: {capabilities.supportsPlayerButtonHiding ? 'supported' : 'not supported'}</p>
                    <p>Dashboard analytics: {vimeo.dashboardAnalyticsAvailable ? 'available in Vimeo' : 'not reported on this account'}</p>
                    <p>Analytics API access: {capabilities.analyticsApiAccess ? 'enterprise enabled' : 'not enabled on this Vimeo account'}</p>
                  </div>
                </div>
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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [videoPreviewByLesson, setVideoPreviewByLesson] = useState({});
  const [videoPreviewLoadingByLesson, setVideoPreviewLoadingByLesson] = useState({});
  const [videoPreviewErrorsByLesson, setVideoPreviewErrorsByLesson] = useState({});

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

  const handlePublishCourse = useCallback(async (courseId, isPublished) => {
    try {
      await coursesAPI.setPublish(courseId, isPublished);
      showSuccess(isPublished ? 'Chapter published' : 'Chapter returned to draft');
      fetchData({ silent: true });
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to update chapter');
    }
  }, [fetchData, showSuccess, showError]);

  const handlePublishLesson = useCallback(async (lessonId, isPublished) => {
    try {
      await lessonsAPI.setPublish(lessonId, isPublished);
      showSuccess(isPublished ? 'Content published' : 'Content returned to draft');
      fetchData({ silent: true });
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to update content');
    }
  }, [fetchData, showSuccess, showError]);

  // Deletion is restricted to draft items (enforced on the backend too).
  const handleDeleteCourse = useCallback(async (courseId) => {
    if (!confirm('Delete this draft chapter and all its content? This cannot be undone.')) return;
    try {
      await coursesAPI.delete(courseId);
      showSuccess('Chapter deleted');
      fetchData({ silent: true });
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete chapter');
    }
  }, [fetchData, showSuccess, showError]);

  const handleDeleteLesson = useCallback(async (lessonId) => {
    if (!confirm('Delete this draft content? This cannot be undone.')) return;
    try {
      await lessonsAPI.delete(lessonId);
      showSuccess('Content deleted');
      fetchData({ silent: true });
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete content');
    }
  }, [fetchData, showSuccess, showError]);

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

  const fetchLessonPreview = useCallback(async (lessonId, vimeoVideoId) => {
    if (!lessonId || !vimeoVideoId?.trim()) {
      setVideoPreviewByLesson((prev) => ({ ...prev, [lessonId]: null }));
      setVideoPreviewErrorsByLesson((prev) => ({ ...prev, [lessonId]: null }));
      return;
    }

    setVideoPreviewLoadingByLesson((prev) => ({ ...prev, [lessonId]: true }));
    setVideoPreviewErrorsByLesson((prev) => ({ ...prev, [lessonId]: null }));

    try {
      const response = await videoAPI.getDetails(vimeoVideoId.trim());
      setVideoPreviewByLesson((prev) => ({
        ...prev,
        [lessonId]: response.data,
      }));
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to load Vimeo preview';
      setVideoPreviewErrorsByLesson((prev) => ({ ...prev, [lessonId]: message }));
    } finally {
      setVideoPreviewLoadingByLesson((prev) => ({ ...prev, [lessonId]: false }));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(() => {
      fetchData({ silent: true });
    }, DASHBOARD_REFRESH_MS);

    return () => clearInterval(intervalId);
  }, [fetchData]);

  // Deep-link from a notification: ?instructorId=&courseId= expands the target
  // creator + chapter and scrolls to it, then clears the params so refreshes/
  // polling don't keep re-triggering it.
  useEffect(() => {
    const courseId = searchParams.get('courseId');
    if (!courseId || data.length === 0) {
      return;
    }
    const instructorId = searchParams.get('instructorId');
    const group = data.find((item) => (
      instructorId
        ? String(item.instructor._id) === instructorId
        : item.courses.some((course) => String(course._id) === courseId)
    ));
    if (!group) {
      return;
    }
    setExpandedInstructor(group.instructor._id);
    setExpandedCourse(courseId);
    setSearchParams({}, { replace: true });
    requestAnimationFrame(() => {
      document.getElementById(`admin-course-${courseId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [data, searchParams, setSearchParams]);

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
      if (response.data?.videoDetails) {
        setVideoPreviewByLesson((prev) => ({
          ...prev,
          [lessonId]: response.data.videoDetails,
        }));
        setVideoPreviewErrorsByLesson((prev) => ({ ...prev, [lessonId]: null }));
      }
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

  const handlePreviewVideo = async (lessonId, fallbackVideoId = '') => {
    const requestedVideoId = (videoInputs[lessonId] || fallbackVideoId || '').trim();
    if (!requestedVideoId) {
      showError('Enter a Vimeo Video ID to preview');
      return;
    }

    await fetchLessonPreview(lessonId, requestedVideoId);
  };

  const toggleLesson = async (lesson) => {
    const lessonId = lesson._id;

    if (expandedLesson === lessonId) {
      setExpandedLesson(null);
      return;
    }

    setExpandedLesson(lessonId);
    await Promise.all([
      fetchLessonAnalytics(lessonId, { silent: false }),
      lesson.vimeoVideoId ? fetchLessonPreview(lessonId, lesson.vimeoVideoId) : Promise.resolve(),
    ]);
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
        <p className="text-gray-500">Chapters organized by creator with live member progress and Vimeo video metrics.</p>
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
                          <motion.div key={course._id} id={`admin-course-${course._id}`} variants={cardVariants} className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
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
                                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-500">CH-{String(course.order || 0).padStart(2, '0')}</span>
                                    <h4 className="font-semibold text-gray-900">{course.title}</h4>
                                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${reviewBadge(course).className}`}>
                                      {reviewBadge(course).label}
                                    </span>
                                    {course.isPublished ? (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handlePublishCourse(course._id, false); }}
                                        className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
                                      >
                                        Unpublish
                                      </button>
                                    ) : (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handlePublishCourse(course._id, true); }}
                                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                                          course.reviewStatus === 'pending_review'
                                            ? 'border-primary-200 bg-primary-50 text-primary-600'
                                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                        }`}
                                      >
                                        {course.reviewStatus === 'pending_review' ? 'Approve & Publish' : 'Publish'}
                                      </button>
                                    )}
                                    {!course.isPublished && course.reviewStatus === 'draft' && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course._id); }}
                                        className="rounded-full border border-red-200 px-2 py-0.5 text-xs font-medium text-red-500 hover:bg-red-50"
                                        title="Delete draft chapter"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                  <p className="mb-2 text-xs text-gray-400">
                                    {course.category} · {course.level} · Created {new Date(course.createdAt).toLocaleDateString()}
                                  </p>
                                  {(course.software || []).length > 0 && (
                                    <div className="mb-2 flex flex-wrap gap-1.5">
                                      {course.software.map((tag) => (
                                        <span key={tag} className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                                          🛠 {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
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
                                              onClick={() => toggleLesson(lesson)}
                                            >
                                              <div className="mb-3 flex items-center justify-between gap-3">
                                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-semibold text-gray-500">
                                                    {lesson.order}
                                                  </span>
                                                  <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-500">CH-{String(course.order || 0).padStart(2, '0')}-L-{String(lesson.order || 0).padStart(2, '0')}</span>
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
                                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${reviewBadge(lesson).className}`}>
                                                    {reviewBadge(lesson).label}
                                                  </span>
                                                </div>

                                                <div className="flex items-center gap-2 text-xs text-gray-400" onClick={(event) => event.stopPropagation()}>
                                                  {lesson.isPublished ? (
                                                    <button
                                                      onClick={() => handlePublishLesson(lesson._id, false)}
                                                      className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
                                                    >
                                                      Unpublish
                                                    </button>
                                                  ) : (
                                                    <button
                                                      onClick={() => handlePublishLesson(lesson._id, true)}
                                                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                                                        lesson.reviewStatus === 'pending_review'
                                                          ? 'border-primary-200 bg-primary-50 text-primary-600'
                                                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                                      }`}
                                                    >
                                                      {lesson.reviewStatus === 'pending_review' ? 'Approve' : 'Publish'}
                                                    </button>
                                                  )}
                                                  {!lesson.isPublished && lesson.reviewStatus === 'draft' && (
                                                    <button
                                                      onClick={() => handleDeleteLesson(lesson._id)}
                                                      className="rounded-full border border-red-200 px-2 py-0.5 text-xs font-medium text-red-500 hover:bg-red-50"
                                                      title="Delete draft content"
                                                    >
                                                      Delete
                                                    </button>
                                                  )}
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

                                              <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                                                <input
                                                  type="text"
                                                  placeholder="Vimeo Video ID (e.g., 123456789)"
                                                  value={videoInputs[lesson._id] || ''}
                                                  onChange={(event) => setVideoInputs((prev) => ({ ...prev, [lesson._id]: event.target.value }))}
                                                  className="input-field flex-1 !py-1.5 text-sm"
                                                />
                                                <button
                                                  onClick={() => handlePreviewVideo(lesson._id, lesson.vimeoVideoId)}
                                                  className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
                                                >
                                                  Review
                                                </button>
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
                                                    <div className="mb-4">
                                                      <VimeoPreviewPanel
                                                        preview={videoPreviewByLesson[lesson._id]}
                                                        loading={Boolean(videoPreviewLoadingByLesson[lesson._id])}
                                                        error={videoPreviewErrorsByLesson[lesson._id]}
                                                      />
                                                    </div>
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
