// All ledger money is stored as integer minor units (halalas for SAR).
// Percentages are basis points: 3000 = 30%, 8000 = 80%, 10000 = 100%.

export const INSTRUCTOR_POOL_BPS = 3000;
export const PLATFORM_BPS = 7000;
export const COMPLETION_THRESHOLD_BPS = 8000;
export const FULL_BPS = 10000;

// Decimal SAR (existing Payment.amount) -> integer minor units.
export const toMinor = (decimalAmount) => Math.round(Number(decimalAmount || 0) * 100);

// Integer minor units -> decimal number (for display/serialization).
export const fromMinor = (minorAmount) => Math.round(Number(minorAmount || 0)) / 100;

// Apply a basis-point fraction to an integer minor amount, floored to an integer.
export const applyBps = (minorAmount, bps) => Math.floor((Number(minorAmount || 0) * Number(bps || 0)) / FULL_BPS);

// Largest-remainder split of `totalMinor` across the given basis-point weights.
// Guarantees the parts sum exactly to applyBps(totalMinor, sum(weightsBps)) (the capped pool),
// never exceeding it. Returns an array of integer minor amounts aligned to `weightsBps`.
export const splitByWeights = (totalMinor, weightsBps) => {
  const weights = weightsBps.map((w) => Number(w || 0));
  const weightSum = weights.reduce((acc, w) => acc + w, 0);
  if (weightSum <= 0) {
    return weights.map(() => 0);
  }

  const cappedTotal = applyBps(totalMinor, Math.min(weightSum, FULL_BPS));
  const raw = weights.map((w) => (cappedTotal * w) / weightSum);
  const floored = raw.map((value) => Math.floor(value));
  let remainder = cappedTotal - floored.reduce((acc, value) => acc + value, 0);

  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < order.length && remainder > 0; i += 1) {
    floored[order[i].index] += 1;
    remainder -= 1;
  }

  return floored;
};
