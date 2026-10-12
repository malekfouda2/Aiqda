import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach } from 'node:test';
import test from 'node:test';
import request from 'supertest';

import ConsultationBooking from '../src/modules/consultations/consultationBooking.model.js';
import Payment from '../src/modules/payments/payment.model.js';
import { processDueTapSubscriptionRenewals } from '../src/modules/payments/payments.service.js';
import { Subscription } from '../src/modules/subscriptions/subscription.model.js';
import {
  authHeader,
  createConsultation,
  createSubscription,
  createSubscriptionPackage,
  createUser,
  setupIntegrationSuite,
} from './helpers/integration.js';

const suite = setupIntegrationSuite();
const originalFetch = globalThis.fetch;
const ENV_KEYS = [
  'TAP_SECRET_KEY',
  'TAP_PUBLIC_KEY',
  'APP_URL',
  'FRONTEND_URL',
  'SUBSCRIPTION_CURRENCY',
  'SUBSCRIPTION_RENEWAL_MAX_RETRIES',
  'SUBSCRIPTION_RENEWAL_RETRY_DELAYS_HOURS',
];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const TAP_CHARGES_URL = 'https://api.tap.company/v2/charges';

const createTextResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  async text() {
    return JSON.stringify(body);
  },
});

const configureTap = () => {
  process.env.TAP_SECRET_KEY = 'sk_test_tap_secret_key';
  process.env.TAP_PUBLIC_KEY = 'pk_test_tap_public_key';
  process.env.APP_URL = 'http://localhost:3001';
  process.env.FRONTEND_URL = 'http://localhost:5000';
  process.env.SUBSCRIPTION_CURRENCY = 'SAR';
};

const buildCharge = (id, status, requestBody, overrides = {}) => ({
  id,
  object: 'charge',
  status,
  amount: requestBody.amount,
  currency: requestBody.currency,
  transaction: {
    created: '1710000000000',
    ...(status === 'INITIATED' ? { url: `https://tap.example/pay/${id}` } : {}),
  },
  reference: {
    payment: `pay_ref_${id}`,
    gateway: `gw_ref_${id}`,
    transaction: requestBody.reference.transaction,
    order: requestBody.reference.order,
  },
  response: {
    code: status === 'CAPTURED' ? '000' : '100',
    message: status,
  },
  metadata: requestBody.metadata,
  ...overrides,
});

const sendWebhook = (charge) => {
  const hashString = createHmac('sha256', process.env.TAP_SECRET_KEY)
    .update([
      `x_id${charge.id}`,
      `x_amount${Number(charge.amount).toFixed(2)}`,
      `x_currency${charge.currency}`,
      `x_gateway_reference${charge.reference?.gateway || ''}`,
      `x_payment_reference${charge.reference?.payment || ''}`,
      `x_status${charge.status}`,
      `x_created${charge.transaction?.created || ''}`,
    ].join(''))
    .digest('hex');

  return request(suite.app)
    .post('/api/payments/tap/webhook')
    .set('hashstring', hashString)
    .send(charge);
};

// Simulates Tap: remembers every created charge so it can be retrieved later.
const installTapMock = () => {
  const charges = new Map();
  const createdBodies = [];

  globalThis.fetch = async (url, options = {}) => {
    if (url === 'https://api.tap.company/v2/tokens/') {
      return createTextResponse({ id: `tok_saved_${createdBodies.length + 1}` });
    }

    if (url === TAP_CHARGES_URL && options.method === 'POST') {
      const requestBody = JSON.parse(options.body);
      createdBodies.push(requestBody);
      const charge = buildCharge(`chg_${createdBodies.length}`, 'INITIATED', requestBody);
      charges.set(charge.id, charge);
      return createTextResponse(charge);
    }

    if (url.startsWith(`${TAP_CHARGES_URL}/`)) {
      const charge = charges.get(url.slice(TAP_CHARGES_URL.length + 1));
      return charge ? createTextResponse(charge) : createTextResponse({ errors: [{ description: 'Not found' }] }, 404);
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  return { charges, createdBodies };
};

const createPendingCheckout = async (name) => {
  const student = await createUser({ role: 'student', name });
  const packageRecord = await createSubscriptionPackage({ price: 299 });
  const subscription = await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'pending',
    currency: 'SAR',
  });

  const startCheckout = (body) => request(suite.app)
    .post('/api/payments/tap/charge')
    .set(authHeader(student.token))
    .send({
      subscriptionId: subscription._id.toString(),
      phoneCountryCode: '966',
      phoneNumber: '512345678',
      checkoutDisclaimerAccepted: true,
      ...body,
    });

  return { student, subscription, startCheckout };
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of ENV_KEYS) {
    if (originalEnv[key] == null) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
});

