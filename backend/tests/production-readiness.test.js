import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import User from '../src/modules/users/user.model.js';
import { shouldAutoSeedConsultations, shouldAutoSeedDemoData } from '../src/seed.js';
import { ensureSystemUsers } from '../src/startup/ensureSystemUsers.js';
import { validateRuntimeConfig } from '../src/startup/validateRuntimeConfig.js';
import { comparePassword } from '../src/utils/password.js';
import {
  authHeader,
  createConsultation,
  createInstructorApplicationPayload,
  createStudioApplicationPayload,
  createUser,
  setupIntegrationSuite
} from './helpers/integration.js';

const suite = setupIntegrationSuite();

test('production runtime configuration validation fails for unsafe deployment settings', () => {
  assert.throws(
    () => validateRuntimeConfig({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/aiqda',
      JWT_SECRET: 'short-secret',
      FRONTEND_URL: 'not-a-url',
      APP_URL: 'not-a-url',
      SMTP_HOST: '',
      SMTP_PORT: 'abc',
      SMTP_USER: '',
      SMTP_PASS: '',
      EMAIL_FROM: '',
      STUDIO_APPLICATION_MEETING_URL: '',
      TAP_SECRET_KEY: '',
      TAP_PUBLIC_KEY: '',
      GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
      GOOGLE_OAUTH_CLIENT_SECRET: '',
      AUTO_SEED_DEMO_DATA: 'true',
      AUTO_SEED_CONSULTATIONS: 'false',
      ALLOW_PRODUCTION_AUTO_SEED: 'false',
      CONTACT_NOTIFICATION_TO: 'invalid-email'
    }),
    /Runtime configuration is invalid/
  );
});

test('auto-seed defaults stay safe in production and convenient in development', () => {
  assert.equal(shouldAutoSeedDemoData({ NODE_ENV: 'production' }), false);
  assert.equal(shouldAutoSeedConsultations({ NODE_ENV: 'production' }), false);
  assert.equal(shouldAutoSeedDemoData({ NODE_ENV: 'development' }), true);
  assert.equal(shouldAutoSeedConsultations({ NODE_ENV: 'development' }), true);
  assert.equal(shouldAutoSeedDemoData({ NODE_ENV: 'production', AUTO_SEED_DEMO_DATA: 'true' }), true);
  assert.equal(shouldAutoSeedConsultations({ NODE_ENV: 'production', AUTO_SEED_CONSULTATIONS: 'true' }), true);
});

test('production runtime configuration requires a password for the limited reviewer account', () => {
  assert.throws(
    () => validateRuntimeConfig({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/aiqda',
      JWT_SECRET: 'a-very-strong-production-secret-value',
      FRONTEND_URL: 'https://www.aiqda.pro',
      APP_URL: 'https://api.aiqda.pro',
      REDIS_URL: 'redis://127.0.0.1:6379',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'mailer@example.com',
      SMTP_PASS: 'mail-password',
      EMAIL_FROM: 'Aiqda <no-reply@example.com>',
      STUDIO_APPLICATION_MEETING_URL: 'https://scheduler.example.com/aiqda/studio-intro',
      TAP_SECRET_KEY: 'sk_test_runtime_config',
      TAP_PUBLIC_KEY: 'pk_test_runtime_config',
      EBAA_REVIEWER_EMAIL: 'ebaa@aiqda.com',
      EBAA_REVIEWER_PASSWORD: '',
    }),
    /EBAA_REVIEWER_PASSWORD is required in production/
  );
});

test('system user bootstrap ensures the limited reviewer account exists idempotently', async () => {
  const env = {
    NODE_ENV: 'production',
    EBAA_REVIEWER_NAME: 'Ebaa',
    EBAA_REVIEWER_EMAIL: 'ebaa.reviewer@example.com',
    EBAA_REVIEWER_PASSWORD: 'EbaaSecure123!',
  };

  const firstRun = await ensureSystemUsers(env);
  assert.equal(firstRun.reviewer.created, true);
  assert.equal(firstRun.reviewer.updated, false);
  assert.equal(firstRun.reviewer.role, 'applications_admin');

  const storedUser = await User.findOne({ email: env.EBAA_REVIEWER_EMAIL });
  assert.ok(storedUser);
  assert.equal(storedUser.role, 'applications_admin');
  assert.equal(storedUser.isActive, true);
  assert.equal(await comparePassword(env.EBAA_REVIEWER_PASSWORD, storedUser.password), true);

  const secondRun = await ensureSystemUsers(env);
  assert.equal(secondRun.reviewer.created, false);
  assert.equal(secondRun.reviewer.updated, false);
});

