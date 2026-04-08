import * as teamMembersService from './teamMembers.service.js';

const isNotFoundError = (error) => error.message === 'Team member not found';

export const getPublicList = async (req, res) => {
  try {
    const teamMembers = await teamMembersService.getPublicList();
    res.json(teamMembers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAll = async (req, res) => {
  try {
    const teamMembers = await teamMembersService.getAll();
    res.json(teamMembers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const teamMember = await teamMembersService.getById(req.params.id);
    res.json(teamMember);
  } catch (error) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ error: error.message });
    }

    res.status(400).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const teamMember = await teamMembersService.create(req.body, req.file);
    res.status(201).json(teamMember);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const teamMember = await teamMembersService.update(req.params.id, req.body, req.file);
    res.json(teamMember);
  } catch (error) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ error: error.message });
    }

    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    await teamMembersService.remove(req.params.id);
    res.json({ message: 'Team member deleted successfully' });
  } catch (error) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ error: error.message });
    }

    res.status(400).json({ error: error.message });
  }
};
