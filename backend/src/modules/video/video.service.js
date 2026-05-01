import 'dotenv/config';
import Lesson from '../lessons/lesson.model.js';
import Course from '../courses/course.model.js';
import { getSubscriptionAccessContext } from '../subscriptions/subscriptions.service.js';

const VIMEO_API_BASE = 'https://api.vimeo.com';
const VIMEO_VIDEO_DETAILS_CACHE_TTL_MS = 5 * 60 * 1000;
const VIMEO_ACCOUNT_INFO_CACHE_TTL_MS = 5 * 60 * 1000;
const PLAYER_HARDENING_PARAMS = {
  title: '0',
  byline: '0',
  portrait: '0',
  badge: '0',
  dnt: '1',
};
const vimeoVideoDetailsCache = new Map();
let vimeoAccountInfoCache = null;
const getVimeoAccessToken = () => process.env.VIMEO_ACCESS_TOKEN;

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

const buildVimeoMetricsSummary = (data = {}) => ({
  plays: Number(data.stats?.plays || 0),
  likes: Number(data.metadata?.connections?.likes?.total || 0),
  comments: Number(data.metadata?.connections?.comments?.total || 0),
  textTracks: Number(data.metadata?.connections?.texttracks?.total || 0),
  versions: Number(data.metadata?.connections?.versions?.total || 0),
});

const resolveAllowedEmbedDomains = () => {
  const domains = new Set();

  const addDomain = (value) => {
    if (!value) {
      return;
    }

    try {
      const candidate = value.includes('://') ? new URL(value).hostname : value.trim();
      if (!candidate) {
        return;
      }

      // Vimeo rejects raw IPs for domain-level privacy; use hostnames only.
      if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(candidate)) {
        return;
      }

      domains.add(candidate.toLowerCase());
    } catch {
      // Ignore invalid domain inputs instead of blocking assignment.
    }
  };

  addDomain(process.env.FRONTEND_URL);

  for (const entry of (process.env.VIMEO_ALLOWED_EMBED_DOMAINS || '').split(',')) {
    addDomain(entry);
  }

  return [...domains];
};

const getVimeoSecurityWarnings = ({ privacy = {}, embed = {} } = {}) => {
  const warnings = [];
  const isDirectPageProtected = privacy.view === 'disable' || privacy.view === 'nobody';

  if (!isDirectPageProtected) {
    warnings.push('Direct Vimeo page access is still enabled. Set the video privacy to "Hide from Vimeo" in Vimeo to stop public link sharing.');
  }

  if (privacy.embed !== 'whitelist') {
    warnings.push('Embed privacy is not restricted to specific domains. Limit embeds to your website domains in Vimeo to prevent off-site embedding.');
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

  return warnings;
};

const buildVimeoSecuritySummary = ({ privacy = {}, embed = {}, whitelistedDomains = [], failedDomains = [] } = {}) => {
  const warnings = getVimeoSecurityWarnings({ privacy, embed });
  const isDirectPageProtected = privacy.view === 'disable' || privacy.view === 'nobody';

  if (failedDomains.length > 0) {
    warnings.push(`Some Vimeo allowed domains could not be applied: ${failedDomains.map(({ domain }) => domain).join(', ')}`);
  }

  return {
    viewPrivacy: privacy.view || null,
    embedPrivacy: privacy.embed || null,
    isDirectPageProtected,
    isDomainRestricted: privacy.embed === 'whitelist',
    shareButtonEnabled: Boolean(embed.buttons?.share),
    watchLaterEnabled: Boolean(embed.buttons?.watchlater),
    embedButtonEnabled: Boolean(embed.buttons?.embed),
    likeButtonEnabled: Boolean(embed.buttons?.like),
    whitelistedDomains,
    failedDomains,
    warnings,
  };
};

const hardenVimeoEmbedAppearance = async (vimeoVideoId) => {
  try {
    await vimeoFetch(`/videos/${vimeoVideoId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        embed: {
          title: {
            name: 'hide',
            owner: 'hide',
            portrait: 'hide',
          },
        },
      }),
    });
  } catch (error) {
    console.warn(`[Vimeo] Could not apply embed appearance hardening to video ${vimeoVideoId}: ${error.message}`);
  }
};

const syncVimeoEmbedDomainWhitelist = async (vimeoVideoId) => {
  const domains = resolveAllowedEmbedDomains();
  if (domains.length === 0) {
    return {
      appliedDomains: [],
      failedDomains: [],
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
  };
};

export const getVimeoVideoDetails = async (vimeoVideoId, options = {}) => {
  const { forceRefresh = false } = options;
  const cleanId = vimeoVideoId.replace(/[^0-9]/g, '');
  if (!cleanId) throw new Error('Invalid Vimeo Video ID');

  if (!forceRefresh) {
    const cached = getCachedVimeoVideoDetails(cleanId);
    if (cached) {
      return cached;
    }
  }

  const data = await vimeoFetch(`/videos/${cleanId}?fields=uri,name,description,duration,width,height,created_time,modified_time,last_user_action_event_date,embed.html,embed.buttons,embed.logos,embed.title,pictures.sizes,player_embed_url,privacy.view,privacy.embed,stats,metadata.connections,status,link,is_playable,has_audio`);
  const security = buildVimeoSecuritySummary(data);

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
    },
    metrics: buildVimeoMetricsSummary(data),
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
    await hardenVimeoEmbedAppearance(cleanId);
  }

  const domainWhitelistResult = getVimeoAccessToken()
    ? await syncVimeoEmbedDomainWhitelist(cleanId)
    : { appliedDomains: [], failedDomains: [] };

  const lesson = await Lesson.findByIdAndUpdate(
    lessonId,
    {
      vimeoVideoId: cleanId,
      vimeoEmbedUrl: videoDetails?.embedUrl || buildPlayerEmbedUrl(cleanId),
    },
    { new: true }
  );

  if (!lesson) throw new Error('Lesson not found');

  const videoSecurity = videoDetails
    ? buildVimeoSecuritySummary({
        privacy: {
          ...videoDetails.privacy,
          embed: domainWhitelistResult.appliedDomains.length > 0 ? 'whitelist' : videoDetails.privacy?.embed,
        },
        embed: videoDetails.embed || {},
        whitelistedDomains: domainWhitelistResult.appliedDomains,
        failedDomains: domainWhitelistResult.failedDomains,
      })
    : null;

  return {
    lesson,
    videoSecurity,
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
  const accountInfo = {
    name: data.name,
    type: data.account,
    link: data.link,
  };

  setCachedVimeoAccountInfo(accountInfo);
  return accountInfo;
};
