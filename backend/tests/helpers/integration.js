import { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

import User from '../../src/modules/users/user.model.js';
import Course from '../../src/modules/courses/course.model.js';
import Lesson from '../../src/modules/lessons/lesson.model.js';
import Quiz from '../../src/modules/quizzes/quiz.model.js';
import { LessonProgress, CourseProgress } from '../../src/modules/analytics/progress.model.js';
import { SubscriptionPackage, Subscription } from '../../src/modules/subscriptions/subscription.model.js';
import Consultation from '../../src/modules/consultations/consultation.model.js';
import { clearRateLimitStore } from '../../src/middlewares/rateLimit.middleware.js';
import { hashPassword } from '../../src/utils/password.js';
import { generateToken } from '../../src/utils/jwt.js';

const DEFAULT_TEST_MONGODB_URI = 'mongodb://127.0.0.1:27017/aiqda';

const buildTestMongoUri = (baseUri, dbName) => {
  const queryIndex = baseUri.indexOf('?');
  const uriWithoutQuery = queryIndex >= 0 ? baseUri.slice(0, queryIndex) : baseUri;
  const queryString = queryIndex >= 0 ? baseUri.slice(queryIndex) : '';

  if (/\/[^/]+$/.test(uriWithoutQuery)) {
    return uriWithoutQuery.replace(/\/[^/]+$/, `/${dbName}`) + queryString;
  }

  return `${uriWithoutQuery.replace(/\/$/, '')}/${dbName}${queryString}`;
};

const getTestMongoUri = () => {
  const baseUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || DEFAULT_TEST_MONGODB_URI;
  return buildTestMongoUri(baseUri, `aiqda_test_${randomUUID()}`);
};

export const setupIntegrationSuite = () => {
  let app = null;

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5000';
    process.env.EMAIL_FROM = process.env.EMAIL_FROM || 'Aiqda Test <no-reply@aiqda.local>';

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await mongoose.connect(getTestMongoUri());
    ({ default: app } = await import('../../src/app.js'));
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    clearRateLimitStore();
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    }
  });

  return {
    get app() {
      return app;
    }
  };
};

export const createUser = async (overrides = {}) => {
  const password = overrides.password || 'Password123!';
  const user = await User.create({
    email: overrides.email || `user-${randomUUID()}@example.com`,
    password: await hashPassword(password),
    name: overrides.name || 'Test User',
    role: overrides.role || 'student',
    avatar: overrides.avatar || null,
    isActive: overrides.isActive ?? true,
    mustChangePassword: overrides.mustChangePassword ?? false,
  });

  return {
    user,
    password,
    token: generateToken({ id: user._id, email: user.email, role: user.role })
  };
};

export const authHeader = (token) => ({
  Authorization: `Bearer ${token}`
});

export const createCourse = async (overrides = {}) => {
  const instructorId = overrides.instructorId || (await createUser({ role: 'instructor' })).user._id;

  return Course.create({
    title: overrides.title || 'Test Course',
    description: overrides.description || 'Test course description',
    instructor: instructorId,
    thumbnail: overrides.thumbnail || null,
    category: overrides.category || 'General',
    level: overrides.level || 'beginner',
    isPublished: overrides.isPublished ?? true,
    enrolledStudents: overrides.enrolledStudents || [],
    lessonsCount: overrides.lessonsCount || 0
  });
};

export const createLesson = async (overrides = {}) => {
  if (!overrides.course) {
    throw new Error('createLesson requires a course id');
  }

  return Lesson.create({
    title: overrides.title || 'Test Lesson',
    description: overrides.description || 'Test lesson description',
    course: overrides.course,
    order: overrides.order || 1,
    vimeoVideoId: overrides.vimeoVideoId || null,
    minimumWatchPercentage: overrides.minimumWatchPercentage || 80,
    supportingFile: overrides.supportingFile || null,
    supportingFileName: overrides.supportingFileName || null,
    duration: overrides.duration || 600,
    isPublished: overrides.isPublished ?? false
  });
};

export const createQuiz = async (overrides = {}) => {
  if (!overrides.lesson) {
    throw new Error('createQuiz requires a lesson id');
  }

  return Quiz.create({
    lesson: overrides.lesson,
    questions: overrides.questions || [
      {
        question: 'What is 2 + 2?',
        options: ['3', '4', '5'],
        correctAnswer: 1
      }
    ],
    passingScore: overrides.passingScore || 1
  });
};

export const createLessonProgress = async (overrides = {}) => {
  if (!overrides.user || !overrides.lesson || !overrides.course) {
    throw new Error('createLessonProgress requires user, lesson, and course ids');
  }

  return LessonProgress.create({
    user: overrides.user,
    lesson: overrides.lesson,
    course: overrides.course,
    watchPercentage: overrides.watchPercentage ?? 0,
    quizPassed: overrides.quizPassed ?? false,
    quizScore: overrides.quizScore ?? 0,
    quizAttempts: overrides.quizAttempts ?? 0,
    isQualified: overrides.isQualified ?? false,
    completedAt: overrides.completedAt ?? null,
    lastWatchedAt: overrides.lastWatchedAt ?? new Date(),
  });
};

