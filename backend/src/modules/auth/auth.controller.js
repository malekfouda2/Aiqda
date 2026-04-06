import * as authService from './auth.service.js';

const isAuthValidationError = (message) => [
  'Name is required',
  'Email is required',
  'Password is required',
  'Password must be at least 8 characters',
  'Please provide a valid email address',
].includes(message);

export const register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    const result = await authService.register({ email, password, name, role });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.json(result);
  } catch (error) {
    res.status(isAuthValidationError(error.message) ? 400 : 401).json({ error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await authService.getProfile(req.user.id);
    res.json(user);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const acceptInstructorInvite = async (req, res) => {
  try {
    const result = await authService.acceptInstructorInvite(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
