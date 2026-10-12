import mongoose from 'mongoose';

// One chapter line of a creator's monthly statement. Amounts integer minor units.
// Member figures are plain counts: no member identities are ever stored here.
const statementChapterSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  courseTitleSnapshot: { type: String, default: '' },
  calculatedMinor: { type: Number, default: 0 },
  // New members who completed 80% in this month, and money lost to an exhausted payment pool.
  winsCount: { type: Number, default: 0 },
  cappedMinor: { type: Number, default: 0 },
  finalMinor: { type: Number, default: 0 },
  enrolledCount: { type: Number, default: 0 },
  reachedCount: { type: Number, default: 0 },
  notYetCount: { type: Number, default: 0 },
}, { _id: false });

// The version the creator sees. Written only when an admin finalizes, so a reopened
// statement keeps showing the last finalized figures until it is finalized again.
const publishedStatementSchema = new mongoose.Schema({
  chapters: { type: [statementChapterSchema], default: [] },
  finalTotalMinor: { type: Number, default: 0 },
  note: { type: String, default: '' },
  finalizedAt: { type: Date, default: null },
  revision: { type: Number, default: 0 },
}, { _id: false });

// A creator's revenue statement for one calendar month (`period` = YYYY-MM).
// While `draft` it only stores the admin's overrides; calculated figures are refreshed
// on every read. Finalizing freezes everything into `published`.
const creatorStatementSchema = new mongoose.Schema({
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  period: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  currency: { type: String, default: 'SAR' },
  status: {
    type: String,
    enum: ['draft', 'finalized'],
    default: 'draft',
  },
  // Admin overrides while drafting: only chapters whose amount the admin changed.
  overrides: [{
    _id: false,
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    finalMinor: { type: Number, required: true, min: 0 },
  }],
  note: { type: String, default: '', trim: true, maxlength: 2000 },
  revision: { type: Number, default: 0 },
  finalizedAt: { type: Date, default: null },
  finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  published: { type: publishedStatementSchema, default: null },
}, { timestamps: true });

creatorStatementSchema.index({ instructor: 1, period: 1 }, { unique: true });

export default mongoose.model('CreatorStatement', creatorStatementSchema);