export const createCourseProgress = async (overrides = {}) => {
  if (!overrides.user || !overrides.course) {
    throw new Error('createCourseProgress requires user and course ids');
  }

  return CourseProgress.create({
    user: overrides.user,
    course: overrides.course,
    completedLessons: overrides.completedLessons ?? 0,
    totalLessons: overrides.totalLessons ?? 0,
    progressPercentage: overrides.progressPercentage ?? 0,
    isCompleted: overrides.isCompleted ?? false,
    startedAt: overrides.startedAt ?? new Date(),
    completedAt: overrides.completedAt ?? null,
  });
};

export const createSubscriptionPackage = async (overrides = {}) => {
  return SubscriptionPackage.create({
    name: overrides.name || 'Standard Plan',
    price: overrides.price || 499,
    scheduleDuration: overrides.scheduleDuration || '1 month',
    durationDays: overrides.durationDays || 30,
    learningMode: overrides.learningMode || 'Online',
    focus: overrides.focus || 'Skill building',
    courses: overrides.courses || [],
    softwareExposure: overrides.softwareExposure || ['AutoCAD'],
    outcome: overrides.outcome || 'Confident learner',
    isActive: overrides.isActive ?? true
  });
};

export const createSubscription = async (overrides = {}) => {
  if (!overrides.user || !overrides.package) {
    throw new Error('createSubscription requires user and package ids');
  }

  return Subscription.create({
    user: overrides.user,
    package: overrides.package,
    status: overrides.status || 'pending',
    startDate: overrides.startDate || null,
    endDate: overrides.endDate || null,
    approvedBy: overrides.approvedBy || null,
    approvedAt: overrides.approvedAt || null
  });
};

export const createConsultation = async (overrides = {}) => {
  return Consultation.create({
    title: overrides.title || 'Strategy Session',
    description: overrides.description || 'A focused consultation session.',
    priceType: overrides.priceType || 'fixed',
    price: overrides.price ?? 250,
    currency: overrides.currency || 'SAR',
    duration: overrides.duration || '30 minutes',
    mode: overrides.mode || '1 to 1',
    focusPoints: overrides.focusPoints || ['Direction', 'Feedback'],
    zoomSchedulerLink: overrides.zoomSchedulerLink || 'https://scheduler.example.com/consultation',
    isActive: overrides.isActive ?? true,
    order: overrides.order ?? 1,
  });
};

export const createInstructorApplicationPayload = (overrides = {}) => ({
  email: overrides.email || `instructor-${randomUUID()}@example.com`,
  fullName: overrides.fullName || 'Test Instructor',
  nationality: overrides.nationality || 'Egyptian',
  country: overrides.country || 'Egypt',
  city: overrides.city || 'Cairo',
  phoneCode: overrides.phoneCode || '+20',
  phoneNumber: overrides.phoneNumber || '1000000000',
  educationLevel: overrides.educationLevel || 'Bachelor Degree',
  fieldOfStudy: overrides.fieldOfStudy || 'Architecture',
  yearsOfExperience: overrides.yearsOfExperience || '5',
  specialization: overrides.specialization || ['Design'],
  previousTeachingExperience: overrides.previousTeachingExperience || 'Workshop mentoring',
  softwareProficiency: overrides.softwareProficiency || 'AutoCAD, Revit',
  institutionsOrStudios: overrides.institutionsOrStudios || 'Studio Alpha',
  notableWorks: overrides.notableWorks || 'Residential projects',
  websiteOrPortfolio: overrides.websiteOrPortfolio || 'https://example.com/portfolio',
  teachingStyle: overrides.teachingStyle || 'Hands-on',
  studentGuidance: overrides.studentGuidance || 'Project based',
  existingCourseMaterials: overrides.existingCourseMaterials || 'Slides and exercises',
  preferredSchedule: overrides.preferredSchedule || 'Evenings',
  earliestStartDate: overrides.earliestStartDate || '2026-05-01T00:00:00.000Z',
  additionalComments: overrides.additionalComments || 'Ready to start soon'
});

export const createStudioApplicationPayload = (overrides = {}) => ({
  studioName: overrides.studioName || 'Studio Alpha',
  contactEmail: overrides.contactEmail || `studio-${randomUUID()}@example.com`,
  yearEstablished: overrides.yearEstablished || '2019',
  countryOfRegistration: overrides.countryOfRegistration || 'Saudi Arabia',
  websitePortfolio: overrides.websitePortfolio || 'https://example.com/studio-alpha',
  studioType: overrides.studioType || 'Animation Studio',
  videoResolutionAck: overrides.videoResolutionAck ?? true,
  videoFileSizes: overrides.videoFileSizes || ['Under 2 GB'],
  videoFormats: overrides.videoFormats || ['MP4'],
  frameRates: overrides.frameRates || ['24 fps'],
  audioSpecAck: overrides.audioSpecAck ?? true,
  audioFrequencyAck: overrides.audioFrequencyAck ?? true,
  domains: overrides.domains || ['2D Animation'],
  objectives: overrides.objectives || ['Strategic partnership'],
});
