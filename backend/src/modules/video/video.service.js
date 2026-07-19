import 'dotenv/config';
import Lesson from '../lessons/lesson.model.js';
import Course from '../courses/course.model.js';
import { getSubscriptionAccessContext } from '../subscriptions/subscriptions.service.js';

const VIMEO_API_BASE = 'https://api.vimeo.com';
const VIMEO_VIDEO_DETAILS_CACHE_TTL_MS = 60 * 1000;
const VIMEO_ACCOUNT_INFO_CACHE_TTL_MS = 5 * 60 * 1000;
const LOCAL_EMBED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const PLAYER_HARDENING_PARAMS = {
  title: '0',
  byline: '0',
  portrait: '0',
  badge: '0',
  dnt: '1',
  fullscreen: '0',
};
const vimeoVideoDetailsCache = new Map();
let vimeoAccountInfoCache = null;
const getVimeoAccessToken = () => process.env.VIMEO_ACCESS_TOKEN;

const VIMEO_SECURITY_PRESET = {
  privacy: {
    view: 'disable',
    download: false,
    add: false,
    comments: 'nobody',
  },
  embed: {
    buttons: {
      share: false,
      like: false,
      watchlater: false,
      embed: false,
    },
    title: {
      name: 'hide',
      owner: 'hide',
      portrait: 'hide',
    },
  },
};

const ensureStudentSubscriptionAccess = async (course, userId) => {
  const courseId = course?._id?.toString?.() || course?.toString?.();
  const subscriptionAccess = await getSubscriptionAccessContext(userId, courseId);

  if (!subscriptionAccess.hasActiveSubscription) {
    throw new Error('You need an active subscription to access this chapter');
  }

  if (!subscriptionAccess.hasCourseAccess) {
    throw new Error('Your current subscription does not include access to this chapter');
  }
};

const vimeoFetch = async (path, options = {}) => {
  const vimeoAccessToken = getVimeoAccessToken();
  if (!vimeoAccessToken) {
    throw new Error('Vimeo API not configured. Please set VIMEO_ACCESS_TOKEN.');
  }
  const response = await fetch(`${VIMEO_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${vimeoAccessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.vimeo.*+json;version=3.4',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.developer_message || errorData.error || `Vimeo API error: ${response.status}`);
  }
  return response.json();
};

const extractIframeSrc = (embedHtml) => {
  if (typeof embedHtml !== 'string') {
    return null;
  }

  const match = embedHtml.match(/src="([^"]+)"/i);
  if (!match?.[1]) {
    return null;
  }

  return match[1].replaceAll('&amp;', '&');
};

const buildPlayerEmbedUrl = (vimeoVideoId, playerUrl, embedHtml) => {
  const iframeSrc = extractIframeSrc(embedHtml);
  const fallback = `https://player.vimeo.com/video/${vimeoVideoId}`;
  const baseUrl = iframeSrc || playerUrl || fallback;

  try {
    const finalUrl = new URL(baseUrl);

    for (const sourceUrl of [playerUrl, iframeSrc]) {
      if (!sourceUrl) {
        continue;
      }

      const parsedSourceUrl = new URL(sourceUrl);
      for (const [key, value] of parsedSourceUrl.searchParams.entries()) {
        if (!finalUrl.searchParams.has(key)) {
          finalUrl.searchParams.set(key, value);
        }
      }
    }

    for (const [key, value] of Object.entries(PLAYER_HARDENING_PARAMS)) {
      finalUrl.searchParams.set(key, value);
    }

    return finalUrl.toString();
  } catch {
    return baseUrl;
  }
};

const getCachedVimeoVideoDetails = (vimeoVideoId) => {
  const cached = vimeoVideoDetailsCache.get(vimeoVideoId);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    vimeoVideoDetailsCache.delete(vimeoVideoId);
    return null;
  }

  return cached.value;
};

