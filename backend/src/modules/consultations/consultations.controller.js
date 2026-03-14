import * as consultationsService from './consultations.service.js';

export const getActive = async (req, res) => {
  try {
    const consultations = await consultationsService.getActive();
    res.json(consultations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const consultation = await consultationsService.getById(req.params.id);
    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    res.json(consultation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const consultation = await consultationsService.create(req.body);
    res.status(201).json(consultation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const consultation = await consultationsService.update(req.params.id, req.body);
    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    res.json(consultation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const consultation = await consultationsService.remove(req.params.id);
    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    res.json({ message: 'Consultation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
