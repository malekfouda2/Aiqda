import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import User from '../src/modules/users/user.model.js';
import {
  authHeader,
  createUser,
  setupIntegrationSuite
} from './helpers/integration.js';

const suite = setupIntegrationSuite();

const createChapter = (token, title) =>
  request(suite.app)
    .post('/api/courses')
    .set(authHeader(token))
    .send({
      title,
      description: 'Chapter limit test',
      category: 'Design',
      level: 'beginner',
    });

test('creators default to a single chapter when no limit is configured', async () => {
  const instructor = await createUser({ role: 'instructor' });

  const first = await createChapter(instructor.token, 'First Chapter');
  assert.equal(first.status, 201);

  const second = await createChapter(instructor.token, 'Second Chapter');
  assert.equal(second.status, 400);
  assert.equal(second.body.error, 'You can only create one chapter.');
});

test('admins can raise a creator chapter limit and the creator can create up to it', async () => {
  const admin = await createUser({ role: 'admin' });
  const instructor = await createUser({ role: 'instructor' });

  const setLimit = await request(suite.app)
    .patch(`/api/users/${instructor.user._id}/chapter-limit`)
    .set(authHeader(admin.token))
    .send({ chapterLimit: 3 });
  assert.equal(setLimit.status, 200);
  assert.equal(setLimit.body.chapterLimit, 3);

  const stored = await User.findById(instructor.user._id).lean();
  assert.equal(stored.chapterLimit, 3);

  for (let i = 1; i <= 3; i += 1) {
    const res = await createChapter(instructor.token, `Chapter ${i}`);
    assert.equal(res.status, 201, `chapter ${i} should be allowed`);
  }

  const overLimit = await createChapter(instructor.token, 'Chapter 4');
  assert.equal(overLimit.status, 400);
  assert.equal(overLimit.body.error, 'You can only create up to 3 chapters.');
});

test('a chapter limit of zero blocks all chapter creation', async () => {
  const admin = await createUser({ role: 'admin' });
  const instructor = await createUser({ role: 'instructor' });

  const setLimit = await request(suite.app)
    .patch(`/api/users/${instructor.user._id}/chapter-limit`)
    .set(authHeader(admin.token))
    .send({ chapterLimit: 0 });
  assert.equal(setLimit.status, 200);

  const blocked = await createChapter(instructor.token, 'Blocked Chapter');
  assert.equal(blocked.status, 400);
});

test('chapter limit must be a non-negative whole number', async () => {
  const admin = await createUser({ role: 'admin' });
  const instructor = await createUser({ role: 'instructor' });

  for (const badValue of [-1, 2.5, 'lots', null]) {
    const res = await request(suite.app)
      .patch(`/api/users/${instructor.user._id}/chapter-limit`)
      .set(authHeader(admin.token))
      .send({ chapterLimit: badValue });
    assert.equal(res.status, 400, `value ${badValue} should be rejected`);
  }
});

test('only admins can configure a chapter limit', async () => {
  const instructor = await createUser({ role: 'instructor' });
  const otherInstructor = await createUser({ role: 'instructor' });

  const res = await request(suite.app)
    .patch(`/api/users/${otherInstructor.user._id}/chapter-limit`)
    .set(authHeader(instructor.token))
    .send({ chapterLimit: 5 });
  assert.equal(res.status, 403);
});

test('chapter limit can only target creators', async () => {
  const admin = await createUser({ role: 'admin' });
  const member = await createUser({ role: 'student' });

  const res = await request(suite.app)
    .patch(`/api/users/${member.user._id}/chapter-limit`)
    .set(authHeader(admin.token))
    .send({ chapterLimit: 5 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Creator not found');
});

test('admins are exempt from the chapter limit', async () => {
  const admin = await createUser({ role: 'admin' });

  const first = await createChapter(admin.token, 'Admin Chapter One');
  const second = await createChapter(admin.token, 'Admin Chapter Two');
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
});