const setCachedVimeoVideoDetails = (vimeoVideoId, details) => {
  vimeoVideoDetailsCache.set(vimeoVideoId, {
    value: details,
    expiresAt: Date.now() + VIMEO_VIDEO_DETAILS_CACHE_TTL_MS,
  });
};

const getCachedVimeoAccountInfo = () => {
  if (!vimeoAccountInfoCache) {
    return null;
  }

  if (vimeoAccountInfoCache.expiresAt <= Date.now()) {
    vimeoAccountInfoCache = null;
    return null;
  }

  return vimeoAccountInfoCache.value;
};

const setCachedVimeoAccountInfo = (accountInfo) => {
  vimeoAccountInfoCache = {
    value: accountInfo,
    expiresAt: Date.now() + VIMEO_ACCOUNT_INFO_CACHE_TTL_MS,
  };
};

const normalizeAccountType = (accountType) => (
  typeof accountType === 'string' ? accountType.trim().toLowerCase() : null
);

export const getVimeoAccountCapabilities = (accountType) => {
  const normalizedType = normalizeAccountType(accountType);
  const isEnterprise = normalizedType === 'enterprise';
  const isPaidPlan = Boolean(normalizedType) && !['basic', 'free'].includes(normalizedType);

  return {
    planTier: normalizedType,
    isPaidPlan,
    supportsHideFromVimeo: isPaidPlan || isEnterprise,
    supportsDomainLevelPrivacy: true,
    supportsPlayerCustomization: isPaidPlan || isEnterprise,
    supportsPlayerButtonHiding: isPaidPlan || isEnterprise,
    supportsVideoPageAnalyticsDashboard: isPaidPlan || isEnterprise,
    analyticsApiAccess: isEnterprise,
    enterpriseAnalyticsRequiredMetrics: [
      'impressions',
      'finishes',
      'downloads',
      'unique_viewers',
      'unique_impressions',
      'average_percent_watched',
      'average_time_watched',
      'total_time_watched',
    ],
  };
};

const buildVimeoMetricsSummary = (data = {}) => ({
  plays: Number(data.stats?.plays || 0),
  likes: Number(data.metadata?.connections?.likes?.total || 0),
  comments: Number(data.metadata?.connections?.comments?.total || 0),
  textTracks: Number(data.metadata?.connections?.texttracks?.total || 0),
  versions: Number(data.metadata?.connections?.versions?.total || 0),
});

const resolveAllowedEmbedDomains = () => {
  const domains = new Set();
  const skippedDomains = [];

  const addDomain = (value, source = 'unknown') => {
    if (!value) {
      return;
    }

    try {
      const candidate = value.includes('://') ? new URL(value).hostname : value.trim();
      if (!candidate) {
        return;
      }

      const normalizedCandidate = candidate.toLowerCase();

      // Vimeo domain-level privacy expects public hostnames, not raw IPs or localhost.
      if (
        /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalizedCandidate)
        || LOCAL_EMBED_HOSTS.has(normalizedCandidate)
        || !normalizedCandidate.includes('.')
      ) {
        skippedDomains.push({
          domain: normalizedCandidate,
          source,
          reason: 'Vimeo domain-level privacy requires a public hostname.',
        });
        return;
      }

      domains.add(normalizedCandidate);
    } catch {
      // Ignore invalid domain inputs instead of blocking assignment.
    }
  };

  addDomain(process.env.FRONTEND_URL, 'FRONTEND_URL');

  for (const entry of (process.env.VIMEO_ALLOWED_EMBED_DOMAINS || '').split(',')) {
    addDomain(entry, 'VIMEO_ALLOWED_EMBED_DOMAINS');
  }

  return {
    domains: [...domains],
    skippedDomains,
  };
};

