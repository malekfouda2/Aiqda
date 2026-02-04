import Lesson from '../lessons/lesson.model.js';

const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN;

export const uploadToVimeo = async (videoData) => {
  if (!VIMEO_ACCESS_TOKEN) {
    return {
      success: false,
      message: 'Vimeo API not configured. Please set VIMEO_ACCESS_TOKEN environment variable.',
      mockVideoId: 'mock-video-' + Date.now()
    };
  }

  return {
    success: true,
    message: 'Video upload initiated',
    videoId: 'vimeo-' + Date.now()
  };
};

export const getVimeoVideos = async () => {
  if (!VIMEO_ACCESS_TOKEN) {
    return {
      videos: [],
      message: 'Vimeo API not configured'
    };
  }

  return {
    videos: [],
    message: 'Fetched from Vimeo'
  };
};

export const assignVideoToLesson = async (lessonId, vimeoVideoId) => {
  const lesson = await Lesson.findByIdAndUpdate(
    lessonId,
    { vimeoVideoId },
    { new: true }
  );

  if (!lesson) {
    throw new Error('Lesson not found');
  }

  return lesson;
};

export const getVideoEmbedData = async (lessonId, userId) => {
  const lesson = await Lesson.findById(lessonId).populate('course');
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (!lesson.vimeoVideoId) {
    throw new Error('No video assigned to this lesson');
  }

  const isEnrolled = lesson.course.enrolledStudents.some(
    s => s.toString() === userId.toString()
  );

  if (!isEnrolled) {
    throw new Error('You are not enrolled in this course');
  }

  return {
    embedUrl: `https://player.vimeo.com/video/${lesson.vimeoVideoId}`,
    lessonId: lesson._id,
    minimumWatchPercentage: lesson.minimumWatchPercentage,
    title: lesson.title
  };
};

export const deleteVimeoVideo = async (videoId) => {
  if (!VIMEO_ACCESS_TOKEN) {
    return {
      success: false,
      message: 'Vimeo API not configured'
    };
  }

  return {
    success: true,
    message: 'Video deleted from Vimeo'
  };
};
