import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import { authHeader, createUser, setupIntegrationSuite } from './helpers/integration.js';

const suite = setupIntegrationSuite();

test('public whatsapp settings default to disabled until configured', async () => {
  const response = await request(suite.app)
    .get('/api/whatsapp-settings');

  assert.equal(response.status, 200);
  assert.equal(response.body.isEnabled, false);
  assert.equal(response.body.englishNumber, '');
  assert.equal(response.body.arabicNumber, '');
  assert.equal(response.body.hasEnglishNumber, false);
  assert.equal(response.body.hasArabicNumber, false);
});

test('admins can configure whatsapp chat numbers for english and arabic', async () => {
  const admin = await createUser({ role: 'admin' });

  const updateResponse = await request(suite.app)
    .put('/api/whatsapp-settings/admin')
    .set(authHeader(admin.token))
    .send({
      isEnabled: true,
      englishNumber: '+44 7700 900123',
      arabicNumber: '00966500000000',
    });

  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.isEnabled, true);
  assert.equal(updateResponse.body.englishNumber, '447700900123');
  assert.equal(updateResponse.body.arabicNumber, '966500000000');

  const adminReadResponse = await request(suite.app)
    .get('/api/whatsapp-settings/admin')
    .set(authHeader(admin.token));

  assert.equal(adminReadResponse.status, 200);
  assert.equal(adminReadResponse.body.englishNumber, '447700900123');
  assert.equal(adminReadResponse.body.arabicNumber, '966500000000');

  const publicResponse = await request(suite.app)
    .get('/api/whatsapp-settings');

  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.body.isEnabled, true);
  assert.equal(publicResponse.body.englishNumber, '447700900123');
  assert.equal(publicResponse.body.arabicNumber, '966500000000');
  assert.equal(publicResponse.body.hasEnglishNumber, true);
  assert.equal(publicResponse.body.hasArabicNumber, true);
});

test('whatsapp settings validation blocks enabling the widget without any numbers', async () => {
  const admin = await createUser({ role: 'admin' });

  const response = await request(suite.app)
    .put('/api/whatsapp-settings/admin')
    .set(authHeader(admin.token))
    .send({
      isEnabled: true,
      englishNumber: '',
      arabicNumber: '',
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Add at least one WhatsApp number before enabling the floating chat button.');
});
