import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import request from 'supertest';

import User from '../src/modules/users/user.model.js';
import {
  authHeader,
  createUser,
  setupIntegrationSuite
} from './helpers/integration.js';

const suite = setupIntegrationSuite();

// The teaser flow must never call the real Vimeo API in tests. With no access
// token configured, the service falls back to building the embed URL locally.
beforeEach(() => {
  delete process.env.VIMEO_ACCESS_TOKEN;
});

test('admins set a creator teaser by Vimeo ID and it appears on the public profile', async () => {
  const admin = await createUser({ role: 'admin' });
  const creator = await createUser({ role: 'instructor' });

  const setRes = await request(suite.app)
    .post(`/api/users/${creator.user._id}/teaser`)
    .set(authHeader(admin.token))
    .send({ vimeoVideoId: '123456789' });

  assert.equal(setRes.status, 200);
  assert.equal(setRes.body.teaserVimeoVideoId, '123456789');
  assert.match(setRes.body.teaserVimeoEmbedUrl, /player\.vimeo\.com\/video\/123456789/);

  const stored = await User.findById(creator.user._id).lean();
  assert.equal(stored.teaserVimeoVideoId, '123456789');

  const publicRes = await request(suite.app)
    .get(`/api/users/creators/${creator.user._id}/public`);
  assert.equal(publicRes.status, 200);
  assert.equal(publicRes.body.creator.teaserVimeoVideoId, '123456789');
  assert.match(publicRes.body.creator.teaserVimeoEmbedUrl, /123456789/);
});

test('a Vimeo URL is normalized down to the numeric video ID', async () => {
  const admin = await createUser({ role: 'admin' });
  const creator = await createUser({ role: 'instructor' });

  const setRes = await request(suite.app)
    .post(`/api/users/${creator.user._id}/teaser`)
    .set(authHeader(admin.token))
    .send({ vimeoVideoId: 'https://vimeo.com/987654321' });

  assert.equal(setRes.status, 200);
  assert.equal(setRes.body.teaserVimeoVideoId, '987654321');
});

test('admins can replace and then delete a creator teaser', async () => {
  const admin = await createUser({ role: 'admin' });
  const creator = await createUser({ role: 'instructor' });

  await request(suite.app)
    .post(`/api/users/${creator.user._id}/teaser`)
    .set(authHeader(admin.token))
    .send({ vimeoVideoId: '111111111' });

  const replaceRes = await request(suite.app)
    .post(`/api/users/${creator.user._id}/teaser`)
    .set(authHeader(admin.token))
    .send({ vimeoVideoId: '222222222' });
  assert.equal(replaceRes.status, 200);
  assert.equal(replaceRes.body.teaserVimeoVideoId, '222222222');

  const deleteRes = await request(suite.app)
    .delete(`/api/users/${creator.user._id}/teaser`)
    .set(authHeader(admin.token));
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.teaserVimeoVideoId, null);

  const publicRes = await request(suite.app)
    .get(`/api/users/creators/${creator.user._id}/public`);
  assert.equal(publicRes.body.creator.teaserVimeoVideoId, null);
});

test('an empty or non-numeric Vimeo ID is rejected', async () => {
  const admin = await createUser({ role: 'admin' });
  const creator = await createUser({ role: 'instructor' });

  for (const badId of ['', 'abc', '   ']) {
    const res = await request(suite.app)
      .post(`/api/users/${creator.user._id}/teaser`)
      .set(authHeader(admin.token))
      .send({ vimeoVideoId: badId });
    assert.equal(res.status, 400, `id "${badId}" should be rejected`);
    assert.equal(res.body.error, 'A Vimeo video ID is required');
  }
});

test('non-admins cannot manage a creator teaser', async () => {
  const creator = await createUser({ role: 'instructor' });
  const otherCreator = await createUser({ role: 'instructor' });

  const setRes = await request(suite.app)
    .post(`/api/users/${otherCreator.user._id}/teaser`)
    .set(authHeader(creator.token))
    .send({ vimeoVideoId: '123456789' });
  assert.equal(setRes.status, 403);

  const deleteRes = await request(suite.app)
    .delete(`/api/users/${otherCreator.user._id}/teaser`)
    .set(authHeader(creator.token));
  assert.equal(deleteRes.status, 403);
});

test('teaser can only be set on a creator account', async () => {
  const admin = await createUser({ role: 'admin' });
  const member = await createUser({ role: 'student' });

  const res = await request(suite.app)
    .post(`/api/users/${member.user._id}/teaser`)
    .set(authHeader(admin.token))
    .send({ vimeoVideoId: '123456789' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Creator not found');
});

test('a chapter page exposes its creator teaser to the member endpoint', async () => {
  const admin = await createUser({ role: 'admin' });
  const creator = await createUser({ role: 'instructor' });

  await request(suite.app)
    .post(`/api/users/${creator.user._id}/teaser`)
    .set(authHeader(admin.token))
    .send({ vimeoVideoId: '555555555' });

  const createRes = await request(suite.app)
    .post('/api/courses')
    .set(authHeader(creator.token))
    .send({
      title: 'Chapter With Teaser',
      description: 'Teaser propagation test',
      category: 'Design',
      level: 'beginner',
    });
  assert.equal(createRes.status, 201);

  const publishRes = await request(suite.app)
    .patch(`/api/courses/${createRes.body._id}/publish`)
    .set(authHeader(admin.token))
    .send({ isPublished: true });
  assert.equal(publishRes.status, 200);

  const member = await createUser({ role: 'student' });
  const courseRes = await request(suite.app)
    .get(`/api/courses/${createRes.body._id}`)
    .set(authHeader(member.token));

  assert.equal(courseRes.status, 200);
  assert.equal(courseRes.body.instructor.teaserVimeoVideoId, '555555555');
});
