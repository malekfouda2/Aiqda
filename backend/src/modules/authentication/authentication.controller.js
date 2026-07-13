import * as authenticationService from './authentication.service.js';

const isNotFoundError = (error) => error.message === 'Authentication item not found';

export const getPublicList = async (req, res) => {
  try {
    const items = await authenticationService.getPublicList();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAll = async (req, res) => {
  try {
    const items = await authenticationService.getAll();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const item = await authenticationService.getById(req.params.id);
    res.json(item);
  } catch (error) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const item = await authenticationService.create(req.body, req.file);
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const item = await authenticationService.update(req.params.id, req.body, req.file);
    res.json(item);
  } catch (error) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    await authenticationService.remove(req.params.id);
    res.json({ message: 'Authentication item deleted successfully' });
  } catch (error) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};
