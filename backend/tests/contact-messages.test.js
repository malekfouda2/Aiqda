import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import ContactMessage from '../src/modules/contact-messages/contactMessage.model.js';
import { authHeader, createUser, setupIntegrationSuite } from './helpers/integration.js';

const suite = setupIntegrationSuite();

test('public users can submit contact messages with valid details', async () => {
  const response = await request(suite.app)
    .post('/api/contact-messages')
    .send({
      fullName: '  Contact Tester  ',
      email: 'CONTACTER@EXAMPLE.COM',
      phone: '+966500000000',
      subject: 'Need help with subscriptions',
      message: 'I would like to know which package is the best fit for me.'
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.message, 'Your message has been sent successfully.');
  assert.equal(response.body.contactMessage.fullName, 'Contact Tester');
  assert.equal(response.body.contactMessage.email, 'contacter@example.com');
  assert.equal(response.body.contactMessage.isRead, false);

  const storedMessage = await ContactMessage.findById(response.body.contactMessage._id);
  assert.ok(storedMessage);
  assert.equal(storedMessage.subject, 'Need help with subscriptions');
});

test('admins can review, update, and delete contact messages', async () => {
  const admin = await createUser({ role: 'admin' });

  const createResponse = await request(suite.app)
    .post('/api/contact-messages')
    .send({
      fullName: 'Inbox Tester',
      email: 'inbox@example.com',
      phone: '',
      subject: 'Partnership idea',
      message: 'We would like to explore a collaboration.'
    });

  assert.equal(createResponse.status, 201);
  const messageId = createResponse.body.contactMessage._id;

  const listResponse = await request(suite.app)
    .get('/api/contact-messages')
    .set(authHeader(admin.token));
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.length, 1);
  assert.equal(listResponse.body[0].isRead, false);

  const markReadResponse = await request(suite.app)
    .patch(`/api/contact-messages/${messageId}/read`)
    .set(authHeader(admin.token));
  assert.equal(markReadResponse.status, 200);
  assert.equal(markReadResponse.body.isRead, true);
  assert.equal(markReadResponse.body.readBy._id, admin.user._id.toString());

  const readFilterResponse = await request(suite.app)
    .get('/api/contact-messages?status=read')
    .set(authHeader(admin.token));
  assert.equal(readFilterResponse.status, 200);
  assert.equal(readFilterResponse.body.length, 1);

  const markUnreadResponse = await request(suite.app)
    .patch(`/api/contact-messages/${messageId}/unread`)
    .set(authHeader(admin.token));
  assert.equal(markUnreadResponse.status, 200);
  assert.equal(markUnreadResponse.body.isRead, false);

  const detailResponse = await request(suite.app)
    .get(`/api/contact-messages/${messageId}`)
    .set(authHeader(admin.token));
  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.body.subject, 'Partnership idea');

  const deleteResponse = await request(suite.app)
    .delete(`/api/contact-messages/${messageId}`)
    .set(authHeader(admin.token));
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteResponse.body.message, 'Contact message deleted successfully');

  const storedMessage = await ContactMessage.findById(messageId);
  assert.equal(storedMessage, null);
});

test('contact submissions are rate limited', async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request(suite.app)
      .post('/api/contact-messages')
      .send({
        fullName: `Contact Tester ${attempt}`,
        email: `contact-${attempt}@example.com`,
        phone: '+966500000000',
        subject: 'Need help with subscriptions',
        message: 'I would like to know which package is the best fit for me.'
      });

    assert.equal(response.status, 201);
  }

  const limitedResponse = await request(suite.app)
    .post('/api/contact-messages')
    .send({
      fullName: 'Rate Limited Contact',
      email: 'rate-limited@example.com',
      phone: '+966500000000',
      subject: 'Need help with subscriptions',
      message: 'Please let me through.'
    });

  assert.equal(limitedResponse.status, 429);
  assert.equal(limitedResponse.body.error, 'Too many contact submissions. Please try again later.');
});
