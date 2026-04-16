import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import {
  authHeader,
  createCourse,
  createLesson,
  createQuiz,
  createSubscription,
  createSubscriptionPackage,
  createUser,
  setupIntegrationSuite
} from './helpers/integration.js';
import { PLATFORM_NOTICE_VERSION } from '../src/config/platformNotice.js';

const suite = setupIntegrationSuite();

test('users can acknowledge the mandatory platform notice', async () => {
  const student = await createUser({ platformNoticeAcknowledgement: null });

  const response = await request(suite.app)
    .post('/api/users/me/platform-notice-acknowledgement')
    .set(authHeader(student.token));

  assert.equal(response.status, 200);
  assert.equal(response.body.platformNoticeAcknowledgement.version, PLATFORM_NOTICE_VERSION);
  assert.ok(response.body.platformNoticeAcknowledgement.acceptedAt);
});

test('subscription requests and lesson access are blocked until the platform notice is acknowledged', async () => {
  const instructor = await createUser({ role: 'instructor' });
  const student = await createUser({ role: 'student', platformNoticeAcknowledgement: null });

  const course = await createCourse({
    instructorId: instructor.user._id,
    enrolledStudents: [student.user._id],
    isPublished: true,
    title: 'Notice Locked Course'
  });

  const lesson = await createLesson({
    course: course._id,
    title: 'Protected Lesson',
    order: 1,
    isPublished: true,
    vimeoVideoId: '123456'
  });

  await createQuiz({ lesson: lesson._id });
  const subscriptionPackage = await createSubscriptionPackage();
  const lessonAccessPackage = await createSubscriptionPackage({
    name: 'Notice Lesson Access',
    courses: [course._id],
  });
  await createSubscription({
    user: student.user._id,
    package: lessonAccessPackage._id,
    status: 'active',
    startDate: new Date(Date.now() - 60 * 60 * 1000),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const blockedSubscription = await request(suite.app)
    .post('/api/subscriptions/request')
    .set(authHeader(student.token))
    .send({ packageId: subscriptionPackage._id });
  assert.equal(blockedSubscription.status, 403);
  assert.equal(blockedSubscription.body.error, 'Please accept the Terms & Conditions For Users before continuing.');

  const blockedLesson = await request(suite.app)
    .get(`/api/lessons/${lesson._id}`)
    .set(authHeader(student.token));
  assert.equal(blockedLesson.status, 403);
  assert.equal(blockedLesson.body.error, 'Please accept the Terms & Conditions For Users before continuing.');

  const blockedQuiz = await request(suite.app)
    .get(`/api/quizzes/lesson/${lesson._id}`)
    .set(authHeader(student.token));
  assert.equal(blockedQuiz.status, 403);
  assert.equal(blockedQuiz.body.error, 'Please accept the Terms & Conditions For Users before continuing.');

  const blockedEmbed = await request(suite.app)
    .get(`/api/video/embed/${lesson._id}`)
    .set(authHeader(student.token));
  assert.equal(blockedEmbed.status, 403);
  assert.equal(blockedEmbed.body.error, 'Please accept the Terms & Conditions For Users before continuing.');

  await request(suite.app)
    .post('/api/users/me/platform-notice-acknowledgement')
    .set(authHeader(student.token))
    .expect(200);

  const allowedLesson = await request(suite.app)
    .get(`/api/lessons/${lesson._id}`)
    .set(authHeader(student.token));
  assert.equal(allowedLesson.status, 200);

  const allowedQuiz = await request(suite.app)
    .get(`/api/quizzes/lesson/${lesson._id}`)
    .set(authHeader(student.token));
  assert.equal(allowedQuiz.status, 200);
});
