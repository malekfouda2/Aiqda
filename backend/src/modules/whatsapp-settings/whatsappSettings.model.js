import mongoose from 'mongoose';

const whatsappSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'global',
    unique: true,
    immutable: true,
    trim: true,
  },
  isEnabled: {
    type: Boolean,
    default: false,
  },
  englishNumber: {
    type: String,
    default: '',
    trim: true,
  },
  arabicNumber: {
    type: String,
    default: '',
    trim: true,
  },
}, {
  timestamps: true,
});

export default mongoose.model('WhatsAppSettings', whatsappSettingsSchema);