const getVimeoSecurityWarnings = ({
  privacy = {},
  embed = {},
  failedDomains = [],
  skippedDomains = [],
  requestedDomains = [],
  presetError = null,
} = {}) => {
  const warnings = [];
  const isHideFromVimeo = privacy.view === 'disable';
  const isPrivateToOwner = privacy.view === 'nobody';

  if (isPrivateToOwner) {
    warnings.push('This video is set to Vimeo Private. Only the Vimeo owner and team members can watch it, even when it is embedded. Change the viewing privacy to "Hide from Vimeo" for member playback.');
  } else if (!isHideFromVimeo) {
    warnings.push('Direct Vimeo page access is still enabled. Set the video privacy to "Hide from Vimeo" in Vimeo to stop public link sharing.');
  }

  if (privacy.embed !== 'whitelist') {
    if (requestedDomains.length > 0) {
      warnings.push('Embed privacy is not restricted to specific domains. Limit embeds to your website domains in Vimeo to prevent off-site embedding.');
    } else {
      warnings.push('Embed privacy is not restricted to specific domains. Configure public website domains in FRONTEND_URL or VIMEO_ALLOWED_EMBED_DOMAINS to enable Vimeo domain-level privacy.');
    }
  }

  if (embed.buttons?.share) {
    warnings.push('The Vimeo share button is still enabled.');
  }

  if (embed.buttons?.watchlater) {
    warnings.push('The Vimeo Watch Later button is still enabled.');
  }

  if (embed.buttons?.embed) {
    warnings.push('The Vimeo embed button is still enabled.');
  }

  if (embed.buttons?.like) {
    warnings.push('The Vimeo like button is still enabled.');
  }

  if (privacy.download !== false) {
    warnings.push('Vimeo downloads are still enabled for this video.');
  }

  if (privacy.add !== false) {
    warnings.push('This video can still be added to Vimeo collections/showcases.');
  }

  if (privacy.comments !== 'nobody' && privacy.comments !== 'disable') {
    warnings.push('Viewer comments are still enabled on Vimeo for this video.');
  }

  if (failedDomains.length > 0) {
    warnings.push(`Some Vimeo allowed domains could not be applied: ${failedDomains.map(({ domain }) => domain).join(', ')}`);
  }

  if (skippedDomains.length > 0) {
    warnings.push(`Some configured embed hosts were skipped because Vimeo requires public domains: ${skippedDomains.map(({ domain }) => domain).join(', ')}`);
  }

  if (presetError) {
    warnings.push(`Aiqda could not apply the paid-plan Vimeo security preset automatically: ${presetError}`);
  }

  return warnings;
};

const buildVimeoSecuritySummary = ({
  privacy = {},
  embed = {},
  whitelistedDomains = [],
  failedDomains = [],
  skippedDomains = [],
  presetError = null,
} = {}) => {
  const { domains: requestedDomains, skippedDomains: resolvedSkippedDomains } = resolveAllowedEmbedDomains();
  const allSkippedDomains = [...resolvedSkippedDomains, ...skippedDomains].filter((entry, index, entries) => (
    entries.findIndex((candidate) => (
      candidate.domain === entry.domain
      && candidate.source === entry.source
      && candidate.reason === entry.reason
    )) === index
  ));
  const warnings = getVimeoSecurityWarnings({
    privacy,
    embed,
    failedDomains,
    skippedDomains: allSkippedDomains,
    requestedDomains,
    presetError,
  });
  const isDirectPageProtected = privacy.view === 'disable' || privacy.view === 'nobody';

  return {
    viewPrivacy: privacy.view || null,
    embedPrivacy: privacy.embed || null,
    isDirectPageProtected,
    requiresVimeoTeamMembership: privacy.view === 'nobody',
    usesRecommendedViewPrivacy: privacy.view === 'disable',
    isDomainRestricted: privacy.embed === 'whitelist',
    downloadsEnabled: privacy.download !== false,
    addToCollectionsEnabled: privacy.add !== false,
    commentsPrivacy: privacy.comments || null,
    commentsEnabled: privacy.comments !== 'nobody' && privacy.comments !== 'disable',
    shareButtonEnabled: Boolean(embed.buttons?.share),
    watchLaterEnabled: Boolean(embed.buttons?.watchlater),
    embedButtonEnabled: Boolean(embed.buttons?.embed),
    likeButtonEnabled: Boolean(embed.buttons?.like),
    requestedDomains,
    whitelistedDomains,
    failedDomains,
    skippedDomains: allSkippedDomains,
    warnings,
  };
};