test('an abandoned hosted checkout does not block the next attempt or corrupt the paid one', async () => {
  configureTap();
  const tap = installTapMock();
  const { subscription, startCheckout } = await createPendingCheckout('Abandoned Tabby Student');

  const tabbyAttempt = await startCheckout({ checkoutMethod: 'tabby' });
  assert.equal(tabbyAttempt.status, 201);
  assert.equal(tabbyAttempt.body.chargeId, 'chg_1');

  // The member leaves Tabby and immediately retries with a card.
  const cardAttempt = await startCheckout({ checkoutMethod: 'card', tokenId: 'tok_card_retry' });
  assert.equal(cardAttempt.status, 201);
  assert.equal(cardAttempt.body.chargeId, 'chg_2');
  assert.equal(cardAttempt.body.redirectUrl, 'https://tap.example/pay/chg_2');

  const supersededPayment = await Payment.findOne({ tapChargeId: 'chg_1' });
  assert.equal(supersededPayment.status, 'cancelled');
  assert.match(supersededPayment.failureReason, /Superseded/);

  const capturedCharge = { ...tap.charges.get('chg_2'), status: 'CAPTURED' };
  assert.equal((await sendWebhook(capturedCharge)).status, 200);
  assert.equal((await Subscription.findById(subscription._id)).status, 'active');

  // Production incident: the first payment record was deleted, then Tap's delayed
  // ABANDONED webhook for it matched the paid payment through the order reference.
  await Payment.deleteOne({ _id: supersededPayment._id });
  const abandonedCharge = { ...tap.charges.get('chg_1'), status: 'ABANDONED' };
  assert.equal((await sendWebhook(abandonedCharge)).status, 200);

  const paidPayment = await Payment.findOne({ subscription: subscription._id });
  assert.equal(paidPayment.status, 'captured');
  assert.equal(paidPayment.tapChargeId, 'chg_2');
  assert.equal(paidPayment.checkoutMethod, 'card');
  assert.equal(await Payment.countDocuments({ subscription: subscription._id }), 1);
});

test('a late webhook for an older state never downgrades a captured payment', async () => {
  configureTap();
  const tap = installTapMock();
  const { subscription, startCheckout } = await createPendingCheckout('Out Of Order Student');

  await startCheckout({ checkoutMethod: 'card', tokenId: 'tok_card' });
  const initiatedCharge = tap.charges.get('chg_1');

  assert.equal((await sendWebhook({ ...initiatedCharge, status: 'CAPTURED' })).status, 200);
  assert.equal((await sendWebhook(initiatedCharge)).status, 200);

  assert.equal((await Payment.findOne({ tapChargeId: 'chg_1' })).status, 'captured');
  assert.equal((await Subscription.findById(subscription._id)).status, 'active');
});

test('retrying after a checkout that Tap already captured activates it instead of charging again', async () => {
  configureTap();
  const tap = installTapMock();
  const { subscription, startCheckout } = await createPendingCheckout('Missed Webhook Student');

  await startCheckout({ checkoutMethod: 'card', tokenId: 'tok_card' });
  // The member paid on the 3DS page, but neither the redirect nor the webhook reached us.
  tap.charges.set('chg_1', { ...tap.charges.get('chg_1'), status: 'CAPTURED' });

  const retry = await startCheckout({ checkoutMethod: 'card', tokenId: 'tok_card_second' });
  assert.equal(retry.status, 201);
  assert.equal(retry.body.payment.status, 'captured');
  assert.equal(retry.body.chargeId, 'chg_1');
  assert.equal(retry.body.redirectUrl, null);
  assert.equal(tap.createdBodies.length, 1);
  assert.equal((await Subscription.findById(subscription._id)).status, 'active');
});

