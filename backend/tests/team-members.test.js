import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';

import TeamMember from '../src/modules/team-members/teamMember.model.js';
import { authHeader, createUser, setupIntegrationSuite } from './helpers/integration.js';

const suite = setupIntegrationSuite();
const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZL2sAAAAASUVORK5CYII=',
  'base64'
);
const TEAM_MEMBER_UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'team-members');

const listTeamMemberUploadFiles = async () => {
  try {
    return new Set(await fs.readdir(TEAM_MEMBER_UPLOADS_DIR));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return new Set();
    }

    throw error;
  }
};

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
    .attach('image', VALID_PNG_BUFFER, {
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

test('failed team member saves do not leak uploaded images or delete the current photo', async () => {
  const admin = await createUser({ role: 'admin' });

  await request(suite.app).get('/api/team-members');

  const beforeInvalidCreateFiles = await listTeamMemberUploadFiles();
  const invalidCreateResponse = await request(suite.app)
    .post('/api/team-members')
    .set(authHeader(admin.token))
    .field('name', '   ')
    .field('title', 'Creative Lead')
    .attach('image', VALID_PNG_BUFFER, {
      filename: 'invalid-create.png',
      contentType: 'image/png',
    });

  assert.equal(invalidCreateResponse.status, 400);
  assert.equal(invalidCreateResponse.body.error, 'Name is required');
  assert.deepEqual(await listTeamMemberUploadFiles(), beforeInvalidCreateFiles);

  const createResponse = await request(suite.app)
    .post('/api/team-members')
    .set(authHeader(admin.token))
    .field('name', 'Safe Photo User')
    .field('title', 'Creative Lead')
    .attach('image', VALID_PNG_BUFFER, {
      filename: 'safe-photo.png',
      contentType: 'image/png',
    });

  assert.equal(createResponse.status, 201);
  const originalImage = createResponse.body.image;
  const beforeFailedUpdateFiles = await listTeamMemberUploadFiles();

  const invalidUpdateResponse = await request(suite.app)
    .put(`/api/team-members/${createResponse.body._id}`)
    .set(authHeader(admin.token))
    .field('name', 'Safe Photo User')
    .field('title', 'x'.repeat(161))
    .attach('image', VALID_PNG_BUFFER, {
      filename: 'replacement-photo.png',
      contentType: 'image/png',
    });

  assert.equal(invalidUpdateResponse.status, 400);
  assert.equal(invalidUpdateResponse.body.error, 'Title is too long');

  const storedMember = await TeamMember.findById(createResponse.body._id);
  assert.equal(storedMember.image, originalImage);
  assert.deepEqual(await listTeamMemberUploadFiles(), beforeFailedUpdateFiles);
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