const buildVimeoDeliverySummary = (data = {}) => {
  const progressiveFiles = Array.isArray(data.files)
    ? data.files.filter((file) => file?.quality !== 'hls')
    : [];
  const downloadableFiles = Array.isArray(data.download) ? data.download : [];

  return {
    language: data.language || null,
    transcodeStatus: data.transcode?.status || null,
    playbackStatus: data.play?.status || null,
    hlsAvailable: Boolean(data.play?.hls?.link),
    dashAvailable: Boolean(data.play?.dash?.link),
    progressiveRenditions: progressiveFiles.length,
    downloadableRenditions: downloadableFiles.length,
    captionsEnabled: Boolean(data.embed?.closed_captions),
    transcriptEnabled: Boolean(data.embed?.transcript),
    reviewPageActive: Boolean(data.review_page?.active),
    reviewPageShareable: Boolean(data.review_page?.is_shareable),
    folderName: data.parent_folder?.name || null,
  };
};

const applyVimeoSecurityPreset = async (vimeoVideoId) => {
  try {
    await vimeoFetch(`/videos/${vimeoVideoId}`, {
      method: 'PATCH',
      body: JSON.stringify(VIMEO_SECURITY_PRESET),
    });
    return { ok: true, error: null };
  } catch (error) {
    console.warn(`[Vimeo] Could not apply paid-plan security preset to video ${vimeoVideoId}: ${error.message}`);
    return { ok: false, error: error.message };
  }
};

const syncVimeoEmbedDomainWhitelist = async (vimeoVideoId) => {
  const { domains, skippedDomains } = resolveAllowedEmbedDomains();
  if (domains.length === 0) {
    return {
      appliedDomains: [],
      failedDomains: [],
      skippedDomains,
    };
  }

  try {
    await vimeoFetch(`/videos/${vimeoVideoId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        privacy: {
          embed: 'whitelist',
        },
      }),
    });
  } catch (error) {
    console.warn(`[Vimeo] Could not enable domain-level embed privacy for video ${vimeoVideoId}: ${error.message}`);
    return {
      appliedDomains: [],
      failedDomains: domains.map((domain) => ({ domain, message: error.message })),
      skippedDomains,
    };
  }

  const appliedDomains = [];
  const failedDomains = [];

  for (const domain of domains) {
    const response = await fetch(`${VIMEO_API_BASE}/videos/${vimeoVideoId}/privacy/domains/${encodeURIComponent(domain)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getVimeoAccessToken()}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4',
      },
    });

    if (response.status === 204 || response.ok) {
      appliedDomains.push(domain);
      continue;
    }

    const errorData = await response.json().catch(() => ({}));
    failedDomains.push({
      domain,
      message: errorData.developer_message || errorData.error || `Vimeo API error: ${response.status}`,
    });
  }

  return {
    appliedDomains,
    failedDomains,
    skippedDomains,
  };
};

