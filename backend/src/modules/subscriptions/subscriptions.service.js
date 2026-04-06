import { Subscription, SubscriptionPackage } from './subscription.model.js';

export const createPackage = async (packageData) => {
  const pkg = new SubscriptionPackage(packageData);
  await pkg.save();
  return pkg;
};

export const getAllPackages = async (activeOnly = false) => {
  const query = activeOnly ? { isActive: true } : {};
  return SubscriptionPackage.find(query).populate('courses', 'title category level').sort({ price: 1 });
};

export const getPackageById = async (packageId) => {
  const pkg = await SubscriptionPackage.findById(packageId).populate('courses', 'title category level');
  if (!pkg) {
    throw new Error('Package not found');
  }
  return pkg;
};

export const updatePackage = async (packageId, updates) => {
  const pkg = await SubscriptionPackage.findByIdAndUpdate(packageId, updates, { new: true });
  if (!pkg) {
    throw new Error('Package not found');
  }
  return pkg;
};

export const requestSubscription = async (userId, packageId) => {
  const pkg = await SubscriptionPackage.findById(packageId);
  if (!pkg || !pkg.isActive) {
    throw new Error('Invalid or inactive package');
  }

  const existingActive = await Subscription.findOne({
    user: userId,
    status: 'active',
    endDate: { $gt: new Date() }
  });

  if (existingActive) {
    throw new Error('You already have an active subscription');
  }

  const existingPending = await Subscription.findOne({
    user: userId,
    status: 'pending'
  });

  if (existingPending) {
    throw new Error('You already have a pending subscription awaiting payment or review');
  }

  const subscription = new Subscription({
    user: userId,
    package: packageId,
    status: 'pending'
  });

  await subscription.save();
  return subscription.populate('package');
};

export const getUserSubscriptions = async (userId) => {
  return Subscription.find({ user: userId })
    .populate('package')
    .sort({ createdAt: -1 });
};

export const getActiveSubscription = async (userId) => {
  return Subscription.findOne({
    user: userId,
    status: 'active',
    endDate: { $gt: new Date() }
  }).populate('package');
};

export const getAllSubscriptions = async (status) => {
  const query = status ? { status } : {};
  return Subscription.find(query)
    .populate('user', 'name email')
    .populate('package')
    .sort({ createdAt: -1 });
};

export const approveSubscription = async (subscriptionId, adminId) => {
  throw new Error('Subscriptions are activated from Payment Management after payment review.');
};

export const cancelSubscription = async (subscriptionId) => {
  const subscription = await Subscription.findByIdAndUpdate(
    subscriptionId,
    { status: 'cancelled' },
    { new: true }
  );
  if (!subscription) {
    throw new Error('Subscription not found');
  }
  return subscription;
};

export const checkSubscriptionAccess = async (userId) => {
  const subscription = await getActiveSubscription(userId);
  return !!subscription;
};
