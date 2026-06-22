import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import request from 'supertest';

import ConsultationBooking from '../src/modules/consultations/consultationBooking.model.js';
import InstructorApplication from '../src/modules/instructor-applications/instructorApplication.model.js';
import Payment from '../src/modules/payments/payment.model.js';
import StudioApplication from '../src/modules/studio-applications/studioApplication.model.js';
import { Subscription } from '../src/modules/subscriptions/subscription.model.js';
import { resolveUploadPath } from '../src/utils/uploadPaths.js';
import {
  authHeader,
  createConsultation,
  createInstructorApplicationPayload,
  createStudioApplicationPayload,
  createSubscription,
  createSubscriptionPackage,
  createUser,
  setupIntegrationSuite,
} from './helpers/integration.js';

const suite = setupIntegrationSuite();
const PDF_BUFFER = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

test('application reviewers can delete creator and studio applications', async () => {
  const reviewer = await createUser({ role: 'applications_admin' });
  const instructorPayload = createInstructorApplicationPayload({
    email: 'delete-reviewer-instructor@example.com',
  });

  const instructorResponse = await request(suite.app)
    .post('/api/instructor-applications')
    .field('email', instructorPayload.email)
    .field('fullName', instructorPayload.fullName)
    .field('nationality', instructorPayload.nationality)
    .field('country', instructorPayload.country)
    .field('city', instructorPayload.city)
    .field('phoneCode', instructorPayload.phoneCode)
    .field('phoneNumber', instructorPayload.phoneNumber)
    .field('educationLevel', instructorPayload.educationLevel)
    .field('fieldOfStudy', instructorPayload.fieldOfStudy)
    .field('yearsOfExperience', instructorPayload.yearsOfExperience)
    .field('specialization', instructorPayload.specialization[0])
    .field('previousTeachingExperience', instructorPayload.previousTeachingExperience)
    .field('softwareProficiency', instructorPayload.softwareProficiency)
    .field('institutionsOrStudios', instructorPayload.institutionsOrStudios)
    .field('notableWorks', instructorPayload.notableWorks)
    .field('websiteOrPortfolio', instructorPayload.websiteOrPortfolio)
    .field('teachingStyle', instructorPayload.teachingStyle)
    .field('studentGuidance', instructorPayload.studentGuidance)
    .field('existingCourseMaterials', instructorPayload.existingCourseMaterials)
    .field('preferredSchedule', instructorPayload.preferredSchedule)
    .field('earliestStartDate', instructorPayload.earliestStartDate)
    .field('additionalComments', instructorPayload.additionalComments)
    .field('creatorAgreementAccepted', 'true')
    .attach('cvFile', PDF_BUFFER, {
      filename: 'creator-cv.pdf',
      contentType: 'application/pdf',
    });
  assert.equal(instructorResponse.status, 201);

  const instructorFilePath = resolveUploadPath(instructorResponse.body.cvFile);
  await fs.access(instructorFilePath);

  const deleteInstructorResponse = await request(suite.app)
    .delete(`/api/instructor-applications/${instructorResponse.body._id}`)
    .set(authHeader(reviewer.token));
  assert.equal(deleteInstructorResponse.status, 200);
  assert.equal(deleteInstructorResponse.body.message, 'Application deleted successfully');
  assert.equal(await InstructorApplication.findById(instructorResponse.body._id), null);
  await assert.rejects(() => fs.access(instructorFilePath));

  const studioResponse = await request(suite.app)
    .post('/api/studio-applications')
    .send(createStudioApplicationPayload({
      contactEmail: 'delete-reviewer-studio@example.com',
    }));
  assert.equal(studioResponse.status, 201);

  const deleteStudioResponse = await request(suite.app)
    .delete(`/api/studio-applications/${studioResponse.body._id}`)
    .set(authHeader(reviewer.token));
  assert.equal(deleteStudioResponse.status, 200);
  assert.equal(deleteStudioResponse.body.message, 'Application deleted successfully');
  assert.equal(await StudioApplication.findById(studioResponse.body._id), null);
});

test('admins can delete consultation bookings', async () => {
  const admin = await createUser({ role: 'admin' });
  const student = await createUser({ role: 'student' });
  const consultation = await createConsultation({ priceType: 'contract' });

  const bookingResponse = await request(suite.app)
    .post('/api/consultation-bookings')
    .set(authHeader(student.token))
    .send({
      consultationId: consultation._id.toString(),
      paymentReference: 'CONSULT-DELETE-001',
    });
  assert.equal(bookingResponse.status, 201);

  const deleteResponse = await request(suite.app)
    .delete(`/api/consultation-bookings/${bookingResponse.body._id}`)
    .set(authHeader(admin.token));
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteResponse.body.message, 'Booking deleted successfully');
  assert.equal(await ConsultationBooking.findById(bookingResponse.body._id), null);
});

test('deleting an approved payment rolls its active subscription back to pending', async () => {
  const admin = await createUser({ role: 'admin' });
  const student = await createUser({ role: 'student' });
  const packageRecord = await createSubscriptionPackage();
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + (30 * 24 * 60 * 60 * 1000));

  const subscription = await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'active',
    startDate,
    endDate,
    approvedBy: admin.user._id,
    approvedAt: new Date(),
  });

  const payment = await Payment.create({
    user: student.user._id,
    subscription: subscription._id,
    amount: subscription.priceAtPurchase ?? packageRecord.price,
    paymentReference: 'PAY-DELETE-APPROVED-001',
    status: 'approved',
    reviewedBy: admin.user._id,
    reviewedAt: new Date(),
  });

  const deleteResponse = await request(suite.app)
    .delete(`/api/payments/${payment._id}`)
    .set(authHeader(admin.token));
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteResponse.body.message, 'Payment deleted successfully');
  assert.equal(await Payment.findById(payment._id), null);

  const updatedSubscription = await Subscription.findById(subscription._id);
  assert.ok(updatedSubscription);
  assert.equal(updatedSubscription.status, 'pending');
  assert.equal(updatedSubscription.startDate, null);
  assert.equal(updatedSubscription.endDate, null);
  assert.equal(updatedSubscription.approvedBy, null);
  assert.equal(updatedSubscription.approvedAt, null);
});

test('deleting a subscription also deletes its payment submissions', async () => {
  const admin = await createUser({ role: 'admin' });
  const student = await createUser({ role: 'student' });
  const packageRecord = await createSubscriptionPackage();

  const subscription = await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'pending',
  });

  const payment = await Payment.create({
    user: student.user._id,
    subscription: subscription._id,
    amount: subscription.priceAtPurchase ?? packageRecord.price,
    paymentReference: 'PAY-DELETE-SUB-001',
    status: 'submitted',
  });

  const deleteResponse = await request(suite.app)
    .delete(`/api/subscriptions/${subscription._id}`)
    .set(authHeader(admin.token));
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteResponse.body.message, 'Subscription deleted successfully');
  assert.equal(await Subscription.findById(subscription._id), null);
  assert.equal(await Payment.findById(payment._id), null);
});
