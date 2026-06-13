import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import Payment from '../src/modules/payments/payment.model.js';
import User from '../src/modules/users/user.model.js';
import {
  authHeader,
  createCourse,
  createInstructorApplicationPayload,
  createSubscription,
  createSubscriptionPackage,
  createUser,
  setupIntegrationSuite
} from './helpers/integration.js';

const suite = setupIntegrationSuite();

test('requesting an annual subscription stores the selected billing term and validates the annual amount', async () => {
  const student = await createUser({ role: 'student' });
  const packageRecord = await createSubscriptionPackage({
    billingOptions: [
      { term: 'monthly', label: 'Monthly', price: 299, durationDays: 30, isActive: true },
      { term: 'annual', label: 'Annual', price: 2799, durationDays: 365, isActive: true },
    ],
  });

  const subscriptionResponse = await request(suite.app)
    .post('/api/subscriptions/request')
    .set(authHeader(student.token))
    .send({
      packageId: packageRecord._id.toString(),
      billingTerm: 'annual',
    });

  assert.equal(subscriptionResponse.status, 201);
  assert.equal(subscriptionResponse.body.billingTerm, 'annual');
  assert.equal(subscriptionResponse.body.priceAtPurchase, 2799);
  assert.equal(subscriptionResponse.body.durationDaysSnapshot, 365);
});

test('requesting a 6-month subscription stores the selected billing term and validates the 6-month amount', async () => {
  const student = await createUser({ role: 'student' });
  const packageRecord = await createSubscriptionPackage({
    billingOptions: [
      { term: 'monthly', label: 'Monthly', price: 299, durationDays: 30, isActive: true },
      { term: 'six_months', label: '6 Months', price: 1599, durationDays: 180, isActive: true },
      { term: 'annual', label: 'Annual', price: 2799, durationDays: 365, isActive: true },
    ],
  });

  const subscriptionResponse = await request(suite.app)
    .post('/api/subscriptions/request')
    .set(authHeader(student.token))
    .send({
      packageId: packageRecord._id.toString(),
      billingTerm: 'six_months',
    });

  assert.equal(subscriptionResponse.status, 201);
  assert.equal(subscriptionResponse.body.billingTerm, 'six_months');
  assert.equal(subscriptionResponse.body.priceAtPurchase, 1599);
  assert.equal(subscriptionResponse.body.durationDaysSnapshot, 180);
});

test('requesting a subscription with a sale stores the discounted purchase amount', async () => {
  const student = await createUser({ role: 'student' });
  const packageRecord = await createSubscriptionPackage({
    billingOptions: [
      { term: 'monthly', label: 'Monthly', price: 299, salePrice: 249, durationDays: 30, isActive: true },
      { term: 'six_months', label: '6 Months', price: 1599, salePrice: 1299, durationDays: 180, isActive: true },
      { term: 'annual', label: 'Annual', price: 2799, salePrice: 2199, durationDays: 365, isActive: true },
    ],
  });

  const subscriptionResponse = await request(suite.app)
    .post('/api/subscriptions/request')
    .set(authHeader(student.token))
    .send({
      packageId: packageRecord._id.toString(),
      billingTerm: 'six_months',
    });

  assert.equal(subscriptionResponse.status, 201);
  assert.equal(subscriptionResponse.body.billingTerm, 'six_months');
  assert.equal(subscriptionResponse.body.priceAtPurchase, 1299);
  assert.equal(subscriptionResponse.body.durationDaysSnapshot, 180);
});

test('instructor analytics returns allocated revenue from successful subscription payments', async () => {
  const instructor = await createUser({ role: 'instructor' });
  const student = await createUser({ role: 'student' });
  const course = await createCourse({
    instructorId: instructor.user._id,
    isPublished: true,
    title: 'Revenue Course'
  });
  const packageRecord = await createSubscriptionPackage({
    price: 750,
    courses: [course._id]
  });
  const subscription = await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)),
    priceAtPurchase: 750,
  });

  await Payment.create({
    user: student.user._id,
    subscription: subscription._id,
    amount: 750,
    currency: 'SAR',
    provider: 'tap',
    status: 'captured',
    paymentType: 'initial',
    checkoutMethod: 'card',
    paymentReference: '240000000000501',
    checkoutDisclaimerVersion: 'POL-0015',
    checkoutDisclaimerAcceptedAt: new Date(),
  });

  const analyticsResponse = await request(suite.app)
    .get('/api/analytics/instructor')
    .set(authHeader(instructor.token));

  assert.equal(analyticsResponse.status, 200);
  assert.equal(analyticsResponse.body.totalRevenue, 750);
  assert.equal(analyticsResponse.body.publishedCourses, 1);
  assert.equal(analyticsResponse.body.draftCourses, 0);
  assert.equal(analyticsResponse.body.totalLessons, 0);
  assert.equal(analyticsResponse.body.videosAssigned, 0);
  assert.equal(analyticsResponse.body.videosPending, 0);
  assert.equal(analyticsResponse.body.avgWatchPercentage, 0);
  assert.equal(analyticsResponse.body.quizPassRate, 0);
  assert.equal(analyticsResponse.body.revenueCalculation.placeholder, false);
  assert.match(
    analyticsResponse.body.revenueCalculation.methodology,
    /successful subscription payments/i
  );
  assert.equal(analyticsResponse.body.courseStats.length, 1);
  assert.equal(analyticsResponse.body.courseStats[0].estimatedRevenue, 750);
  assert.equal(analyticsResponse.body.courseStats[0].isPublished, true);
  assert.equal(analyticsResponse.body.courseStats[0].avgWatchPercentage, 0);
  assert.equal(analyticsResponse.body.courseStats[0].videosAssigned, 0);
  assert.equal(analyticsResponse.body.courseStats[0].videosPending, 0);
  assert.equal(analyticsResponse.body.courseStats[0].quizPassRate, 0);
});

