import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import User from '../src/modules/users/user.model.js';
import Course from '../src/modules/courses/course.model.js';
import Lesson from '../src/modules/lessons/lesson.model.js';
import Quiz from '../src/modules/quizzes/quiz.model.js';
import { LessonProgress, CourseProgress } from '../src/modules/analytics/progress.model.js';
import { SubscriptionPackage } from '../src/modules/subscriptions/subscription.model.js';
import { authHeader, createUser, setupIntegrationSuite } from './helpers/integration.js';

const suite = setupIntegrationSuite();

test('students cannot escalate their own role through self update', async () => {
  const student = await createUser({ role: 'student' });

  const response = await request(suite.app)
    .put(`/api/users/${student.user._id}`)
    .set(authHeader(student.token))
    .send({ role: 'admin' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'No valid fields to update');

  const storedUser = await User.findById(student.user._id);
  assert.equal(storedUser.role, 'student');
});

test('existing tokens stop working when the user is deactivated', async () => {
  const student = await createUser({ role: 'student' });
  await User.findByIdAndUpdate(student.user._id, { isActive: false });

  const response = await request(suite.app)
    .get('/api/auth/profile')
    .set(authHeader(student.token));

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'Invalid or expired token.');
});

test('registration validates required fields and normalizes the email', async () => {
  const invalidResponse = await request(suite.app)
    .post('/api/auth/register')
    .send({
      name: '',
      email: 'invalid-email',
      password: 'short',
      platformNoticeAccepted: true
    });

  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidResponse.body.error, 'Name is required');

  const missingAcceptanceResponse = await request(suite.app)
    .post('/api/auth/register')
    .send({
      name: 'New Student',
      email: 'new.student@example.com',
      password: 'Password123!'
    });

  assert.equal(missingAcceptanceResponse.status, 400);
  assert.equal(
    missingAcceptanceResponse.body.error,
    'Please accept the Terms & Conditions For Users before continuing.'
  );

  const validResponse = await request(suite.app)
    .post('/api/auth/register')
    .send({
      name: '  New Student  ',
      email: 'NEW.STUDENT@EXAMPLE.COM',
      password: 'Password123!',
      platformNoticeAccepted: true
    });

  assert.equal(validResponse.status, 201);
  assert.equal(validResponse.body.user.email, 'new.student@example.com');
  assert.equal(validResponse.body.user.name, 'New Student');
  assert.equal(validResponse.body.user.platformNoticeAcknowledgement.version, 'POL-0016');
  assert.ok(validResponse.body.user.platformNoticeAcknowledgement.acceptedAt);
  assert.ok(validResponse.headers['set-cookie']?.some((value) => value.startsWith('aiqda_auth=')));
  assert.ok(validResponse.headers['set-cookie']?.some((value) => value.startsWith('aiqda_device=')));
});

test('login sets an auth cookie, profile reads from it, and logout clears it', async () => {
  await createUser({
    email: 'cookie-user@example.com',
    password: 'Password123!',
    role: 'student',
  });

  const agent = request.agent(suite.app);
  const loginResponse = await agent
    .post('/api/auth/login')
    .send({
      email: 'cookie-user@example.com',
      password: 'Password123!',
    });

  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.body.user.email, 'cookie-user@example.com');
  assert.equal(loginResponse.body.token, undefined);
  assert.ok(loginResponse.headers['set-cookie']?.some((value) => value.startsWith('aiqda_auth=')));
  assert.ok(loginResponse.headers['set-cookie']?.some((value) => value.startsWith('aiqda_device=')));

  const profileResponse = await agent
    .get('/api/auth/profile');
  assert.equal(profileResponse.status, 200);
  assert.equal(profileResponse.body.email, 'cookie-user@example.com');

  const logoutResponse = await agent
    .post('/api/auth/logout');
  assert.equal(logoutResponse.status, 204);
  assert.ok(logoutResponse.headers['set-cookie']?.some((value) => value.startsWith('aiqda_auth=')));

  const afterLogoutProfileResponse = await agent
    .get('/api/auth/profile');
  assert.equal(afterLogoutProfileResponse.status, 401);
});

