import mongoose from 'mongoose';

const instructorApplicationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  nationality: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  phoneCode: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  educationLevel: {
    type: String,
    required: true,
    enum: ['Bachelor Degree', 'Masters Degree', 'PhD', 'Other']
  },
  fieldOfStudy: {
    type: String,
    required: true
  },
  yearsOfExperience: {
    type: String,
    required: true
  },
  specialization: {
    type: [String],
    required: true
  },
  previousTeachingExperience: {
    type: String
  },
  softwareProficiency: {
    type: String,
    required: true
  },
  institutionsOrStudios: {
    type: String
  },
  notableWorks: {
    type: String
  },
  websiteOrPortfolio: {
    type: String
  },
  cvFile: {
    type: String
  },
  teachingStyle: {
    type: String
  },
  studentGuidance: {
    type: String
  },
  existingCourseMaterials: {
    type: String
  },
  courseMaterialsFile: {
    type: String
  },
  preferredSchedule: {
    type: String,
    required: true
  },
  earliestStartDate: {
    type: Date,
    required: true
  },
  additionalComments: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

export default mongoose.model('InstructorApplication', instructorApplicationSchema);
