import * as studioApplicationsService from './studioApplications.service.js';

export const submitApplication = async (req, res) => {
  try {
    const application = await studioApplicationsService.create(req.body);
    res.status(201).json(application);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllApplications = async (req, res) => {
  try {
    const filters = {};
    if (req.query.status) {
      filters.status = req.query.status;
    }
    const applications = await studioApplicationsService.getAll(filters);
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getApplicationById = async (req, res) => {
  try {
    const application = await studioApplicationsService.getById(req.params.id);
    res.json(application);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const approveApplication = async (req, res) => {
  try {
    const application = await studioApplicationsService.approve(req.params.id, req.user.id);
    res.json(application);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const rejectApplication = async (req, res) => {
  try {
    const { reason } = req.body;
    const application = await studioApplicationsService.reject(req.params.id, req.user.id, reason);
    res.json(application);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
