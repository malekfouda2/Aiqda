import mongoose from 'mongoose';

// A named platform expense line (e.g. "Office rent", "Software licenses").
const expenseSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  amountMinor: { type: Number, default: 0, min: 0 },
}, { _id: false });

// Singleton document holding admin-entered platform-level costs that are not
// captured per transaction (bank transfer fees, itemized operating expenses).
// Stored as integer minor units (halalas) like the rest of the finance ledger.
// These are subtracted in the financial overview's net/platform cash figures.
const financeSettingsSchema = new mongoose.Schema({
  singleton: {
    type: String,
    default: 'finance-settings',
    unique: true,
  },
  bankFeeMinor: { type: Number, default: 0, min: 0 },
  expenses: { type: [expenseSchema], default: [] },
  // Deprecated: superseded by the itemized `expenses` list. Kept so legacy values
  // can be migrated into `expenses` on read.
  otherFeeMinor: { type: Number, default: 0, min: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export default mongoose.model('FinanceSettings', financeSettingsSchema);
