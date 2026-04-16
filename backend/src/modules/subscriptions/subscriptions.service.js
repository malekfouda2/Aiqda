import { Subscription, SubscriptionPackage } from './subscription.model.js';

const BILLING_TERM_LABELS = {
  monthly: 'Monthly',
  annual: 'Annual',
};

const PACKAGE_POPULATE = [
  { path: 'courses', select: 'title category level' },
  {
    path: 'includedPackages',
    select: 'name purchaseMode billingOptions isActive includedPackages',
    populate: {
      path: 'includedPackages',
      select: 'name purchaseMode billingOptions isActive includedPackages',
      populate: {
        path: 'includedPackages',
        select: 'name purchaseMode billingOptions isActive',
      },
    },
  },
];

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return Boolean(value);
};

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
};

const normalizePurchaseMode = (value = 'self_serve') => {
  if (typeof value !== 'string') {
    return 'self_serve';
  }

  return value === 'contact_only' ? 'contact_only' : 'self_serve';
};

const getActiveBillingOptions = (pkg = {}) => {
  if (!Array.isArray(pkg.billingOptions)) {
    return [];
  }

  return pkg.billingOptions
    .filter((option) => option && option.term && option.isActive !== false)
    .sort((a, b) => {
      const aRank = a.term === 'monthly' ? 0 : 1;
      const bRank = b.term === 'monthly' ? 0 : 1;
      return aRank - bRank;
    });
};

export const getBillingOptionForPackage = (pkg = {}, requestedTerm = null) => {
  const options = getActiveBillingOptions(pkg);
  if (options.length === 0) {
    return null;
  }

  if (requestedTerm) {
    const matchingOption = options.find((option) => option.term === requestedTerm);
    if (!matchingOption) {
      return null;
    }
    return matchingOption;
  }

  return options.find((option) => option.term === 'monthly') || options[0];
};

const normalizeBillingOptions = (packageData = {}, existingPackage = null) => {
  if (Array.isArray(packageData.billingOptions)) {
    const optionsByTerm = new Map();

    for (const rawOption of packageData.billingOptions) {
      if (!rawOption || !rawOption.term) {
        continue;
      }

      const term = rawOption.term === 'annual' ? 'annual' : 'monthly';
      if (toBoolean(rawOption.isActive, true) === false) {
        continue;
      }

      const price = toNullableNumber(rawOption.price);
      const durationDays = Math.trunc(toNullableNumber(rawOption.durationDays) ?? 0);

      if (price === null || price <= 0) {
        throw new Error(`A valid ${term} price is required.`);
      }

      if (!Number.isInteger(durationDays) || durationDays < 1) {
        throw new Error(`A valid ${term} duration in days is required.`);
      }

      optionsByTerm.set(term, {
        term,
        label: typeof rawOption.label === 'string' && rawOption.label.trim()
          ? rawOption.label.trim()
          : BILLING_TERM_LABELS[term],
        price,
        durationDays,
        isActive: true,
      });
    }

    return [...optionsByTerm.values()];
  }

  if (
    packageData.billingOptions === undefined
    && Array.isArray(existingPackage?.billingOptions)
    && existingPackage.billingOptions.length > 0
  ) {
    return existingPackage.billingOptions
      .filter((option) => option && option.term && option.isActive !== false)
      .map((option) => ({
        term: option.term,
        label: option.label || BILLING_TERM_LABELS[option.term] || option.term,
        price: option.price,
        durationDays: option.durationDays,
        isActive: option.isActive !== false,
      }));
  }

  const legacyPrice = toNullableNumber(packageData.price ?? existingPackage?.price);
  if (legacyPrice === null || legacyPrice <= 0) {
    return [];
  }

  const legacyDuration = Math.trunc(
    toNullableNumber(packageData.durationDays ?? existingPackage?.durationDays) ?? 30
  );

  if (!Number.isInteger(legacyDuration) || legacyDuration < 1) {
    throw new Error('A valid duration in days is required.');
  }

  return [
    {
      term: 'monthly',
      label: BILLING_TERM_LABELS.monthly,
      price: legacyPrice,
      durationDays: legacyDuration,
      isActive: true,
    },
  ];
};

