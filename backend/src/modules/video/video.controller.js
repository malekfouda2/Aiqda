import * as videoService from './video.service.js';

export const getVimeoVideos = async (req, res) => {
  try {
    const { page = 1, per_page = 25, query = '' } = req.query;
    const result = await videoService.getVimeoVideos(
      parseInt(page), parseInt(per_page), query
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getVideoDetails = async (req, res) => {
  try {
    const result = await videoService.getVimeoVideoDetails(req.params.videoId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
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

export const validateToken = async (req, res) => {
  try {
    const result = await videoService.validateVimeoToken();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
