import * as videoService from './video.service.js';

export const uploadToVimeo = async (req, res) => {
  try {
    const result = await videoService.uploadToVimeo(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getVimeoVideos = async (req, res) => {
  try {
    const result = await videoService.getVimeoVideos();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const assignVideoToLesson = async (req, res) => {
  try {
    const { lessonId, vimeoVideoId } = req.body;
    const lesson = await videoService.assignVideoToLesson(lessonId, vimeoVideoId);
    res.json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getVideoEmbedData = async (req, res) => {
  try {
    const embedData = await videoService.getVideoEmbedData(req.params.lessonId, req.user.id);
    res.json(embedData);
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
};

export const deleteVimeoVideo = async (req, res) => {
  try {
    const result = await videoService.deleteVimeoVideo(req.params.videoId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