const buildPackagePayload = (packageData = {}, existingPackage = null) => {
  const purchaseMode = normalizePurchaseMode(
    packageData.purchaseMode ?? existingPackage?.purchaseMode
  );
  const billingOptions = normalizeBillingOptions(packageData, existingPackage);

  if (purchaseMode === 'self_serve' && billingOptions.length === 0) {
    throw new Error('At least one active billing option is required for self-serve packages.');
  }

  const defaultBillingOption = getBillingOptionForPackage({ billingOptions });
  const includedPackages = [...new Set(
    (packageData.includedPackages ?? existingPackage?.includedPackages ?? [])
      .map((value) => value?._id?.toString?.() || value?.toString?.() || '')
      .filter(Boolean)
  )];

  const payload = {
    name: typeof packageData.name === 'string' ? packageData.name.trim() : existingPackage?.name,
    price: defaultBillingOption?.price ?? null,
    billingOptions,
    scheduleDuration: typeof packageData.scheduleDuration === 'string'
      ? packageData.scheduleDuration.trim()
      : existingPackage?.scheduleDuration,
    durationDays: defaultBillingOption?.durationDays ?? null,
    learningMode: typeof packageData.learningMode === 'string'
      ? packageData.learningMode.trim()
      : existingPackage?.learningMode,
    focus: typeof packageData.focus === 'string' ? packageData.focus.trim() : existingPackage?.focus,
    courses: packageData.courses ?? existingPackage?.courses ?? [],
    softwareExposure: packageData.softwareExposure ?? existingPackage?.softwareExposure ?? [],
    outcome: typeof packageData.outcome === 'string' ? packageData.outcome.trim() : existingPackage?.outcome,
    purchaseMode,
    includedPackages,
    isActive: toBoolean(packageData.isActive, existingPackage?.isActive ?? true),
  };

  if (!payload.name) {
    throw new Error('Package name is required');
  }

  if (!payload.scheduleDuration) {
    throw new Error('Schedule / duration is required');
  }

  if (!payload.learningMode) {
    throw new Error('Learning mode is required');
  }

  if (!payload.focus) {
    throw new Error('Focus is required');
  }

  if (!payload.outcome) {
    throw new Error('Outcome is required');
  }

  return payload;
};

const populatePackageQuery = (query) => {
  for (const populateStep of PACKAGE_POPULATE) {
    query.populate(populateStep);
  }

  return query;
};

const populateSubscriptionQuery = (query) => (
  query.populate({
    path: 'package',
    populate: PACKAGE_POPULATE,
  })
);

const getPackageSortValue = (pkg) => {
  if (pkg.purchaseMode === 'contact_only') {
    return Number.MAX_SAFE_INTEGER;
  }

  const preferredOption = getBillingOptionForPackage(pkg);
  if (preferredOption) {
    return preferredOption.price;
  }

  return Number.MAX_SAFE_INTEGER - 1;
};

const normalizeBillingTerm = (pkg, requestedTerm = null) => {
  const term = typeof requestedTerm === 'string' ? requestedTerm.trim().toLowerCase() : '';
  if (!term) {
    return getBillingOptionForPackage(pkg)?.term || null;
  }

  if (!['monthly', 'annual'].includes(term)) {
    throw new Error('Please select a valid billing term.');
  }

  return term;
};

const resolveAccessiblePackageIds = async (rootPackageId) => {
  const visited = new Set();
  let queue = [rootPackageId.toString()];

  while (queue.length > 0) {
    const batch = queue.filter((id) => !visited.has(id));
    if (batch.length === 0) {
      break;
    }

    batch.forEach((id) => visited.add(id));

    const packages = await SubscriptionPackage.find({ _id: { $in: batch } })
      .select('includedPackages')
      .lean();

    queue = packages.flatMap((pkg) => (
      (pkg.includedPackages || []).map((id) => id.toString())
    ));
  }

  return [...visited];
};

