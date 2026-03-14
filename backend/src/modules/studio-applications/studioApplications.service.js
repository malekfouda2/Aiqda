import StudioApplication from './studioApplication.model.js';

export const create = async (data) => {
  const application = new StudioApplication(data);
  await application.save();
  return application;
};

export const getAll = async (filters) => {
  const query = {};
  if (filters && filters.status) {
    query.status = filters.status;
  }
  return StudioApplication.find(query)
    .populate('reviewedBy', 'name email')
    .sort({ createdAt: -1 });
};

export const getById = async (id) => {
  const application = await StudioApplication.findById(id)
    .populate('reviewedBy', 'name email');
  if (!application) {
    throw new Error('Application not found');
  }
  return application;
};

export const approve = async (id, adminId) => {
  const application = await StudioApplication.findById(id);
  if (!application) {
    throw new Error('Application not found');
  }

  if (application.status !== 'pending') {
    throw new Error('Application has already been reviewed');
  }

  application.status = 'approved';
  application.reviewedBy = adminId;
  application.reviewedAt = new Date();
  await application.save();

  return application;
};

export const reject = async (id, adminId, reason) => {
  const application = await StudioApplication.findById(id);
  if (!application) {
    throw new Error('Application not found');
  }

  if (application.status !== 'pending') {
    throw new Error('Application has already been reviewed');
  }

  application.status = 'rejected';
  application.reviewedBy = adminId;
  application.reviewedAt = new Date();
  application.rejectionReason = reason;
  await application.save();

  return application;
};
