export const BILLING_TERM_LABELS = {
  monthly: 'Monthly',
  annual: 'Annual',
};

export const getActiveBillingOptions = (pkg = {}) => {
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

export const formatMoney = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '';
  }

  return new Intl.NumberFormat('en-US', {
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

  const yearlyMonthlyCost = monthlyOption.price * 12;
  const savings = yearlyMonthlyCost - annualOption.price;
  if (!Number.isFinite(savings) || savings <= 0) {
    return null;
  }

  return {
    savings,
    yearlyMonthlyCost,
    monthlyEquivalent: annualOption.price / 12,
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
