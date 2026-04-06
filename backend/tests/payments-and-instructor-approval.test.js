import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import User from '../src/modules/users/user.model.js';
import { Subscription } from '../src/modules/subscriptions/subscription.model.js';
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

test('payment submission validates proof and amount before creating a payment', async () => {
  const student = await createUser({ role: 'student' });
  const packageRecord = await createSubscriptionPackage({ price: 499 });
  const subscription = await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'pending'
  });

  const missingProofResponse = await request(suite.app)
    .post('/api/payments')
    .set(authHeader(student.token))
    .field('subscriptionId', subscription._id.toString())
    .field('amount', '499')
    .field('paymentReference', 'PAY-001');
  assert.equal(missingProofResponse.status, 400);
  assert.equal(missingProofResponse.body.error, 'Payment proof is required');

  const wrongAmountResponse = await request(suite.app)
    .post('/api/payments')
    .set(authHeader(student.token))
    .field('subscriptionId', subscription._id.toString())
    .field('amount', '100')
    .field('paymentReference', 'PAY-002')
    .attach('proofFile', Buffer.from('%PDF-test-proof'), {
      filename: 'proof.pdf',
      contentType: 'application/pdf'
    });
  assert.equal(wrongAmountResponse.status, 400);
  assert.match(wrongAmountResponse.body.error, /must match the package price/i);
});

test('payment access is restricted and admin approval activates the subscription', async () => {
  const admin = await createUser({ role: 'admin' });
  const owner = await createUser({ role: 'student' });
  const otherStudent = await createUser({ role: 'student' });
  const packageRecord = await createSubscriptionPackage({ price: 599, durationDays: 45 });
  const subscription = await createSubscription({
    user: owner.user._id,
    package: packageRecord._id,
    status: 'pending'
  });

  const createPaymentResponse = await request(suite.app)
    .post('/api/payments')
    .set(authHeader(owner.token))
    .field('subscriptionId', subscription._id.toString())
    .field('amount', '599')
    .field('paymentReference', 'PAY-APPROVE-001')
    .attach('proofFile', Buffer.from('%PDF-test-proof'), {
      filename: 'proof.pdf',
      contentType: 'application/pdf'
    });

  assert.equal(createPaymentResponse.status, 201);
  const paymentId = createPaymentResponse.body._id;

  const forbiddenGetResponse = await request(suite.app)
    .get(`/api/payments/${paymentId}`)
    .set(authHeader(otherStudent.token));
  assert.equal(forbiddenGetResponse.status, 403);

  const approveResponse = await request(suite.app)
    .patch(`/api/payments/${paymentId}/approve`)
    .set(authHeader(admin.token));
  assert.equal(approveResponse.status, 200);
  assert.equal(approveResponse.body.status, 'approved');

  const updatedSubscription = await Subscription.findById(subscription._id);
  assert.equal(updatedSubscription.status, 'active');
  assert.ok(updatedSubscription.startDate);
  assert.ok(updatedSubscription.endDate);
});

test('instructor analytics returns allocated revenue from approved payments', async () => {
  const admin = await createUser({ role: 'admin' });
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
    status: 'pending'
  });

  const createPaymentResponse = await request(suite.app)
    .post('/api/payments')
    .set(authHeader(student.token))
    .field('subscriptionId', subscription._id.toString())
    .field('amount', '750')
    .field('paymentReference', 'PAY-ANALYTICS-001')
    .attach('proofFile', Buffer.from('%PDF-test-proof'), {
      filename: 'proof.pdf',
      contentType: 'application/pdf'
    });
  assert.equal(createPaymentResponse.status, 201);

  const approveResponse = await request(suite.app)
    .patch(`/api/payments/${createPaymentResponse.body._id}/approve`)
    .set(authHeader(admin.token));
  assert.equal(approveResponse.status, 200);

  const analyticsResponse = await request(suite.app)
    .get('/api/analytics/instructor')
    .set(authHeader(instructor.token));

  assert.equal(analyticsResponse.status, 200);
  assert.equal(analyticsResponse.body.totalRevenue, 750);
  assert.equal(analyticsResponse.body.revenueCalculation.placeholder, false);
  assert.match(
    analyticsResponse.body.revenueCalculation.methodology,
    /approved subscription payments/i
  );
  assert.equal(analyticsResponse.body.courseStats.length, 1);
  assert.equal(analyticsResponse.body.courseStats[0].estimatedRevenue, 750);
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
    .field('additionalComments', applicationPayload.additionalComments);
  assert.equal(submitResponse.status, 201);

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
