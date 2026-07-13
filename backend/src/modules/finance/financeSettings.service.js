import FinanceSettings from './financeSettings.model.js';
import { fromMinor, toMinor } from './finance.money.js';

// Reads (and lazily creates) the singleton finance-settings document. Migrates a
// legacy single "other fee" into the itemized expenses list on first read.
export const getSettingsDoc = async () => {
  let doc = await FinanceSettings.findOne({ singleton: 'finance-settings' });
  if (!doc) {
    doc = await FinanceSettings.create({ singleton: 'finance-settings' });
  }
  if (doc.otherFeeMinor > 0 && (!doc.expenses || doc.expenses.length === 0)) {
    doc.expenses = [{ label: 'Other', amountMinor: doc.otherFeeMinor }];
    doc.otherFeeMinor = 0;
    await doc.save();
  }
  return doc;
};

// Sum of all expense line items, in minor units.
export const getExpensesTotalMinor = (doc) => (
  (doc.expenses || []).reduce((acc, e) => acc + (e.amountMinor || 0), 0)
);

// Serialized view for API consumers: amounts as decimal SAR.
export const getSettings = async () => {
  const doc = await getSettingsDoc();
  return {
    bankFee: fromMinor(doc.bankFeeMinor),
    expenses: (doc.expenses || []).map((e) => ({ label: e.label, amount: fromMinor(e.amountMinor) })),
    expensesTotal: fromMinor(getExpensesTotalMinor(doc)),
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

// Validates and converts an incoming expenses array to stored (minor-unit) form.
// Drops rows with a blank label AND zero amount; rejects labelled rows with a bad amount.
const normalizeExpenses = (expenses) => {
  if (!Array.isArray(expenses)) {
    return null;
  }
  const result = [];
  for (const row of expenses) {
    const label = String(row?.label || '').trim();
    const amount = Number(row?.amount);
    if (!label && (!row?.amount || amount === 0)) {
      continue;
    }
    if (!label) {
      throw new Error('Each expense must have a name');
    }
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Expense "${label}" must have a non-negative amount`);
    }
    result.push({ label, amountMinor: toMinor(amount) });
    if (result.length >= 50) break;
  }
  return result;
};

// Updates bank fee and/or the itemized expenses list. Only provided fields change.
// Amounts are decimal SAR.
export const updateSettings = async ({ bankFee, expenses, actorId = null } = {}) => {
  const doc = await getSettingsDoc();

  const bankFeeMinor = normalizeFee(bankFee, 'Bank fee');
  const normalizedExpenses = normalizeExpenses(expenses);

  if (bankFeeMinor !== null) doc.bankFeeMinor = bankFeeMinor;
  if (normalizedExpenses !== null) doc.expenses = normalizedExpenses;
  doc.updatedBy = actorId;

  await doc.save();
  return getSettings();
};
