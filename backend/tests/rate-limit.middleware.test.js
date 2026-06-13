import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test, { beforeEach } from 'node:test';

import {
  clearRateLimitStore,
  createIpRateLimiter,
} from '../src/middlewares/rateLimit.middleware.js';

process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORE = 'memory';

class MockResponse extends EventEmitter {
  constructor() {
    super();
    this.headers = new Map();
    this.statusCode = 200;
    this.body = null;
  }

  setHeader(name, value) {
    this.headers.set(name, value);
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(payload) {
    this.body = payload;
    this.emit('finish');
    return this;
  }
}

const createRequest = (ip = '203.0.113.10') => ({
  headers: {},
  ip,
  socket: { remoteAddress: ip },
});

beforeEach(async () => {
  await clearRateLimitStore();
});

test('application rate limits do not consume quota for failed validation responses', async () => {
  const middleware = createIpRateLimiter({
    namespace: 'test-instructor-application',
    windowMs: 60 * 60 * 1000,
    max: 1,
    message: 'Too many instructor applications from this IP. Please try again later.',
    shouldCountRequest: (_req, res) => res.statusCode >= 200 && res.statusCode < 300,
  });

  let nextCalls = 0;

  const failingRequest = createRequest();
  const failingResponse = new MockResponse();
  await middleware(failingRequest, failingResponse, () => {
    nextCalls += 1;
  });
  assert.equal(nextCalls, 1);

  failingResponse.status(400).json({ error: 'Validation failed' });

  const successfulRequest = createRequest();
  const successfulResponse = new MockResponse();
  await middleware(successfulRequest, successfulResponse, () => {
    nextCalls += 1;
  });
  assert.equal(nextCalls, 2);

  successfulResponse.status(201).json({ ok: true });

  const blockedRequest = createRequest();
  const blockedResponse = new MockResponse();
  let blockedNextCalled = false;
  await middleware(blockedRequest, blockedResponse, () => {
    blockedNextCalled = true;
  });

  assert.equal(blockedNextCalled, false);
  assert.equal(blockedResponse.statusCode, 429);
  assert.deepEqual(
    blockedResponse.body,
    { error: 'Too many instructor applications from this IP. Please try again later.' }
  );
});
