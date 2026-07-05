import FinanceSettings from './financeSettings.model.js';
import { fromMinor, toMinor } from './finance.money.js';

// Reads (and lazily creates) the singleton finance-settings document.
export const getSettingsDoc = async () => {
  let doc = await FinanceSettings.findOne({ singleton: 'finance-settings' });
  if (!doc) {
    doc = await FinanceSettings.create({ singleton: 'finance-settings' });
  }
  return doc;
};

// Serialized view for API consumers: fees as decimal SAR.
export const getSettings = async () => {
  const doc = await getSettingsDoc();
  return {
    bankFee: fromMinor(doc.bankFeeMinor),
    otherFee: fromMinor(doc.otherFeeMinor),
    updatedAt: doc.updatedAt,
    currency: 'SAR',
  };
};

const normalizeFee = (value, label) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return toMinor(amount);
};

// Updates bank/other fees. Only provided fields are changed. Amounts are decimal SAR.
export const updateSettings = async ({ bankFee, otherFee, actorId = null } = {}) => {
  const doc = await getSettingsDoc();

  const bankFeeMinor = normalizeFee(bankFee, 'Bank fee');
  const otherFeeMinor = normalizeFee(otherFee, 'Other fee');

  if (bankFeeMinor !== null) doc.bankFeeMinor = bankFeeMinor;
  if (otherFeeMinor !== null) doc.otherFeeMinor = otherFeeMinor;
  doc.updatedBy = actorId;

  await doc.save();
  return getSettings();
};
