import * as subscriptionsService from './subscriptions.service.js';

export const createPackage = async (req, res) => {
  try {
    const pkg = await subscriptionsService.createPackage(req.body);
    res.status(201).json(pkg);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllPackages = async (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';
    const packages = await subscriptionsService.getAllPackages(activeOnly);
    res.json(packages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPackageById = async (req, res) => {
  try {
    const pkg = await subscriptionsService.getPackageById(req.params.id);
    res.json(pkg);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const updatePackage = async (req, res) => {
  try {
    const pkg = await subscriptionsService.updatePackage(req.params.id, req.body);
    res.json(pkg);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const requestSubscription = async (req, res) => {
  try {
    const subscription = await subscriptionsService.requestSubscription(
      req.user.id,
      req.body.packageId
    );
    res.status(201).json(subscription);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getUserSubscriptions = async (req, res) => {
  try {
    const subscriptions = await subscriptionsService.getUserSubscriptions(req.user.id);
    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getActiveSubscription = async (req, res) => {
  try {
    const subscription = await subscriptionsService.getActiveSubscription(req.user.id);
    res.json(subscription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await subscriptionsService.getAllSubscriptions(req.query.status);
    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const approveSubscription = async (req, res) => {
  try {
    const subscription = await subscriptionsService.approveSubscription(
      req.params.id,
      req.user.id
    );
    res.json(subscription);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const subscription = await subscriptionsService.cancelSubscription(req.params.id);
    res.json(subscription);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
