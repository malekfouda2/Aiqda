import assert from 'node:assert/strict';
import { afterEach } from 'node:test';
import test from 'node:test';
import request from 'supertest';

import User from '../src/modules/users/user.model.js';
import { createUser, setupIntegrationSuite } from './helpers/integration.js';

const suite = setupIntegrationSuite();
const originalFetch = globalThis.fetch;

const SOCIAL_ENV_KEYS = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'LINKEDIN_OAUTH_CLIENT_ID',
  'LINKEDIN_OAUTH_CLIENT_SECRET',
  'FRONTEND_URL',
];
const originalSocialEnv = Object.fromEntries(
  SOCIAL_ENV_KEYS.map((key) => [key, process.env[key]])
);

const createJsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() {
    return body;
  },
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of SOCIAL_ENV_KEYS) {
    if (originalSocialEnv[key] == null) {
      delete process.env[key];
    } else {
      process.env[key] = originalSocialEnv[key];
    }
  }
});

test('social providers endpoint only lists configured providers', async () => {
  for (const key of SOCIAL_ENV_KEYS) {
    delete process.env[key];
  }

  let response = await request(suite.app)
    .get('/api/auth/social/providers');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);

  process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client-id';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-client-secret';
  process.env.LINKEDIN_OAUTH_CLIENT_ID = 'linkedin-client-id';
  process.env.LINKEDIN_OAUTH_CLIENT_SECRET = 'linkedin-client-secret';

  response = await request(suite.app)
    .get('/api/auth/social/providers');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, [
    {
      key: 'google',
      name: 'Google',
      startPath: '/api/auth/social/google/start',
    },
    {
      key: 'linkedin',
      name: 'LinkedIn',
      startPath: '/api/auth/social/linkedin/start',
    },
  ]);
});

test('google social sign-in can create a new student account and complete login', async () => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client-id';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-client-secret';
  process.env.FRONTEND_URL = 'http://localhost:5000';

  globalThis.fetch = async (url) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return createJsonResponse({
        access_token: 'google-access-token',
      });
    }

    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
      return createJsonResponse({
        sub: 'google-user-123',
        email: 'social.student@example.com',
        email_verified: true,
        name: 'Social Student',
        picture: 'https://example.com/avatar.png',
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const startResponse = await request(suite.app)
    .get('/api/auth/social/google/start')
    .set('host', 'localhost:3001')
    .query({ redirect: '/courses/welcome' });

  assert.equal(startResponse.status, 302);
  const authorizationUrl = new URL(startResponse.headers.location);
  assert.equal(`${authorizationUrl.origin}${authorizationUrl.pathname}`, 'https://accounts.google.com/o/oauth2/v2/auth');
  const state = authorizationUrl.searchParams.get('state');
  assert.ok(state);

  const callbackResponse = await request(suite.app)
    .get('/api/auth/social/google/callback')
    .set('host', 'localhost:3001')
    .query({
      code: 'google-auth-code',
      state,
    });

  assert.equal(callbackResponse.status, 302);
  const frontendRedirectUrl = new URL(callbackResponse.headers.location);
  assert.equal(
    `${frontendRedirectUrl.origin}${frontendRedirectUrl.pathname}`,
    'http://localhost:5000/auth/social/callback'
  );

  const completionToken = frontendRedirectUrl.searchParams.get('token');
  assert.ok(completionToken);

  const completeResponse = await request(suite.app)
    .post('/api/auth/social/complete')
    .send({ token: completionToken });

  assert.equal(completeResponse.status, 200);
  assert.equal(completeResponse.body.user.email, 'social.student@example.com');
  assert.equal(completeResponse.body.user.name, 'Social Student');
  assert.equal(completeResponse.body.user.role, 'student');
  assert.equal(completeResponse.body.user.avatar, 'https://example.com/avatar.png');
  assert.equal(completeResponse.body.redirectPath, '/courses/welcome');
  assert.equal(typeof completeResponse.body.token, 'string');
  assert.ok(completeResponse.body.token.length > 10);

  const storedUser = await User.findOne({ email: 'social.student@example.com' }).lean();
  assert.equal(storedUser.password, null);
  assert.equal(storedUser.authProviders.google.subject, 'google-user-123');
  assert.equal(storedUser.authProviders.google.email, 'social.student@example.com');
});

