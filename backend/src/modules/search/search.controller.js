import * as searchService from './search.service.js';

export const search = async (req, res) => {
  try {
    const result = await searchService.globalSearch(req.user, req.query.q);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
