import mongoose from 'mongoose';
import User from '../modules/users/user.model.js';
import Course from '../modules/courses/course.model.js';
import { getVimeoThumbnail } from '../modules/video/video.service.js';

// Social crawlers (Facebook, WhatsApp, X, TikTok, LinkedIn) do not run the SPA,
// so shared creator/chapter links get their Open Graph tags injected server-side
// into index.html. Anything we can't resolve falls back to the plain page.

const SITE_NAME = 'Aiqda';
const DESCRIPTION_LIMIT = 200;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const truncate = (value, limit = DESCRIPTION_LIMIT) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
};

const toAbsoluteUrl = (value, origin) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${origin}${value.startsWith('/') ? '' : '/'}${value}`;
};

const findActiveCreator = async (creatorId) => {
  if (!mongoose.isValidObjectId(creatorId)) return null;
  const creator = await User.findById(creatorId)
    .select('name avatar role isActive teaserVimeoVideoId')
    .lean();
  if (!creator || creator.role !== 'instructor' || creator.isActive === false) return null;
  return creator;
};

const buildCreatorMeta = async (creatorId) => {
  const creator = await findActiveCreator(creatorId);
  if (!creator) return null;

  const teaserImage = creator.teaserVimeoVideoId
    ? await getVimeoThumbnail(creator.teaserVimeoVideoId)
    : null;

  return {
    title: `Meet ${creator.name} on ${SITE_NAME}`,
    description: creator.teaserVimeoVideoId
      ? `Watch ${creator.name}'s intro video and explore their chapters on ${SITE_NAME}.`
      : `Explore ${creator.name}'s chapters on ${SITE_NAME}.`,
    image: teaserImage || creator.avatar || null,
    type: creator.teaserVimeoVideoId ? 'video.other' : 'profile',
  };
};

const buildChapterMeta = async (courseId) => {
  if (!mongoose.isValidObjectId(courseId)) return null;
  const course = await Course.findById(courseId)
    .select('title description thumbnail isPublished instructor')
    .lean();
  if (!course || !course.isPublished) return null;

  const creator = await findActiveCreator(course.instructor);
  const teaserImage = creator?.teaserVimeoVideoId
    ? await getVimeoThumbnail(creator.teaserVimeoVideoId)
    : null;

  return {
    title: creator ? `${course.title} · by ${creator.name}` : course.title,
    description: truncate(course.description) || `A chapter on ${SITE_NAME}.`,
    image: course.thumbnail || teaserImage || creator?.avatar || null,
    type: 'website',
  };
};

const SHARE_ROUTES = [
  { pattern: /^\/creators\/([^/]+)\/?$/, build: buildCreatorMeta },
  { pattern: /^\/chapters\/([^/]+)\/?$/, build: buildChapterMeta },
];

export const isShareablePath = (pathname) => SHARE_ROUTES.some(({ pattern }) => pattern.test(pathname));

export const getShareMetaForPath = async (pathname) => {
  for (const { pattern, build } of SHARE_ROUTES) {
    const match = pathname.match(pattern);
    if (match) return build(match[1]);
  }
  return null;
};

export const injectShareMeta = (html, meta, { origin, url }) => {
  if (!meta) return html;

  const image = toAbsoluteUrl(meta.image, origin);
  const tags = [
    ['property', 'og:site_name', SITE_NAME],
    ['property', 'og:type', meta.type || 'website'],
    ['property', 'og:title', meta.title],
    ['property', 'og:description', meta.description],
    ['property', 'og:url', url],
    image && ['property', 'og:image', image],
    ['name', 'description', meta.description],
    ['name', 'twitter:card', image ? 'summary_large_image' : 'summary'],
    ['name', 'twitter:title', meta.title],
    ['name', 'twitter:description', meta.description],
    image && ['name', 'twitter:image', image],
  ]
    .filter(Boolean)
    .map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`)
    .join('\n    ');

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`)
    .replace(/\s*<\/head>/i, `\n    ${tags}\n  </head>`);
};