test('accounts can stay signed in on two approved devices at the same time', async () => {
  await createUser({
    email: 'concurrent-device-user@example.com',
    password: 'Password123!',
  });

  const firstDevice = request.agent(suite.app);
  const secondDevice = request.agent(suite.app);

  const firstLoginResponse = await firstDevice
    .post('/api/auth/login')
    .send({
      email: 'concurrent-device-user@example.com',
      password: 'Password123!',
    });

  assert.equal(firstLoginResponse.status, 200);

  const secondLoginResponse = await secondDevice
    .post('/api/auth/login')
    .send({
      email: 'concurrent-device-user@example.com',
      password: 'Password123!',
    });

  assert.equal(secondLoginResponse.status, 200);

  const profileResponses = await Promise.all([
    firstDevice.get('/api/auth/profile'),
    secondDevice.get('/api/auth/profile'),
  ]);

  profileResponses.forEach((response) => {
    assert.equal(response.status, 200);
    assert.equal(response.body.email, 'concurrent-device-user@example.com');
  });
});

test('accounts can only be approved on up to two devices even when both approved devices stay active', async () => {
  await createUser({
    email: 'two-device-limit-user@example.com',
    password: 'Password123!',
  });

  const firstDevice = request.agent(suite.app);
  const secondDevice = request.agent(suite.app);
  const thirdDevice = request.agent(suite.app);

  const firstLoginResponse = await firstDevice
    .post('/api/auth/login')
    .send({
      email: 'two-device-limit-user@example.com',
      password: 'Password123!',
    });

  assert.equal(firstLoginResponse.status, 200);

  const secondLoginResponse = await secondDevice
    .post('/api/auth/login')
    .send({
      email: 'two-device-limit-user@example.com',
      password: 'Password123!',
    });

  assert.equal(secondLoginResponse.status, 200);

  const thirdLoginResponse = await thirdDevice
    .post('/api/auth/login')
    .send({
      email: 'two-device-limit-user@example.com',
      password: 'Password123!',
    });

  assert.equal(thirdLoginResponse.status, 403);
  assert.equal(
    thirdLoginResponse.body.error,
    'This account can only be used on up to 2 devices. Please sign in from one of your approved devices.'
  );

  const profileResponses = await Promise.all([
    firstDevice.get('/api/auth/profile'),
    secondDevice.get('/api/auth/profile'),
  ]);

  profileResponses.forEach((response) => {
    assert.equal(response.status, 200);
    assert.equal(response.body.email, 'two-device-limit-user@example.com');
  });
});

test('admin-side accounts can sign in on multiple devices without device or concurrency limits', async () => {
  await createUser({
    email: 'admin-multi-device@example.com',
    password: 'Password123!',
    role: 'admin',
  });

  const firstDevice = request.agent(suite.app);
  const secondDevice = request.agent(suite.app);
  const thirdDevice = request.agent(suite.app);

  const firstLoginResponse = await firstDevice
    .post('/api/auth/login')
    .send({
      email: 'admin-multi-device@example.com',
      password: 'Password123!',
    });
  assert.equal(firstLoginResponse.status, 200);

  const secondLoginResponse = await secondDevice
    .post('/api/auth/login')
    .send({
      email: 'admin-multi-device@example.com',
      password: 'Password123!',
    });
  assert.equal(secondLoginResponse.status, 200);

  const thirdLoginResponse = await thirdDevice
    .post('/api/auth/login')
    .send({
      email: 'admin-multi-device@example.com',
      password: 'Password123!',
    });
  assert.equal(thirdLoginResponse.status, 200);

  const profileResponses = await Promise.all([
    firstDevice.get('/api/auth/profile'),
    secondDevice.get('/api/auth/profile'),
    thirdDevice.get('/api/auth/profile'),
  ]);

  profileResponses.forEach((response) => {
    assert.equal(response.status, 200);
    assert.equal(response.body.role, 'admin');
  });
});