export const getVimeoVideoDetails = async (vimeoVideoId, options = {}) => {
  const { forceRefresh = false, syncContext = null } = options;
  const cleanId = vimeoVideoId.replace(/[^0-9]/g, '');
  if (!cleanId) throw new Error('Invalid Vimeo Video ID');

  if (!forceRefresh) {
    const cached = getCachedVimeoVideoDetails(cleanId);
    if (cached) {
      return cached;
    }
  }

  const data = await vimeoFetch(`/videos/${cleanId}?fields=uri,name,description,duration,width,height,language,created_time,modified_time,last_user_action_event_date,embed,files,download,play,review_page,transcode,parent_folder,player_embed_url,privacy.view,privacy.embed,privacy.download,privacy.add,privacy.comments,stats,metadata.connections,status,link,is_playable,has_audio`);
  const security = buildVimeoSecuritySummary({
    privacy: data.privacy || {},
    embed: data.embed || {},
    whitelistedDomains: syncContext?.appliedDomains || [],
    failedDomains: syncContext?.failedDomains || [],
    skippedDomains: syncContext?.skippedDomains || [],
    presetError: syncContext?.presetError || null,
  });

  const details = {
    vimeoId: cleanId,
    title: data.name,
    description: data.description,
    duration: data.duration,
    width: data.width,
    height: data.height,
    embedHtml: data.embed?.html,
    playerUrl: data.player_embed_url,
    embedUrl: buildPlayerEmbedUrl(cleanId, data.player_embed_url, data.embed?.html),
    thumbnail: data.pictures?.sizes?.find(s => s.width >= 640)?.link || data.pictures?.sizes?.[0]?.link,
    createdAt: data.created_time || null,
    modifiedAt: data.modified_time || null,
    lastUserActionAt: data.last_user_action_event_date || null,
    isPlayable: typeof data.is_playable === 'boolean' ? data.is_playable : null,
    hasAudio: typeof data.has_audio === 'boolean' ? data.has_audio : null,
    privacy: {
      view: data.privacy?.view || null,
      embed: data.privacy?.embed || null,
      download: data.privacy?.download ?? null,
      add: data.privacy?.add ?? null,
      comments: data.privacy?.comments || null,
    },
    metrics: buildVimeoMetricsSummary(data),
    delivery: buildVimeoDeliverySummary(data),
    embed: data.embed || null,
    status: data.status,
    link: data.link,
    security,
  };

  setCachedVimeoVideoDetails(cleanId, details);
  return details;
};

export const getVimeoVideos = async (page = 1, perPage = 25, query = '') => {
  let path = `/me/videos?page=${page}&per_page=${perPage}&fields=uri,name,description,duration,pictures.sizes,privacy.view,privacy.embed,stats,metadata.connections,status,link,created_time,modified_time`;
  if (query) path += `&query=${encodeURIComponent(query)}`;

  const data = await vimeoFetch(path);
  return {
    videos: (data.data || []).map(v => ({
      vimeoId: v.uri?.split('/').pop(),
      title: v.name,
      description: v.description,
      duration: v.duration,
      thumbnail: v.pictures?.sizes?.find(s => s.width >= 640)?.link || v.pictures?.sizes?.[0]?.link,
      privacy: {
        view: v.privacy?.view || null,
        embed: v.privacy?.embed || null,
      },
      metrics: buildVimeoMetricsSummary(v),
      status: v.status,
      link: v.link,
      createdAt: v.created_time,
      modifiedAt: v.modified_time,
      security: buildVimeoSecuritySummary(v),
    })),
    total: data.total,
    page: data.page,
    perPage: data.per_page,
    totalPages: Math.ceil((data.total || 0) / perPage),
  };
};

// Verifies a Vimeo video exists, applies the same paid-plan security preset and
// embed-domain whitelist used for lesson videos, and returns the id + embed URL.
// Used for creator teaser videos (no watermark applied at playback).
export const prepareVimeoVideoForEmbed = async (vimeoVideoId) => {
  const cleanId = String(vimeoVideoId || '').replace(/[^0-9]/g, '');
  if (!cleanId) throw new Error('Invalid Vimeo Video ID');

  let videoDetails = null;
  if (getVimeoAccessToken()) {
    try {
      videoDetails = await getVimeoVideoDetails(cleanId, { forceRefresh: true });
    } catch (err) {
      throw new Error(`Could not verify video on Vimeo: ${err.message}`);
    }
    vimeoVideoDetailsCache.delete(cleanId);
    await applyVimeoSecurityPreset(cleanId);
    await syncVimeoEmbedDomainWhitelist(cleanId);
    vimeoVideoDetailsCache.delete(cleanId);
  }

  return {
    vimeoVideoId: cleanId,
    vimeoEmbedUrl: videoDetails?.embedUrl || buildPlayerEmbedUrl(cleanId),
  };
};

