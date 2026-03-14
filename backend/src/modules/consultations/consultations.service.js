import Consultation from './consultation.model.js';

export const getActive = async () => {
  return Consultation.find({ isActive: true }).sort({ order: 1 });
};

export const getAll = async () => {
  return Consultation.find().sort({ order: 1 });
};

export const getById = async (id) => {
  return Consultation.findById(id);
};

export const create = async (data) => {
  const consultation = new Consultation(data);
  return consultation.save();
};

export const update = async (id, data) => {
  return Consultation.findByIdAndUpdate(id, data, { new: true });
};

export const remove = async (id) => {
  return Consultation.findByIdAndDelete(id);
};