test('approved instructor applications require invite acceptance before login works', async () => {
  const admin = await createUser({ role: 'admin' });
  const applicationPayload = createInstructorApplicationPayload({
    email: 'pending-instructor@example.com'
  });

  const submitResponse = await request(suite.app)
    .post('/api/instructor-applications')
    .field('email', applicationPayload.email)
    .field('fullName', applicationPayload.fullName)
    .field('nationality', applicationPayload.nationality)
    .field('country', applicationPayload.country)
    .field('city', applicationPayload.city)
    .field('phoneCode', applicationPayload.phoneCode)
    .field('phoneNumber', applicationPayload.phoneNumber)
    .field('educationLevel', applicationPayload.educationLevel)
    .field('fieldOfStudy', applicationPayload.fieldOfStudy)
    .field('yearsOfExperience', applicationPayload.yearsOfExperience)
    .field('specialization', applicationPayload.specialization[0])
    .field('previousTeachingExperience', applicationPayload.previousTeachingExperience)
    .field('softwareProficiency', applicationPayload.softwareProficiency)
    .field('institutionsOrStudios', applicationPayload.institutionsOrStudios)
    .field('notableWorks', applicationPayload.notableWorks)
    .field('websiteOrPortfolio', applicationPayload.websiteOrPortfolio)
    .field('teachingStyle', applicationPayload.teachingStyle)
    .field('studentGuidance', applicationPayload.studentGuidance)
    .field('existingCourseMaterials', applicationPayload.existingCourseMaterials)
    .field('preferredSchedule', applicationPayload.preferredSchedule)
    .field('earliestStartDate', applicationPayload.earliestStartDate)
    .field('additionalComments', applicationPayload.additionalComments)
    .field('creatorAgreementAccepted', 'true');
  assert.equal(submitResponse.status, 201);
  assert.equal(submitResponse.body.creatorTermsVersion, 'POL-0016');
  assert.ok(submitResponse.body.creatorTermsAcceptedAt);

  const approveResponse = await request(suite.app)
    .patch(`/api/instructor-applications/${submitResponse.body._id}/approve`)
    .set(authHeader(admin.token));
  assert.equal(approveResponse.status, 200);
  assert.ok(approveResponse.body.setupLink);

  const invitedUser = await User.findOne({ email: applicationPayload.email });
  assert.ok(invitedUser);
  assert.equal(invitedUser.role, 'instructor');
  assert.equal(invitedUser.mustChangePassword, true);

  const blockedLoginResponse = await request(suite.app)
    .post('/api/auth/login')
    .send({ email: applicationPayload.email, password: 'Password123!' });
  assert.equal(blockedLoginResponse.status, 401);
  assert.match(blockedLoginResponse.body.error, /account setup is still pending/i);

  const setupLink = new URL(approveResponse.body.setupLink);
  const inviteToken = setupLink.searchParams.get('token');
  assert.ok(inviteToken);

  const acceptInviteResponse = await request(suite.app)
    .post('/api/auth/invite/accept')
    .send({ token: inviteToken, password: 'NewInstructor123!' });
  assert.equal(acceptInviteResponse.status, 200);

  const loginResponse = await request(suite.app)
    .post('/api/auth/login')
    .send({ email: applicationPayload.email, password: 'NewInstructor123!' });
  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.body.user.role, 'instructor');
  assert.equal(loginResponse.body.user.mustChangePassword, false);
});

test('creator agreement acknowledgement is required before submitting an instructor application', async () => {
  const applicationPayload = createInstructorApplicationPayload({
    email: 'creator-agreement-required@example.com'
  });

  const submitResponse = await request(suite.app)
    .post('/api/instructor-applications')
    .field('email', applicationPayload.email)
    .field('fullName', applicationPayload.fullName)
    .field('nationality', applicationPayload.nationality)
    .field('country', applicationPayload.country)
    .field('city', applicationPayload.city)
    .field('phoneCode', applicationPayload.phoneCode)
    .field('phoneNumber', applicationPayload.phoneNumber)
    .field('educationLevel', applicationPayload.educationLevel)
    .field('fieldOfStudy', applicationPayload.fieldOfStudy)
    .field('yearsOfExperience', applicationPayload.yearsOfExperience)
    .field('specialization', applicationPayload.specialization[0])
    .field('previousTeachingExperience', applicationPayload.previousTeachingExperience)
    .field('softwareProficiency', applicationPayload.softwareProficiency)
    .field('institutionsOrStudios', applicationPayload.institutionsOrStudios)
    .field('notableWorks', applicationPayload.notableWorks)
    .field('websiteOrPortfolio', applicationPayload.websiteOrPortfolio)
    .field('teachingStyle', applicationPayload.teachingStyle)
    .field('studentGuidance', applicationPayload.studentGuidance)
    .field('existingCourseMaterials', applicationPayload.existingCourseMaterials)
    .field('preferredSchedule', applicationPayload.preferredSchedule)
    .field('earliestStartDate', applicationPayload.earliestStartDate)
    .field('additionalComments', applicationPayload.additionalComments);

  assert.equal(submitResponse.status, 400);
  assert.equal(
    submitResponse.body.error,
    'Please accept the creator agreement disclaimer before submitting your application.'
  );
});
