import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import TeamMember from '../src/modules/team-members/teamMember.model.js';
import { authHeader, createUser, setupIntegrationSuite } from './helpers/integration.js';

const suite = setupIntegrationSuite();

test('public team members endpoint seeds and returns active default members', async () => {
  const response = await request(suite.app)
    .get('/api/team-members');

  assert.equal(response.status, 200);
  assert.equal(response.body.length, 2);
  assert.equal(response.body[0].name, 'Abdulwahed Alabdlee');
  assert.equal(response.body[1].name, 'Michael Murengezi');

  const storedMembers = await TeamMember.find().sort({ order: 1 });
  assert.equal(storedMembers.length, 2);
});

test('admins can create, update, and delete team members with photos', async () => {
  const admin = await createUser({ role: 'admin' });

  await request(suite.app).get('/api/team-members');

  const createResponse = await request(suite.app)
    .post('/api/team-members')
    .set(authHeader(admin.token))
    .field('name', 'Jane Doe')
    .field('title', 'Head of Community')
    .field('order', '3')
    .field('isActive', 'true')
    .field('achievements', JSON.stringify(['Built the member community.', 'Leads partnerships.']))
    .attach('image', Buffer.from('fake-image-data'), {
      filename: 'team-photo.png',
      contentType: 'image/png',
    });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.name, 'Jane Doe');
  assert.match(createResponse.body.image, /^\/uploads\/team-members\//);
  assert.equal(createResponse.body.achievements.length, 2);

  const listResponse = await request(suite.app)
    .get('/api/team-members/admin')
    .set(authHeader(admin.token));

  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.length, 3);

  const updateResponse = await request(suite.app)
    .put(`/api/team-members/${createResponse.body._id}`)
    .set(authHeader(admin.token))
    .field('name', 'Jane Doe')
    .field('title', 'Head of Partnerships')
    .field('order', '4')
    .field('isActive', 'false')
    .field('achievements', JSON.stringify(['Leads international partnerships.']))
    .field('removeImage', 'true');

  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.title, 'Head of Partnerships');
  assert.equal(updateResponse.body.isActive, false);
  assert.equal(updateResponse.body.image, null);

  const publicResponse = await request(suite.app)
    .get('/api/team-members');
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.body.some((member) => member.name === 'Jane Doe'), false);

  const deleteResponse = await request(suite.app)
    .delete(`/api/team-members/${createResponse.body._id}`)
    .set(authHeader(admin.token));

  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteResponse.body.message, 'Team member deleted successfully');

  const storedMember = await TeamMember.findById(createResponse.body._id);
  assert.equal(storedMember, null);
});

test('default team members are seeded only once so admins can intentionally leave the section empty', async () => {
  const admin = await createUser({ role: 'admin' });

  const initialPublicResponse = await request(suite.app)
    .get('/api/team-members');

  assert.equal(initialPublicResponse.status, 200);
  assert.equal(initialPublicResponse.body.length, 2);

  const seededMembers = await TeamMember.find().sort({ order: 1 });
  assert.equal(seededMembers.length, 2);

  for (const member of seededMembers) {
    const deleteResponse = await request(suite.app)
      .delete(`/api/team-members/${member._id}`)
      .set(authHeader(admin.token));

    assert.equal(deleteResponse.status, 200);
  }

  const emptyPublicResponse = await request(suite.app)
    .get('/api/team-members');

  assert.equal(emptyPublicResponse.status, 200);
  assert.equal(emptyPublicResponse.body.length, 0);
});
