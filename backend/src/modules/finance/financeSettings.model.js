import mongoose from 'mongoose';

// Singleton document holding admin-entered platform-level fees that are not
// captured per transaction (bank transfer fees, misc operating fees). Stored as
// integer minor units (halalas) like the rest of the finance ledger. These are
// subtracted in the financial overview's net/platform cash figures.
const financeSettingsSchema = new mongoose.Schema({
  singleton: {
    type: String,
    default: 'finance-settings',
    unique: true,
  },
  bankFeeMinor: { type: Number, default: 0, min: 0 },
  otherFeeMinor: { type: Number, default: 0, min: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export default mongoose.model('FinanceSettings', financeSettingsSchema);