test('linkedin social sign-in links an existing account and preserves its role', async () => {
  process.env.LINKEDIN_OAUTH_CLIENT_ID = 'linkedin-client-id';
  process.env.LINKEDIN_OAUTH_CLIENT_SECRET = 'linkedin-client-secret';
  process.env.FRONTEND_URL = 'http://localhost:5000';

  const existingInstructor = await createUser({
    email: 'creator@example.com',
    role: 'instructor',
    name: 'Existing Creator',
  });

  globalThis.fetch = async (url) => {
    if (url === 'https://www.linkedin.com/oauth/v2/accessToken') {
      return createJsonResponse({
        access_token: 'linkedin-access-token',
      });
    }

    if (url === 'https://api.linkedin.com/v2/userinfo') {
      return createJsonResponse({
        sub: 'linkedin-user-789',
        email: 'creator@example.com',
        email_verified: true,
        name: 'Existing Creator',
        picture: 'https://example.com/linkedin-avatar.png',
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const startResponse = await request(suite.app)
    .get('/api/auth/social/linkedin/start')
    .set('host', 'localhost:3001');

  assert.equal(startResponse.status, 302);
  const authorizationUrl = new URL(startResponse.headers.location);
  const state = authorizationUrl.searchParams.get('state');
  assert.ok(state);

  const callbackResponse = await request(suite.app)
    .get('/api/auth/social/linkedin/callback')
    .set('host', 'localhost:3001')
    .query({
      code: 'linkedin-auth-code',
      state,
    });

  assert.equal(callbackResponse.status, 302);
  const frontendRedirectUrl = new URL(callbackResponse.headers.location);
  const completionToken = frontendRedirectUrl.searchParams.get('token');
  assert.ok(completionToken);

  const completeResponse = await request(suite.app)
    .post('/api/auth/social/complete')
    .send({ token: completionToken });

  assert.equal(completeResponse.status, 200);
  assert.equal(completeResponse.body.user.email, 'creator@example.com');
  assert.equal(completeResponse.body.user.role, 'instructor');
  assert.equal(completeResponse.body.redirectPath, '/instructor');

  const linkedUser = await User.findById(existingInstructor.user._id).lean();
  assert.equal(linkedUser.authProviders.linkedin.subject, 'linkedin-user-789');
  assert.equal(linkedUser.authProviders.linkedin.email, 'creator@example.com');
  assert.equal(linkedUser.avatar, 'https://example.com/linkedin-avatar.png');
});

test('social sign-in does not bypass pending invited accounts', async () => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client-id';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-client-secret';
  process.env.FRONTEND_URL = 'http://localhost:5000';

  await createUser({
    email: 'pending-invite@example.com',
    role: 'instructor',
    mustChangePassword: true,
    name: 'Pending Invite',
  });

  globalThis.fetch = async (url) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return createJsonResponse({
        access_token: 'google-access-token',
      });
    }

    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
      return createJsonResponse({
        sub: 'google-user-pending',
        email: 'pending-invite@example.com',
        email_verified: true,
        name: 'Pending Invite',
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const startResponse = await request(suite.app)
    .get('/api/auth/social/google/start')
    .set('host', 'localhost:3001');
  const state = new URL(startResponse.headers.location).searchParams.get('state');

  const callbackResponse = await request(suite.app)
    .get('/api/auth/social/google/callback')
    .set('host', 'localhost:3001')
    .query({
      code: 'google-auth-code',
      state,
    });

  assert.equal(callbackResponse.status, 302);
  const frontendRedirectUrl = new URL(callbackResponse.headers.location);
  assert.equal(
    frontendRedirectUrl.searchParams.get('error'),
    'Account setup is still pending. Use your invitation link to finish setting your password.'
  );
});
