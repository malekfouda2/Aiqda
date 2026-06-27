import mongoose from 'mongoose';

// In-app notification. One document per recipient per event. `link` is a relative
// frontend path the bell navigates to when the notification is clicked.
const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    trim: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  titleAr: {
    type: String,
    default: '',
    trim: true,
  },
  message: {
    type: String,
    default: '',
    trim: true,
  },
  messageAr: {
    type: String,
    default: '',
    trim: true,
  },
  link: {
    type: String,
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

export default mongoose.model('Notification', notificationSchema);