export const assignVideoToLesson = async (lessonId, vimeoVideoId) => {
  const cleanId = vimeoVideoId.replace(/[^0-9]/g, '');
  if (!cleanId) throw new Error('Invalid Vimeo Video ID');

  let videoDetails = null;
  if (getVimeoAccessToken()) {
    try {
      videoDetails = await getVimeoVideoDetails(cleanId, { forceRefresh: true });
    } catch (err) {
      throw new Error(`Could not verify video on Vimeo: ${err.message}`);
    }
  }

  if (videoDetails) {
    vimeoVideoDetailsCache.delete(cleanId);
    await applyVimeoSecurityPreset(cleanId);
  }

  const domainWhitelistResult = getVimeoAccessToken()
    ? await syncVimeoEmbedDomainWhitelist(cleanId)
    : { appliedDomains: [], failedDomains: [], skippedDomains: [] };

  const lesson = await Lesson.findByIdAndUpdate(
    lessonId,
    {
      vimeoVideoId: cleanId,
      vimeoEmbedUrl: videoDetails?.embedUrl || buildPlayerEmbedUrl(cleanId),
    },
    { new: true }
  );

  if (!lesson) throw new Error('Lesson not found');

  vimeoVideoDetailsCache.delete(cleanId);
  const refreshedVideoDetails = videoDetails
    ? await getVimeoVideoDetails(cleanId, {
        forceRefresh: true,
        syncContext: domainWhitelistResult,
      })
    : null;

  if (refreshedVideoDetails?.embedUrl && lesson.vimeoEmbedUrl !== refreshedVideoDetails.embedUrl) {
    lesson.vimeoEmbedUrl = refreshedVideoDetails.embedUrl;
    await lesson.save();
  }

  return {
    lesson,
    videoSecurity: refreshedVideoDetails?.security || null,
    videoDetails: refreshedVideoDetails,
  };
};

const syncLessonSecurityFromDocument = async (lesson) => {
  if (!lesson?.vimeoVideoId) {
    throw new Error('No Vimeo video is assigned to this lesson');
  }

  const cleanId = lesson.vimeoVideoId.replace(/[^0-9]/g, '');
  if (!cleanId) {
    throw new Error('Invalid Vimeo Video ID');
  }

  const presetResult = await applyVimeoSecurityPreset(cleanId);
  const domainWhitelistResult = await syncVimeoEmbedDomainWhitelist(cleanId);
  vimeoVideoDetailsCache.delete(cleanId);

  const videoDetails = await getVimeoVideoDetails(cleanId, {
    forceRefresh: true,
    syncContext: {
      ...domainWhitelistResult,
      presetError: presetResult.error,
    },
  });

  if (lesson.vimeoEmbedUrl !== videoDetails.embedUrl) {
    lesson.vimeoEmbedUrl = videoDetails.embedUrl;
    await lesson.save();
  }

  return {
    lessonId: lesson._id,
    lessonTitle: lesson.title,
    vimeoVideoId: cleanId,
    embedUrl: videoDetails.embedUrl,
    securityPresetApplied: presetResult.ok,
    securityPresetError: presetResult.error,
    security: videoDetails.security,
    delivery: videoDetails.delivery,
  };
};

export const syncLessonVideoSecurity = async (lessonId) => {
  const lesson = await Lesson.findById(lessonId).select('_id title vimeoVideoId vimeoEmbedUrl');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  return syncLessonSecurityFromDocument(lesson);
};

