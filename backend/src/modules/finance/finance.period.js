// Statement months follow the platform's business timezone (Asia/Riyadh, UTC+3, no DST).
// A period is a calendar month written as YYYY-MM.
const BUSINESS_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

export const parsePeriod = (period) => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(period || ''));
  if (!match) throw new Error('Period must be a month in YYYY-MM format.');
  return { year: Number(match[1]), month: Number(match[2]) };
};

// [start, end) of a statement month as UTC instants.
export const periodBounds = (period) => {
  const { year, month } = parsePeriod(period);
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - BUSINESS_UTC_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - BUSINESS_UTC_OFFSET_MS),
  };
};

// The statement month an instant falls in.
export const periodOf = (date) => {
  const shifted = new Date(new Date(date).getTime() + BUSINESS_UTC_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const hasPeriodEnded = (period, now = new Date()) => periodBounds(period).end <= now;
