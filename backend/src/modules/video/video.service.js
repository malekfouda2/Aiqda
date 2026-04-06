import 'dotenv/config';
import Lesson from '../lessons/lesson.model.js';
import Course from '../courses/course.model.js';

const VIMEO_API_BASE = 'https://api.vimeo.com';
const getVimeoAccessToken = () => process.env.VIMEO_ACCESS_TOKEN;

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

export const getVimeoVideoDetails = async (vimeoVideoId) => {
  const cleanId = vimeoVideoId.replace(/[^0-9]/g, '');
  if (!cleanId) throw new Error('Invalid Vimeo Video ID');

  const data = await vimeoFetch(`/videos/${cleanId}?fields=uri,name,description,duration,width,height,embed.html,pictures.sizes,player_embed_url,privacy.view,status,link`);

  return {
    vimeoId: cleanId,
    title: data.name,
    description: data.description,
    duration: data.duration,
    width: data.width,
    height: data.height,
    embedHtml: data.embed?.html,
    playerUrl: data.player_embed_url,
    thumbnail: data.pictures?.sizes?.find(s => s.width >= 640)?.link || data.pictures?.sizes?.[0]?.link,
    privacy: data.privacy?.view,
    status: data.status,
    link: data.link,
  };
};

export const getVimeoVideos = async (page = 1, perPage = 25, query = '') => {
  let path = `/me/videos?page=${page}&per_page=${perPage}&fields=uri,name,description,duration,pictures.sizes,privacy.view,status,link,created_time`;
  if (query) path += `&query=${encodeURIComponent(query)}`;

  const data = await vimeoFetch(path);
  return {
    videos: (data.data || []).map(v => ({
      vimeoId: v.uri?.split('/').pop(),
      title: v.name,
      description: v.description,
      duration: v.duration,
      thumbnail: v.pictures?.sizes?.find(s => s.width >= 640)?.link || v.pictures?.sizes?.[0]?.link,
      privacy: v.privacy?.view,
      status: v.status,
      link: v.link,
      createdAt: v.created_time,
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

  if (getVimeoAccessToken()) {
    try {
      await getVimeoVideoDetails(cleanId);
    } catch (err) {
      throw new Error(`Could not verify video on Vimeo: ${err.message}`);
    }
  }

  const lesson = await Lesson.findByIdAndUpdate(
    lessonId,
    { vimeoVideoId: cleanId },
    { new: true }
  );

  if (!lesson) throw new Error('Lesson not found');
  return lesson;
};

export const getVideoEmbedData = async (lessonId, userId, userRole = null) => {
  const lesson = await Lesson.findById(lessonId).populate('course');
  if (!lesson) throw new Error('Lesson not found');
  if (!lesson.vimeoVideoId) throw new Error('No video assigned to this lesson');

  const isAdmin = userRole === 'admin';
  const isEnrolled = lesson.course.enrolledStudents.some(
    s => s.toString() === userId.toString()
  );
  const isInstructor = lesson.course.instructor.toString() === userId.toString();

  if (!isAdmin && !isEnrolled && !isInstructor) {
    throw new Error('You are not enrolled in this course');
  }

  let videoDetails = null;
  if (getVimeoAccessToken()) {
    try {
      videoDetails = await getVimeoVideoDetails(lesson.vimeoVideoId);
    } catch {
      videoDetails = null;
    }
  }

  return {
    embedUrl: `https://player.vimeo.com/video/${lesson.vimeoVideoId}`,
    vimeoVideoId: lesson.vimeoVideoId,
    lessonId: lesson._id,
    minimumWatchPercentage: lesson.minimumWatchPercentage,
    title: lesson.title,
    videoTitle: videoDetails?.title || null,
    duration: videoDetails?.duration || null,
    thumbnail: videoDetails?.thumbnail || null,
  };
};

export const validateVimeoToken = async () => {
  if (!getVimeoAccessToken()) {
    return { valid: false, message: 'No VIMEO_ACCESS_TOKEN configured' };
  }
  try {
    const data = await vimeoFetch('/me?fields=name,account,link');
    return {
      valid: true,
      account: {
        name: data.name,
        type: data.account,
        link: data.link,
      },
    };
  } catch (err) {
    return { valid: false, message: err.message };
  }
};
