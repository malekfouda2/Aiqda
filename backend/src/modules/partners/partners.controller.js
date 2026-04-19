import * as partnersService from './partners.service.js';

const isNotFoundError = (error) => error.message === 'Partner not found';

export const getPublicList = async (req, res) => {
  try {
    const partners = await partnersService.getPublicList();
    res.json(partners);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAll = async (req, res) => {
  try {
    const partners = await partnersService.getAll();
    res.json(partners);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const partner = await partnersService.getById(req.params.id);
    res.json(partner);
  } catch (error) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ error: error.message });
    }

    res.status(400).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const partner = await partnersService.create(req.body, req.file);
    res.status(201).json(partner);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const partner = await partnersService.update(req.params.id, req.body, req.file);
    res.json(partner);
  } catch (error) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ error: error.message });
    }

    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    await partnersService.remove(req.params.id);
    res.json({ message: 'Partner deleted successfully' });
  } catch (error) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ error: error.message });
    }

    res.status(400).json({ error: error.message });
  }
};
