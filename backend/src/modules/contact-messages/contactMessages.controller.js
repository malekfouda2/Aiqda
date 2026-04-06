import * as contactMessagesService from './contactMessages.service.js';

export const submit = async (req, res) => {
  try {
    const contactMessage = await contactMessagesService.create(req.body);
    res.status(201).json({
      message: 'Your message has been sent successfully.',
      contactMessage
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAll = async (req, res) => {
  try {
    const contactMessages = await contactMessagesService.getAll(req.query);
    res.json(contactMessages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const contactMessage = await contactMessagesService.getById(req.params.id);
    res.json(contactMessage);
  } catch (error) {
    if (error.message === 'Contact message not found') {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const contactMessage = await contactMessagesService.markAsRead(req.params.id, req.user.id);
    res.json(contactMessage);
  } catch (error) {
    if (error.message === 'Contact message not found') {
      return res.status(404).json({ error: error.message });
    }

    res.status(400).json({ error: error.message });
  }
};

export const markAsUnread = async (req, res) => {
  try {
    const contactMessage = await contactMessagesService.markAsUnread(req.params.id);
    res.json(contactMessage);
  } catch (error) {
    if (error.message === 'Contact message not found') {
      return res.status(404).json({ error: error.message });
    }

    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    await contactMessagesService.remove(req.params.id);
    res.json({ message: 'Contact message deleted successfully' });
  } catch (error) {
    if (error.message === 'Contact message not found') {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
};
