import { getLocalizedValue, text } from '../i18n/translations';

export const BILLING_TERM_LABELS = {
  monthly: text('Monthly', 'شهري'),
  six_months: text('6 Months', '6 أشهر'),
  annual: text('Annual', 'سنوي'),
};

const BILLING_TERM_ORDER = {
  monthly: 0,
  six_months: 1,
  annual: 2,
};

export const BILLING_TERM_CADENCE_LABELS = {
  monthly: text('per month', 'شهريًا'),
  six_months: text('per 6 months', 'كل 6 أشهر'),
  annual: text('per year', 'سنويًا'),
};

export const getBillingTermLabel = (term, locale = 'en') => {
  if (!term) {
    return '';
  }

  return getLocalizedValue(BILLING_TERM_LABELS[term] || term, locale);
};

export const getActiveBillingOptions = (pkg = {}) => {
  if (!Array.isArray(pkg.billingOptions)) {
    return [];
  }

  return pkg.billingOptions
    .filter((option) => option && option.term && option.isActive !== false)
    .sort((a, b) => {
      const aRank = BILLING_TERM_ORDER[a.term] ?? Number.MAX_SAFE_INTEGER;
      const bRank = BILLING_TERM_ORDER[b.term] ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank;
    });
};

export const getDefaultBillingTerm = (pkg = {}) => {
  const activeOptions = getActiveBillingOptions(pkg);
  return activeOptions.find((option) => option.term === 'monthly')?.term
    || activeOptions[0]?.term
    || null;
};

export const getBillingOption = (pkg = {}, billingTerm = null) => {
  const activeOptions = getActiveBillingOptions(pkg);
  if (!billingTerm) {
    return activeOptions.find((option) => option.term === 'monthly') || activeOptions[0] || null;
  }

  return activeOptions.find((option) => option.term === billingTerm) || null;
};

export const getBillingCadenceLabel = (term, locale = 'en') => (
  getLocalizedValue(BILLING_TERM_CADENCE_LABELS[term] || term, locale)
);

export const getEffectiveBillingPrice = (option = {}) => {
  const basePrice = Number(option?.price);
  const salePrice = Number(option?.salePrice);

  if (
    Number.isFinite(basePrice)
    && Number.isFinite(salePrice)
    && salePrice > 0
    && salePrice < basePrice
  ) {
    return salePrice;
  }

  return basePrice;
};

export const hasBillingSale = (option = {}) => (
  getEffectiveBillingPrice(option) !== Number(option?.price)
);

export const getBillingSalePercentage = (option = {}) => {
  if (!hasBillingSale(option)) {
    return 0;
  }

  const basePrice = Number(option.price);
  const salePrice = getEffectiveBillingPrice(option);
  const percentage = Math.round(((basePrice - salePrice) / basePrice) * 100);

  return Number.isFinite(percentage) && percentage > 0 ? percentage : 0;
};

export const getBillingSaleAmount = (option = {}) => {
  if (!hasBillingSale(option)) {
    return 0;
  }

  return Number(option.price) - getEffectiveBillingPrice(option);
};

export const getPackageSaleSummary = (pkg = {}) => {
  const saleOptions = getActiveBillingOptions(pkg)
    .filter((option) => hasBillingSale(option))
    .map((option) => ({
      ...option,
      salePercentage: getBillingSalePercentage(option),
    }));

  if (saleOptions.length === 0) {
    return null;
  }

  const bestSale = saleOptions.reduce((currentBest, option) => (
    option.salePercentage > currentBest.salePercentage ? option : currentBest
  ), saleOptions[0]);

  return {
    count: saleOptions.length,
    bestSalePercentage: bestSale.salePercentage,
    terms: saleOptions.map((option) => option.term),
  };
};

export const formatMoney = (value, locale = 'en') => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '';
  }

  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
};

export const getAnnualSavings = (pkg = {}) => {
  const monthlyOption = getBillingOption(pkg, 'monthly');
  const annualOption = getBillingOption(pkg, 'annual');

  if (!monthlyOption || !annualOption) {
    return null;
  }

  const yearlyMonthlyCost = getEffectiveBillingPrice(monthlyOption) * 12;
  const savings = yearlyMonthlyCost - getEffectiveBillingPrice(annualOption);
  if (!Number.isFinite(savings) || savings <= 0) {
    return null;
  }

  return {
    savings,
    yearlyMonthlyCost,
    monthlyEquivalent: getEffectiveBillingPrice(annualOption) / 12,
  };
};

export const getPackageAccessNames = (pkg = {}) => {
  const visited = new Set();
  const names = [];

  const visitPackage = (entry) => {
    if (!entry) {
      return;
    }

    const id = entry._id || entry.name;
    const normalizedId = id?.toString?.() || '';
    if (normalizedId && visited.has(normalizedId)) {
      return;
    }

    if (normalizedId) {
      visited.add(normalizedId);
    }

    if (entry.name) {
      names.push(entry.name);
    }

    (entry.includedPackages || []).forEach(visitPackage);
  };

  visitPackage(pkg);
  return names;
};

export const getPackageCourseIds = (pkg = {}, packages = []) => {
  const packageLookup = new Map(
    (packages || [])
      .filter((entry) => entry?._id)
      .map((entry) => [entry._id.toString(), entry])
  );

  const visited = new Set();
  const courseIds = new Set();

  const visitPackage = (entry) => {
    if (!entry) {
      return;
    }

    const rawId = entry._id || entry;
    const normalizedId = rawId?.toString?.() || '';
    if (normalizedId && visited.has(normalizedId)) {
      return;
    }

    if (normalizedId) {
      visited.add(normalizedId);
    }

    const resolvedPackage = (normalizedId && packageLookup.get(normalizedId)) || entry;

    (resolvedPackage.courses || []).forEach((course) => {
      const courseId = course?._id?.toString?.() || course?.toString?.();
      if (courseId) {
        courseIds.add(courseId);
      }
    });

    (resolvedPackage.includedPackages || []).forEach(visitPackage);
  };

  visitPackage(pkg);

  return [...courseIds];
};
