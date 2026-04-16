import { SubscriptionPackage } from '../modules/subscriptions/subscription.model.js';
import {
  buildSelfServeBillingOptions,
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

export const syncSubscriptionPackageRoadmap = async () => {
  const packages = await SubscriptionPackage.find({});
  if (packages.length === 0) {
    return {
      billingBackfills: 0,
      roadmapPackagesCreated: 0,
      legacyPackagesArchived: 0,
    };
  }

  let billingBackfills = 0;
  for (const pkg of packages) {
    if (!needsLegacyBillingBackfill(pkg)) {
      continue;
    }

    pkg.billingOptions = [
      {
        term: 'monthly',
        label: 'Monthly',
        price: Number(pkg.price),
        durationDays: Number(pkg.durationDays) || 30,
        isActive: true,
      },
    ];
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
      roadmapPackagesCreated: 0,
      legacyPackagesArchived: 0,
    };
  }

  const legacyPackages = refreshedPackages.filter((pkg) => LEGACY_SUBSCRIPTION_PACKAGE_NAMES.includes(pkg.name));
  if (legacyPackages.length === 0) {
    return {
      billingBackfills,
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
    roadmapPackagesCreated,
    legacyPackagesArchived,
  };
};