test('a checkout whose charge is still being created rejects a duplicate submission', async () => {
  configureTap();
  installTapMock();
  const { student, subscription, startCheckout } = await createPendingCheckout('Double Click Student');

  await Payment.create({
    user: student.user._id,
    subscription: subscription._id,
    amount: 299,
    currency: 'SAR',
    provider: 'tap',
    status: 'initiated',
    paymentType: 'initial',
    checkoutMethod: 'card',
  });

  const duplicate = await startCheckout({ checkoutMethod: 'card', tokenId: 'tok_card' });
  assert.equal(duplicate.status, 400);
  assert.match(duplicate.body.error, /already in progress/);
});

test('an abandoned consultation checkout can be retried', async () => {
  configureTap();
  installTapMock();
  const student = await createUser({ role: 'student', name: 'Abandoned Tamara Student' });
  const consultation = await createConsultation({ price: 250, currency: 'SAR' });

  const startCheckout = (checkoutMethod) => request(suite.app)
    .post('/api/consultation-bookings/checkout')
    .set(authHeader(student.token))
    .send({
      consultationId: consultation._id.toString(),
      checkoutMethod,
      phoneCountryCode: '966',
      phoneNumber: '512345678',
      checkoutDisclaimerAccepted: true,
    });

  const firstAttempt = await startCheckout('tamara');
  assert.equal(firstAttempt.status, 201);

  const retry = await startCheckout('tabby');
  assert.equal(retry.status, 201);
  assert.equal(retry.body.chargeId, 'chg_2');
  assert.notEqual(retry.body.bookingId, firstAttempt.body.bookingId);

  assert.equal((await ConsultationBooking.findById(firstAttempt.body.bookingId)).status, 'payment_failed');
  assert.equal((await ConsultationBooking.findById(retry.body.bookingId)).status, 'payment_pending');
});

test('each automatic renewal retry sends a new charge to Tap', async () => {
  configureTap();
  process.env.SUBSCRIPTION_RENEWAL_MAX_RETRIES = '3';
  process.env.SUBSCRIPTION_RENEWAL_RETRY_DELAYS_HOURS = '12,36,72';

  const student = await createUser({ role: 'student', name: 'Renewal Retry Student' });
  student.user.tapCustomerId = 'cus_saved_retry';
  student.user.tapCardId = 'card_saved_retry';
  student.user.tapPaymentAgreementId = 'payment_agreement_saved_retry';
  await student.user.save();

  const packageRecord = await createSubscriptionPackage({ price: 299, durationDays: 30 });
  const subscription = await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'active',
    startDate: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)),
    endDate: new Date(Date.now() - (5 * 60 * 1000)),
    durationDaysSnapshot: 30,
    priceAtPurchase: 299,
  });
  subscription.autoRenewEnabled = true;
  await subscription.save();

  const idempotencyKeys = [];
  globalThis.fetch = async (url, options = {}) => {
    if (url === 'https://api.tap.company/v2/tokens/') {
      return createTextResponse({ id: 'tok_saved_retry' });
    }

    const requestBody = JSON.parse(options.body);
    idempotencyKeys.push(requestBody.reference.idempotent);
    const isRetry = idempotencyKeys.length > 1;
    return createTextResponse(buildCharge(
      `chg_renewal_${idempotencyKeys.length}`,
      isRetry ? 'CAPTURED' : 'FAILED',
      requestBody,
      isRetry ? {} : { response: { code: '301', message: 'Insufficient funds' } }
    ));
  };

  assert.equal((await processDueTapSubscriptionRenewals()).failed, 1);

  await Subscription.updateOne(
    { _id: subscription._id },
    { $set: { nextRenewalRetryAt: new Date(Date.now() - 1000) } }
  );
  const retryResult = await processDueTapSubscriptionRenewals();
  assert.equal(retryResult.renewed, 1);

  assert.equal(idempotencyKeys.length, 2);
  assert.notEqual(idempotencyKeys[0], idempotencyKeys[1]);
  assert.equal(await Payment.countDocuments({ subscription: subscription._id, paymentType: 'renewal' }), 2);

  const renewedSubscription = await Subscription.findById(subscription._id);
  assert.equal(renewedSubscription.status, 'active');
  assert.equal(renewedSubscription.renewalFailureCount, 0);
});
