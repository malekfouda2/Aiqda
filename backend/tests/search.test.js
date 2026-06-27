import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import {
  authHeader,
  createCourse,
  createLesson,
  createUser,
  setupIntegrationSuite,
} from './helpers/integration.js';

const suite = setupIntegrationSuite();

const findGroup = (body, type) => (body.groups || []).find((g) => g.type === type);

test('admin global search returns role-scoped cross-entity results', async () => {
  const admin = await createUser({ role: 'admin' });
  await createUser({ role: 'student', name: 'Ahmed Searchable', email: 'ahmed-search@example.com' });
  await createCourse({ title: 'Searchable Chapter Alpha', isPublished: true });

  const res = await request(suite.app)
    .get('/api/search')
    .query({ q: 'searchable' })
    .set(authHeader(admin.token));

  assert.equal(res.status, 200);
  const members = findGroup(res.body, 'member');
  const chapters = findGroup(res.body, 'chapter');
  assert.ok(members && members.items.length >= 1, 'admin sees matching members');
  assert.ok(chapters && chapters.items.length >= 1, 'admin sees matching chapters');
  assert.ok(members.items[0].link.startsWith('/admin/'));
});

test('member search is scoped to published content and own records, never the user directory', async () => {
  const member = await createUser({ role: 'student' });
  await createUser({ role: 'student', name: 'Hidden Person', email: 'hidden@example.com' });
  const publishedCourse = await createCourse({ title: 'Hidden Public Chapter', isPublished: true });
  await createLesson({ course: publishedCourse._id, title: 'Hidden Lesson', isPublished: true });
  await createCourse({ title: 'Hidden Draft Chapter', isPublished: false });

  const res = await request(suite.app)
    .get('/api/search')
    .query({ q: 'hidden' })
    .set(authHeader(member.token));

  assert.equal(res.status, 200);
  // Member must not get a member/user directory group.
  assert.equal(findGroup(res.body, 'member'), undefined);

  const chapters = findGroup(res.body, 'chapter');
  assert.ok(chapters && chapters.items.length === 1, 'only the published chapter is returned');
  assert.equal(chapters.items[0].title, 'Hidden Public Chapter');
  assert.ok(chapters.items[0].link.startsWith('/chapters/'));

  const content = findGroup(res.body, 'content');
  assert.ok(content && content.items.length === 1, 'published lesson is returned');
});

test('short queries return no groups', async () => {
  const admin = await createUser({ role: 'admin' });
  const res = await request(suite.app)
    .get('/api/search')
    .query({ q: 'a' })
    .set(authHeader(admin.token));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.groups, []);
});