test('instructor and studio rejections persist correctly while email notifications are sent', async () => {
  const admin = await createUser({ role: 'admin' });

  const instructorPayload = createInstructorApplicationPayload({
    email: 'rejected-instructor@example.com'
  });

  const instructorSubmitResponse = await request(suite.app)
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
    .field('creatorAgreementAccepted', 'true');
  assert.equal(instructorSubmitResponse.status, 201);

  const instructorRejectResponse = await request(suite.app)
    .patch(`/api/instructor-applications/${instructorSubmitResponse.body._id}/reject`)
    .set(authHeader(admin.token))
    .send({ reason: 'We need more teaching portfolio depth at this stage.' });
  assert.equal(instructorRejectResponse.status, 200);
  assert.equal(instructorRejectResponse.body.status, 'rejected');
  assert.equal(
    instructorRejectResponse.body.rejectionReason,
    'We need more teaching portfolio depth at this stage.'
  );

  const studioPayload = createStudioApplicationPayload({
    contactEmail: 'rejected-studio@example.com'
  });

  const studioSubmitResponse = await request(suite.app)
    .post('/api/studio-applications')
    .send(studioPayload);
  assert.equal(studioSubmitResponse.status, 201);

  const studioRejectResponse = await request(suite.app)
    .patch(`/api/studio-applications/${studioSubmitResponse.body._id}/reject`)
    .set(authHeader(admin.token))
    .send({ reason: 'We are not expanding this partner track right now.' });
  assert.equal(studioRejectResponse.status, 200);
  assert.equal(studioRejectResponse.body.status, 'rejected');
  assert.equal(
    studioRejectResponse.body.rejectionReason,
    'We are not expanding this partner track right now.'
  );
});

test('consultation booking status flows keep working with notification emails enabled', async () => {
  const admin = await createUser({ role: 'admin' });
  const student = await createUser({ role: 'student' });
  const consultation = await createConsultation({
    title: 'Creative Audit',
    zoomSchedulerLink: 'https://scheduler.example.com/creative-audit'
  });

  const submitResponse = await request(suite.app)
    .post('/api/consultation-bookings')
    .set(authHeader(student.token))
    .send({
      consultationId: consultation._id.toString(),
      paymentReference: 'CONSULT-001'
    });
  assert.equal(submitResponse.status, 201);

  const confirmResponse = await request(suite.app)
    .patch(`/api/consultation-bookings/${submitResponse.body._id}/confirm`)
    .set(authHeader(admin.token));
  assert.equal(confirmResponse.status, 200);
  assert.equal(confirmResponse.body.status, 'confirmed');
  assert.equal(confirmResponse.body.zoomLink, 'https://scheduler.example.com/creative-audit');

  const secondSubmitResponse = await request(suite.app)
    .post('/api/consultation-bookings')
    .set(authHeader(student.token))
    .send({
      consultationId: consultation._id.toString(),
      paymentReference: 'CONSULT-002'
    });
  assert.equal(secondSubmitResponse.status, 201);

  const rejectResponse = await request(suite.app)
    .patch(`/api/consultation-bookings/${secondSubmitResponse.body._id}/reject`)
    .set(authHeader(admin.token))
    .send({ reason: 'Please choose a different date window.' });
  assert.equal(rejectResponse.status, 200);
  assert.equal(rejectResponse.body.status, 'rejected');
  assert.equal(rejectResponse.body.rejectionReason, 'Please choose a different date window.');

  const thirdSubmitResponse = await request(suite.app)
    .post('/api/consultation-bookings')
    .set(authHeader(student.token))
    .send({
      consultationId: consultation._id.toString(),
      paymentReference: 'CONSULT-003'
    });
  assert.equal(thirdSubmitResponse.status, 201);

  const cancelResponse = await request(suite.app)
    .patch(`/api/consultation-bookings/${thirdSubmitResponse.body._id}/cancel`)
    .set(authHeader(student.token));
  assert.equal(cancelResponse.status, 200);
  assert.equal(cancelResponse.body.status, 'cancelled');
});

test('public application endpoints reject non-http external links', async () => {
  const studioResponse = await request(suite.app)
    .post('/api/studio-applications')
    .send(createStudioApplicationPayload({
      contactEmail: 'unsafe-studio@example.com',
      websitePortfolio: 'javascript:alert(1)'
    }));
  assert.equal(studioResponse.status, 400);
  assert.equal(
    studioResponse.body.error,
    'Website or portfolio link must use http or https'
  );

  const instructorPayload = createInstructorApplicationPayload({
    email: 'unsafe-instructor@example.com',
    websiteOrPortfolio: 'javascript:alert(1)'
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
    .field('creatorAgreementAccepted', 'true');
  assert.equal(instructorResponse.status, 400);
  assert.equal(
    instructorResponse.body.error,
    'Website or portfolio link must use http or https'
  );
});
