import { SubscriptionPackage } from '../modules/subscriptions/subscription.model.js';
import {
  buildSelfServeBillingOptions,
  DEFAULT_SIX_MONTH_DURATION_DAYS,
  LEGACY_SUBSCRIPTION_PACKAGE_NAMES,
  ROADMAP_ENTERPRISE_PACKAGE_BLUEPRINT,
  ROADMAP_PACKAGE_NAMES,
  ROADMAP_SELF_SERVE_PACKAGE_BLUEPRINTS,
} from '../modules/subscriptions/subscriptionRoadmap.js';

const LEGACY_TO_ROADMAP_PACKAGE_NAME = {
  'Engineering Starter': 'Start Smart',
  'Business Analytics Bundle': 'Pro Artist',
  'Architecture Professional': 'Full Studio',
  'Complete Professional Package': 'Semester / Professional Track',
};

const needsLegacyBillingBackfill = (pkg) => (
  (!Array.isArray(pkg.billingOptions) || pkg.billingOptions.length === 0)
  && Number.isFinite(Number(pkg.price))
  && Number(pkg.price) > 0
);

const needsSixMonthBackfill = (pkg) => {
  if (!Array.isArray(pkg.billingOptions) || pkg.billingOptions.length === 0) {
    return false;
  }

  const hasSixMonth = pkg.billingOptions.some(
    (option) => option?.term === 'six_months' && option.isActive !== false
  );

  if (hasSixMonth) {
    return false;
  }

  return pkg.billingOptions.some(
    (option) => option?.term === 'monthly' && option.isActive !== false && Number(option.price) > 0
  );
};

export const syncSubscriptionPackageRoadmap = async () => {
  const packages = await SubscriptionPackage.find({});
  if (packages.length === 0) {
    return {
      billingBackfills: 0,
      sixMonthBackfills: 0,
      roadmapPackagesCreated: 0,
      legacyPackagesArchived: 0,
    };
  }

  let billingBackfills = 0;
  let sixMonthBackfills = 0;
  for (const pkg of packages) {
    if (!needsLegacyBillingBackfill(pkg)) {
      if (needsSixMonthBackfill(pkg)) {
        const monthlyOption = pkg.billingOptions.find(
          (option) => option?.term === 'monthly' && option.isActive !== false
        );

        pkg.billingOptions.push({
          term: 'six_months',
          label: '6 Months',
          price: Number(monthlyOption.price) * 6,
          durationDays: Number(monthlyOption.durationDays) > 0
            ? Number(monthlyOption.durationDays) * 6
            : DEFAULT_SIX_MONTH_DURATION_DAYS,
          isActive: true,
        });
        await pkg.save();
        sixMonthBackfills += 1;
      }
      continue;
    }

    pkg.billingOptions = buildSelfServeBillingOptions(
      Number(pkg.price),
      undefined,
      undefined,
      Number(pkg.durationDays) || 30,
      Number(pkg.durationDays) > 0
        ? Number(pkg.durationDays) * 6
        : DEFAULT_SIX_MONTH_DURATION_DAYS
    );
    pkg.purchaseMode = pkg.purchaseMode || 'self_serve';
    pkg.includedPackages = Array.isArray(pkg.includedPackages) ? pkg.includedPackages : [];
    await pkg.save();
    billingBackfills += 1;
  }

  const refreshedPackages = await SubscriptionPackage.find({});
  const roadmapPackages = refreshedPackages.filter((pkg) => ROADMAP_PACKAGE_NAMES.includes(pkg.name));
  if (roadmapPackages.length > 0) {
    return {
      billingBackfills,
      sixMonthBackfills,
      roadmapPackagesCreated: 0,
      legacyPackagesArchived: 0,
    };
  }

  const legacyPackages = refreshedPackages.filter((pkg) => LEGACY_SUBSCRIPTION_PACKAGE_NAMES.includes(pkg.name));
  if (legacyPackages.length === 0) {
    return {
      billingBackfills,
      sixMonthBackfills,
      roadmapPackagesCreated: 0,
      legacyPackagesArchived: 0,
    };
  }

  const roadmapPackageIdsByName = new Map();
  let roadmapPackagesCreated = 0;

  for (const blueprint of ROADMAP_SELF_SERVE_PACKAGE_BLUEPRINTS) {
    const matchingLegacyPackage = legacyPackages.find(
      (pkg) => LEGACY_TO_ROADMAP_PACKAGE_NAME[pkg.name] === blueprint.name
    );

    const createdPackage = await SubscriptionPackage.create({
      name: blueprint.name,
      price: blueprint.monthlyPrice,
      billingOptions: buildSelfServeBillingOptions(blueprint.monthlyPrice),
      scheduleDuration: blueprint.scheduleDuration,
      durationDays: 30,
      learningMode: blueprint.learningMode,
      focus: blueprint.focus,
      courses: matchingLegacyPackage?.courses || [],
      softwareExposure: blueprint.softwareExposure,
      outcome: blueprint.outcome,
      purchaseMode: 'self_serve',
      includedPackages: [],
      isActive: true,
    });

    roadmapPackageIdsByName.set(blueprint.name, createdPackage._id);
    roadmapPackagesCreated += 1;
  }

  const enterprisePackage = await SubscriptionPackage.create({
    name: ROADMAP_ENTERPRISE_PACKAGE_BLUEPRINT.name,
    price: null,
    billingOptions: [],
    scheduleDuration: ROADMAP_ENTERPRISE_PACKAGE_BLUEPRINT.scheduleDuration,
    durationDays: null,
    learningMode: ROADMAP_ENTERPRISE_PACKAGE_BLUEPRINT.learningMode,
    focus: ROADMAP_ENTERPRISE_PACKAGE_BLUEPRINT.focus,
    courses: [],
    softwareExposure: ROADMAP_ENTERPRISE_PACKAGE_BLUEPRINT.softwareExposure,
    outcome: ROADMAP_ENTERPRISE_PACKAGE_BLUEPRINT.outcome,
    purchaseMode: 'contact_only',
    includedPackages: [],
    isActive: true,
  });
  roadmapPackageIdsByName.set(enterprisePackage.name, enterprisePackage._id);
  roadmapPackagesCreated += 1;

  const inclusionChains = {
    'Pro Artist': ['Start Smart'],
    'Full Studio': ['Pro Artist'],
    'Semester / Professional Track': ['Full Studio'],
    Enterprise: [],
    'Start Smart': [],
  };

  for (const [packageName, includedNames] of Object.entries(inclusionChains)) {
    const packageId = roadmapPackageIdsByName.get(packageName);
    if (!packageId) {
      continue;
    }

    const includedIds = includedNames
      .map((name) => roadmapPackageIdsByName.get(name))
      .filter(Boolean);

    await SubscriptionPackage.findByIdAndUpdate(packageId, {
      includedPackages: includedIds,
    });
  }

  let legacyPackagesArchived = 0;
  for (const legacyPackage of legacyPackages) {
    if (legacyPackage.isActive) {
      legacyPackage.isActive = false;
      await legacyPackage.save();
      legacyPackagesArchived += 1;
    }
  }

  return {
    billingBackfills,
    sixMonthBackfills,
    roadmapPackagesCreated,
    legacyPackagesArchived,
  };
};
