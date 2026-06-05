import * as whatsappSettingsService from './whatsappSettings.service.js';

export const getPublicSettings = async (req, res) => {
  try {
    const settings = await whatsappSettingsService.getPublicSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAdminSettings = async (req, res) => {
  try {
    const settings = await whatsappSettingsService.getAdminSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAdminSettings = async (req, res) => {
  try {
    const settings = await whatsappSettingsService.updateAdminSettings(req.body);
    res.json(settings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
