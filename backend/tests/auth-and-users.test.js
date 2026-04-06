import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import User from '../src/modules/users/user.model.js';
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
      password: 'short'
    });

  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidResponse.body.error, 'Name is required');

  const validResponse = await request(suite.app)
    .post('/api/auth/register')
    .send({
      name: '  New Student  ',
      email: 'NEW.STUDENT@EXAMPLE.COM',
      password: 'Password123!'
    });

  assert.equal(validResponse.status, 201);
  assert.equal(validResponse.body.user.email, 'new.student@example.com');
  assert.equal(validResponse.body.user.name, 'New Student');
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