export const syncAllAssignedLessonVideoSecurity = async () => {
  const lessons = await Lesson.find({
    vimeoVideoId: { $exists: true, $ne: null },
  }).select('_id title vimeoVideoId vimeoEmbedUrl');

  const results = [];

  for (const lesson of lessons) {
    try {
      const result = await syncLessonSecurityFromDocument(lesson);
      results.push({
        ok: result.securityPresetApplied,
        ...result,
      });
    } catch (error) {
      results.push({
        ok: false,
        lessonId: lesson._id,
        lessonTitle: lesson.title,
        vimeoVideoId: lesson.vimeoVideoId,
        error: error.message,
      });
    }
  }

  return {
    syncedCount: results.filter((result) => result.ok).length,
    failedCount: results.filter((result) => !result.ok).length,
    results,
  };
};

export const getVideoEmbedData = async (lessonId, userId, userRole = null) => {
  const lesson = await Lesson.findById(lessonId).populate('course');
  if (!lesson) throw new Error('Lesson not found');
  if (!lesson.vimeoVideoId) throw new Error('No video assigned to this lesson');

  const isAdmin = userRole === 'admin';
  const isInstructor = lesson.course.instructor.toString() === userId.toString();
  const isEnrolledInPublishedLesson = lesson.course.isPublished
    && lesson.isPublished
    && lesson.course.enrolledStudents.some((studentId) => (
      studentId.toString() === userId.toString()
    ));

  if (!isAdmin && !isInstructor && !isEnrolledInPublishedLesson) {
    throw new Error('You are not enrolled in this course');
  }

  if (!isAdmin && !isInstructor) {
    await ensureStudentSubscriptionAccess(lesson.course, userId);
  }

  let videoDetails = null;
  if (getVimeoAccessToken()) {
    try {
      videoDetails = await getVimeoVideoDetails(lesson.vimeoVideoId);
    } catch {
      videoDetails = null;
    }
  }

  const resolvedEmbedUrl = videoDetails?.embedUrl || lesson.vimeoEmbedUrl || buildPlayerEmbedUrl(lesson.vimeoVideoId);

  if (lesson.vimeoEmbedUrl !== resolvedEmbedUrl) {
    lesson.vimeoEmbedUrl = resolvedEmbedUrl;
    await lesson.save();
  }

  return {
    embedUrl: resolvedEmbedUrl,
    vimeoVideoId: lesson.vimeoVideoId,
    lessonId: lesson._id,
    minimumWatchPercentage: lesson.minimumWatchPercentage,
    title: lesson.title,
    videoTitle: videoDetails?.title || null,
    duration: videoDetails?.duration || null,
    thumbnail: videoDetails?.thumbnail || null,
    videoSecurity: videoDetails?.security || null,
  };
};

export const validateVimeoToken = async () => {
  if (!getVimeoAccessToken()) {
    return { valid: false, message: 'No VIMEO_ACCESS_TOKEN configured' };
  }
  try {
    const account = await getVimeoAccountInfo();
    return {
      valid: true,
      account,
    };
  } catch (err) {
    return { valid: false, message: err.message };
  }
};

export const getVimeoAccountInfo = async (options = {}) => {
  const { forceRefresh = false } = options;

  if (!getVimeoAccessToken()) {
    throw new Error('Vimeo API not configured. Please set VIMEO_ACCESS_TOKEN.');
  }

  if (!forceRefresh) {
    const cached = getCachedVimeoAccountInfo();
    if (cached) {
      return cached;
    }
  }

  const data = await vimeoFetch('/me?fields=name,account,link');
  const capabilities = getVimeoAccountCapabilities(data.account);
  const accountInfo = {
    name: data.name,
    type: data.account,
    link: data.link,
    capabilities,
  };

  setCachedVimeoAccountInfo(accountInfo);
  return accountInfo;
};