test('admins can permanently delete a user and their creator-owned content', async () => {
  const admin = await createUser({ role: 'admin' });
  const creator = await createUser({ role: 'instructor', email: 'creator-delete@example.com' });

  const course = await Course.create({
    title: 'Deletion Test Chapter',
    description: 'Creator-owned chapter',
    instructor: creator.user._id,
    category: 'General',
    level: 'beginner',
    isPublished: true,
  });

  const lesson = await Lesson.create({
    title: 'Deletion Test Lesson',
    course: course._id,
    order: 1,
  });

  await Quiz.create({
    lesson: lesson._id,
    questions: [
      {
        question: 'What is 2 + 2?',
        options: ['3', '4', '5'],
        correctAnswer: 1,
      },
    ],
    passingScore: 1,
  });

  await LessonProgress.create({
    user: creator.user._id,
    lesson: lesson._id,
    course: course._id,
    watchPercentage: 100,
    isQualified: true,
  });

  await CourseProgress.create({
    user: creator.user._id,
    course: course._id,
    completedLessons: 1,
    totalLessons: 1,
    progressPercentage: 100,
    isCompleted: true,
  });

  await SubscriptionPackage.create({
    name: 'Deletion Package',
    price: 499,
    billingOptions: [
      {
        term: 'monthly',
        label: 'Monthly',
        price: 499,
        durationDays: 30,
        isActive: true,
      },
    ],
    scheduleDuration: '1 month',
    durationDays: 30,
    learningMode: 'Online',
    focus: 'Skill building',
    courses: [course._id],
    softwareExposure: ['AutoCAD'],
    outcome: 'Confident learner',
  });

  const response = await request(suite.app)
    .delete(`/api/users/${creator.user._id}`)
    .set(authHeader(admin.token));

  assert.equal(response.status, 200);
  assert.equal(response.body.message, 'User deleted permanently');
  assert.equal(await User.countDocuments({ _id: creator.user._id }), 0);
  assert.equal(await Course.countDocuments({ _id: course._id }), 0);
  assert.equal(await Lesson.countDocuments({ _id: lesson._id }), 0);
  assert.equal(await Quiz.countDocuments({ lesson: lesson._id }), 0);
  assert.equal(await LessonProgress.countDocuments({ user: creator.user._id }), 0);
  assert.equal(await CourseProgress.countDocuments({ user: creator.user._id }), 0);

  const packageAfterDelete = await SubscriptionPackage.findOne({ name: 'Deletion Package' });
  assert.deepEqual(packageAfterDelete.courses.map((id) => id.toString()), []);
});

test('admins cannot permanently delete their own account', async () => {
  const admin = await createUser({ role: 'admin', email: 'self-delete-admin@example.com' });

  const response = await request(suite.app)
    .delete(`/api/users/${admin.user._id}`)
    .set(authHeader(admin.token));

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Admins cannot permanently delete their own account.');
  assert.equal(await User.countDocuments({ _id: admin.user._id }), 1);
});

test('login endpoint is rate limited after repeated failed attempts', async () => {
  await createUser({
    email: 'rate-limit-user@example.com',
    password: 'Password123!'
  });

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request(suite.app)
      .post('/api/auth/login')
      .send({
        email: 'rate-limit-user@example.com',
        password: 'WrongPassword!'
      });

    assert.equal(response.status, 401);
  }

  const limitedResponse = await request(suite.app)
    .post('/api/auth/login')
    .send({
      email: 'rate-limit-user@example.com',
      password: 'WrongPassword!'
    });

  assert.equal(limitedResponse.status, 429);
  assert.equal(limitedResponse.body.error, 'Too many login attempts. Please try again later.');
});
