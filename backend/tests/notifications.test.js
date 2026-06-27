import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import {
  authHeader,
  createCourse,
  createUser,
  setupIntegrationSuite,
} from './helpers/integration.js';

const suite = setupIntegrationSuite();

test('submitting a chapter for review notifies admins, who can read and clear it', async () => {
  const admin = await createUser({ role: 'admin' });
  const instructor = await createUser({ role: 'instructor' });
  const course = await createCourse({
    instructorId: instructor.user._id,
    isPublished: false,
    reviewStatus: 'draft',
  });

  const submitResponse = await request(suite.app)
    .post(`/api/courses/${course._id}/submit-review`)
    .set(authHeader(instructor.token));
  assert.equal(submitResponse.status, 200);

  const countResponse = await request(suite.app)
    .get('/api/notifications/unread-count')
    .set(authHeader(admin.token));
  assert.equal(countResponse.status, 200);
  assert.equal(countResponse.body.count, 1);

  const listResponse = await request(suite.app)
    .get('/api/notifications')
    .set(authHeader(admin.token));
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.length, 1);
  assert.equal(listResponse.body[0].type, 'review.chapter_submitted');
  assert.equal(listResponse.body[0].isRead, false);

  const notificationId = listResponse.body[0]._id;
  const readResponse = await request(suite.app)
    .patch(`/api/notifications/${notificationId}/read`)
    .set(authHeader(admin.token));
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.body.isRead, true);

  const afterReadCount = await request(suite.app)
    .get('/api/notifications/unread-count')
    .set(authHeader(admin.token));
  assert.equal(afterReadCount.body.count, 0);

  // The instructor (a different recipient) should not see the admin's notification.
  const instructorList = await request(suite.app)
    .get('/api/notifications')
    .set(authHeader(instructor.token));
  assert.equal(instructorList.body.length, 0);
});

test('a user can only mark their own notifications and clearing removes them all', async () => {
  const admin = await createUser({ role: 'admin' });
  const instructor = await createUser({ role: 'instructor' });
  const courseOne = await createCourse({ instructorId: instructor.user._id, isPublished: false, reviewStatus: 'draft' });
  const courseTwo = await createCourse({ instructorId: instructor.user._id, isPublished: false, reviewStatus: 'draft' });

  await request(suite.app).post(`/api/courses/${courseOne._id}/submit-review`).set(authHeader(instructor.token));
  await request(suite.app).post(`/api/courses/${courseTwo._id}/submit-review`).set(authHeader(instructor.token));

  const list = await request(suite.app).get('/api/notifications').set(authHeader(admin.token));
  assert.equal(list.body.length, 2);

  // Another admin cannot mark a notification that is not theirs.
  const otherAdmin = await createUser({ role: 'admin' });
  const foreignRead = await request(suite.app)
    .patch(`/api/notifications/${list.body[0]._id}/read`)
    .set(authHeader(otherAdmin.token));
  assert.equal(foreignRead.status, 404);

  const clearResponse = await request(suite.app)
    .delete('/api/notifications/clear-all')
    .set(authHeader(admin.token));
  assert.equal(clearResponse.status, 200);

  const afterClear = await request(suite.app).get('/api/notifications').set(authHeader(admin.token));
  assert.equal(afterClear.body.length, 0);
});
