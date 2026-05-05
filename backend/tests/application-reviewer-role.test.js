import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import {
  authHeader,
  createInstructorApplicationPayload,
  createStudioApplicationPayload,
  createUser,
  setupIntegrationSuite,
} from './helpers/integration.js';

const suite = setupIntegrationSuite();

test('limited application reviewers can manage creator and studio applications only', async () => {
  const reviewer = await createUser({ role: 'applications_admin' });

  const instructorPayload = createInstructorApplicationPayload({
    email: 'reviewer-instructor@example.com',
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

  const instructorListResponse = await request(suite.app)
    .get('/api/instructor-applications')
    .set(authHeader(reviewer.token));
  assert.equal(instructorListResponse.status, 200);
  assert.equal(instructorListResponse.body.length, 1);

  const instructorApproveResponse = await request(suite.app)
    .patch(`/api/instructor-applications/${instructorSubmitResponse.body._id}/approve`)
    .set(authHeader(reviewer.token));
  assert.equal(instructorApproveResponse.status, 200);
  assert.equal(instructorApproveResponse.body.application.status, 'approved');
  assert.equal(
    instructorApproveResponse.body.application.reviewedBy?.toString?.() || instructorApproveResponse.body.application.reviewedBy,
    reviewer.user._id.toString()
  );

  const studioSubmitResponse = await request(suite.app)
    .post('/api/studio-applications')
    .send(createStudioApplicationPayload({
      contactEmail: 'reviewer-studio@example.com',
    }));
  assert.equal(studioSubmitResponse.status, 201);

  const studioListResponse = await request(suite.app)
    .get('/api/studio-applications')
    .set(authHeader(reviewer.token));
  assert.equal(studioListResponse.status, 200);
  assert.equal(studioListResponse.body.length, 1);

  const studioRejectResponse = await request(suite.app)
    .patch(`/api/studio-applications/${studioSubmitResponse.body._id}/reject`)
    .set(authHeader(reviewer.token))
    .send({ reason: 'Not the right fit yet.' });
  assert.equal(studioRejectResponse.status, 200);
  assert.equal(studioRejectResponse.body.status, 'rejected');
  assert.equal(
    studioRejectResponse.body.reviewedBy?.toString?.() || studioRejectResponse.body.reviewedBy,
    reviewer.user._id.toString()
  );

  const usersResponse = await request(suite.app)
    .get('/api/users')
    .set(authHeader(reviewer.token));
  assert.equal(usersResponse.status, 403);
  assert.equal(usersResponse.body.error, 'Access denied. Insufficient permissions.');
});