export const getSubscriptionAccessContext = async (userId, courseId = null) => {
  const subscription = await Subscription.findOne({
    user: userId,
    status: 'active',
    endDate: { $gt: new Date() }
  }).populate({
    path: 'package',
    select: 'name courses includedPackages purchaseMode'
  });

  if (!subscription?.package) {
    return {
      hasActiveSubscription: false,
      hasCourseAccess: false,
      subscription: null,
      accessiblePackageIds: [],
      accessibleCourseIds: [],
    };
  }

  const accessiblePackageIds = await resolveAccessiblePackageIds(subscription.package._id);
  const accessiblePackages = await SubscriptionPackage.find({
    _id: { $in: accessiblePackageIds }
  }).select('courses');

  const accessibleCourseIds = [...new Set(
    accessiblePackages.flatMap((pkg) => (
      (pkg.courses || []).map((courseIdValue) => courseIdValue.toString())
    ))
  )];

  return {
    hasActiveSubscription: true,
    hasCourseAccess: courseId ? accessibleCourseIds.includes(courseId.toString()) : true,
    subscription,
    accessiblePackageIds,
    accessibleCourseIds,
  };
};

export const createPackage = async (packageData) => {
  const payload = buildPackagePayload(packageData);
  const pkg = new SubscriptionPackage(payload);

  if (payload.includedPackages.includes(pkg._id.toString())) {
    throw new Error('A package cannot include itself.');
  }

  await pkg.save();
  return getPackageById(pkg._id);
};

export const getAllPackages = async (activeOnly = false) => {
  const query = activeOnly ? { isActive: true } : {};
  const packages = await populatePackageQuery(
    SubscriptionPackage.find(query)
  );

  return packages.sort((a, b) => {
    const sortDiff = getPackageSortValue(a) - getPackageSortValue(b);
    if (sortDiff !== 0) {
      return sortDiff;
    }

    return a.name.localeCompare(b.name);
  });
};

export const getPackageById = async (packageId) => {
  const pkg = await populatePackageQuery(
    SubscriptionPackage.findById(packageId)
  );

  if (!pkg) {
    throw new Error('Package not found');
  }

  return pkg;
};

export const updatePackage = async (packageId, updates) => {
  const existingPackage = await SubscriptionPackage.findById(packageId);
  if (!existingPackage) {
    throw new Error('Package not found');
  }

  const payload = buildPackagePayload(updates, existingPackage);
  if (payload.includedPackages.includes(packageId.toString())) {
    throw new Error('A package cannot include itself.');
  }

  Object.assign(existingPackage, payload);
  await existingPackage.save();
  return getPackageById(existingPackage._id);
};

export const requestSubscription = async (userId, packageId, billingTermInput) => {
  const pkg = await SubscriptionPackage.findById(packageId);
  if (!pkg || !pkg.isActive) {
    throw new Error('Invalid or inactive package');
  }

  if (pkg.purchaseMode === 'contact_only') {
    throw new Error('This package is available through appointment or direct contact only.');
  }

  const billingTerm = normalizeBillingTerm(pkg, billingTermInput);
  const billingOption = getBillingOptionForPackage(pkg, billingTerm);

  if (!billingOption) {
    throw new Error('The selected billing term is not available for this package.');
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
    status: 'pending',
    billingTerm: billingOption.term,
    priceAtPurchase: billingOption.price,
    durationDaysSnapshot: billingOption.durationDays,
    purchaseModeSnapshot: pkg.purchaseMode,
  });

  await subscription.save();
  return populateSubscriptionQuery(
    Subscription.findById(subscription._id)
  );
};

export const getUserSubscriptions = async (userId) => {
  return populateSubscriptionQuery(
    Subscription.find({ user: userId }).sort({ createdAt: -1 })
  );
};

export const getActiveSubscription = async (userId) => {
  return populateSubscriptionQuery(
    Subscription.findOne({
      user: userId,
      status: 'active',
      endDate: { $gt: new Date() }
    })
  );
};

export const getAllSubscriptions = async (status) => {
  const query = status ? { status } : {};
  return populateSubscriptionQuery(
    Subscription.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
  );
};

export const approveSubscription = async () => {
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

export const checkSubscriptionAccess = async (userId, courseId = null) => {
  const accessContext = await getSubscriptionAccessContext(userId, courseId);
  return courseId ? accessContext.hasCourseAccess : accessContext.hasActiveSubscription;
};
