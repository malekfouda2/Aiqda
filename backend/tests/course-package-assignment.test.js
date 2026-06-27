import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import { SubscriptionPackage } from '../src/modules/subscriptions/subscription.model.js';
import {
  authHeader,
  createSubscriptionPackage,
  createUser,
  setupIntegrationSuite
} from './helpers/integration.js';

const suite = setupIntegrationSuite();

test('instructors can assign chapters to subscription packages and later update those assignments', async () => {
  const instructor = await createUser({ role: 'instructor' });
  const starterPackage = await createSubscriptionPackage({ name: 'Starter Package' });
  const proPackage = await createSubscriptionPackage({ name: 'Pro Package' });

  // Creators may only assign content to tiers an admin has assigned to them.
  instructor.user.assignedPackages = [starterPackage._id, proPackage._id];
  await instructor.user.save();

  const createResponse = await request(suite.app)
    .post('/api/courses')
    .set(authHeader(instructor.token))
    .send({
      title: 'Creator Package Assignment Course',
      description: 'Testing creator package assignment flow',
      category: 'Design',
      level: 'beginner',
      packageIds: [starterPackage._id.toString()],
    });

  assert.equal(createResponse.status, 201);
  assert.deepEqual(
    createResponse.body.assignedPackages.map((pkg) => pkg.name),
    ['Starter Package']
  );

  let starterPackageAfterCreate = await SubscriptionPackage.findById(starterPackage._id).lean();
  let proPackageAfterCreate = await SubscriptionPackage.findById(proPackage._id).lean();

  assert.equal(
    starterPackageAfterCreate.courses.some((courseId) => courseId.toString() === createResponse.body._id),
    true
  );
  assert.equal(
    proPackageAfterCreate.courses.some((courseId) => courseId.toString() === createResponse.body._id),
    false
  );

  const updateAssignmentResponse = await request(suite.app)
    .put(`/api/courses/${createResponse.body._id}`)
    .set(authHeader(instructor.token))
    .send({
      packageIds: [proPackage._id.toString()],
    });

  assert.equal(updateAssignmentResponse.status, 200);
  assert.deepEqual(
    updateAssignmentResponse.body.assignedPackages.map((pkg) => pkg.name),
    ['Pro Package']
  );

  starterPackageAfterCreate = await SubscriptionPackage.findById(starterPackage._id).lean();
  proPackageAfterCreate = await SubscriptionPackage.findById(proPackage._id).lean();

  assert.equal(
    starterPackageAfterCreate.courses.some((courseId) => courseId.toString() === createResponse.body._id),
    false
  );
  assert.equal(
    proPackageAfterCreate.courses.some((courseId) => courseId.toString() === createResponse.body._id),
    true
  );

  // Publishing is admin-only now; an admin reviews and publishes the chapter.
  const admin = await createUser({ role: 'admin' });
  const publishResponse = await request(suite.app)
    .patch(`/api/courses/${createResponse.body._id}/publish`)
    .set(authHeader(admin.token))
    .send({ isPublished: true });

  assert.equal(publishResponse.status, 200);
  assert.equal(publishResponse.body.isPublished, true);
  assert.equal(publishResponse.body.reviewStatus, 'published');
  assert.deepEqual(
    publishResponse.body.assignedPackages.map((pkg) => pkg.name),
    ['Pro Package']
  );

  const teachingResponse = await request(suite.app)
    .get('/api/courses/my/teaching')
    .set(authHeader(instructor.token));

  assert.equal(teachingResponse.status, 200);
  const createdCourse = teachingResponse.body.find((course) => course._id === createResponse.body._id);
  assert.ok(createdCourse);
  assert.deepEqual(
    createdCourse.assignedPackages.map((pkg) => pkg.name),
    ['Pro Package']
  );
});
