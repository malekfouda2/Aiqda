import * as usersService from './users.service.js';

export const getAllUsers = async (req, res) => {
  try {
    const users = await usersService.getAllUsers(req.query);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await usersService.getUserById(req.params.id);
    res.json(user);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await usersService.updateUser(req.params.id, req.body);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const user = await usersService.toggleUserStatus(req.params.id);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await usersService.updateUserRole(req.params.id, role);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
