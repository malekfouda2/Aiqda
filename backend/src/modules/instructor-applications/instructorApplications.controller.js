import * as instructorApplicationsService from './instructorApplications.service.js';

export const submitApplication = async (req, res) => {
  try {
    const data = { ...req.body };

    if (req.files) {
      if (req.files.cvFile && req.files.cvFile[0]) {
        data.cvFile = '/uploads/' + req.files.cvFile[0].filename;
      }
      if (req.files.courseMaterialsFile && req.files.courseMaterialsFile[0]) {
        data.courseMaterialsFile = '/uploads/' + req.files.courseMaterialsFile[0].filename;
      }
    }

    if (data.specialization && typeof data.specialization === 'string') {
      try {
        data.specialization = JSON.parse(data.specialization);
      } catch (e) {
        data.specialization = [data.specialization];
      }
    }

    const application = await instructorApplicationsService.create(data);
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
    const applications = await instructorApplicationsService.getAll(filters);
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getApplicationById = async (req, res) => {
  try {
    const application = await instructorApplicationsService.getById(req.params.id);
    res.json(application);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const approveApplication = async (req, res) => {
  try {
    const result = await instructorApplicationsService.approve(req.params.id, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const rejectApplication = async (req, res) => {
  try {
    const { reason } = req.body;
    const application = await instructorApplicationsService.reject(req.params.id, req.user.id, reason);
    res.json(application);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
