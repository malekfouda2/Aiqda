import assert from 'node:assert/strict';
import { afterEach } from 'node:test';
import test from 'node:test';
import request from 'supertest';

import Payment from '../src/modules/payments/payment.model.js';
import { processDueTapSubscriptionRenewals } from '../src/modules/payments/payments.service.js';
import { Subscription } from '../src/modules/subscriptions/subscription.model.js';
import User from '../src/modules/users/user.model.js';
import {
  authHeader,
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
  'SUBSCRIPTION_RENEWAL_GRACE_PERIOD_DAYS',
  'SUBSCRIPTION_RENEWAL_MAX_RETRIES',
  'SUBSCRIPTION_RENEWAL_RETRY_DELAYS_HOURS',
];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

const createTextResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  async text() {
    return JSON.stringify(body);
  },
});

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

test('members can turn subscription auto-renew off and back on when a Tap card is saved', async () => {
  const student = await createUser({ role: 'student' });
  student.user.tapCustomerId = 'cus_saved_123';
  student.user.tapCardId = 'card_saved_123';
  student.user.tapPaymentAgreementId = 'payment_agreement_saved_123';
  await student.user.save();

  const packageRecord = await createSubscriptionPackage({ price: 499 });
  const activeSubscription = await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)),
  });
  activeSubscription.autoRenewEnabled = true;
  await activeSubscription.save();

  const disableResponse = await request(suite.app)
    .patch(`/api/subscriptions/${activeSubscription._id}/auto-renew`)
    .set(authHeader(student.token))
    .send({ enabled: false });

  assert.equal(disableResponse.status, 200);
  assert.equal(disableResponse.body.autoRenewEnabled, false);
  assert.equal(disableResponse.body.autoRenewDisabledReason, 'member');

  const enableResponse = await request(suite.app)
    .patch(`/api/subscriptions/${activeSubscription._id}/auto-renew`)
    .set(authHeader(student.token))
    .send({ enabled: true });

  assert.equal(enableResponse.status, 200);
  assert.equal(enableResponse.body.autoRenewEnabled, true);
  assert.equal(enableResponse.body.autoRenewDisabledReason, null);
});

test('due subscriptions renew automatically through Tap MIT charges using the saved card', async () => {
  process.env.TAP_SECRET_KEY = 'sk_test_tap_secret_key';
  process.env.TAP_PUBLIC_KEY = 'pk_test_tap_public_key';
  process.env.APP_URL = 'http://localhost:3001';
  process.env.FRONTEND_URL = 'http://localhost:5000';
  process.env.SUBSCRIPTION_CURRENCY = 'SAR';

  const student = await createUser({ role: 'student', name: 'Renewal Student' });
  student.user.phone = { countryCode: '966', number: '512345678' };
  student.user.tapCustomerId = 'cus_saved_123';
  student.user.tapCardId = 'card_saved_123';
  student.user.tapPaymentAgreementId = 'payment_agreement_saved_123';
  await student.user.save();

  const packageRecord = await createSubscriptionPackage({ price: 499, durationDays: 30 });
  const previousEndDate = new Date(Date.now() - (5 * 60 * 1000));
  const activeSubscription = await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'active',
    startDate: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)),
    endDate: previousEndDate,
    durationDaysSnapshot: 30,
    priceAtPurchase: 499,
  });
  activeSubscription.autoRenewEnabled = true;
  await activeSubscription.save();

  const fetchCalls = [];
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({
      url,
      body: options.body ? JSON.parse(options.body) : null,
    });

    if (url === 'https://api.tap.company/v2/tokens/') {
      return createTextResponse({ id: 'tok_saved_renewal_123' });
    }

    if (url === 'https://api.tap.company/v2/charges') {
      const requestBody = JSON.parse(options.body);
      return createTextResponse({
        id: 'chg_renewal_123',
        object: 'charge',
        status: 'CAPTURED',
        amount: requestBody.amount,
        currency: requestBody.currency,
        customer_initiated: false,
        threeDSecure: false,
        save_card: false,
        transaction: {
          created: '1710000000000',
          amount: requestBody.amount,
          currency: requestBody.currency,
        },
        reference: {
          payment: '240000000000099',
          gateway: 'GW-RENEW-001',
          transaction: requestBody.reference.transaction,
          order: requestBody.reference.order,
        },
        response: {
          code: '000',
          message: 'Captured',
        },
        customer: {
          id: 'cus_saved_123',
          email: 'renewal.student@example.com',
        },
        card: {
          id: 'card_saved_123',
          brand: 'VISA',
          last_four: '1111',
        },
        payment_agreement: {
          id: 'payment_agreement_saved_123',
          contract: {
            id: 'card_saved_123',
            customer_id: 'cus_saved_123',
            type: 'SAVED_CARD',
          },
        },
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const result = await processDueTapSubscriptionRenewals();
  assert.equal(result.processed, 1);
  assert.equal(result.renewed, 1);
  assert.equal(result.failed, 0);

  assert.equal(fetchCalls[0].url, 'https://api.tap.company/v2/tokens/');
  assert.deepEqual(fetchCalls[0].body.saved_card, {
    card_id: 'card_saved_123',
    customer_id: 'cus_saved_123',
  });
  assert.equal(fetchCalls[1].url, 'https://api.tap.company/v2/charges');
  assert.equal(fetchCalls[1].body.customer_initiated, false);
  assert.equal(fetchCalls[1].body.threeDSecure, false);
  assert.equal(fetchCalls[1].body.payment_agreement.id, 'payment_agreement_saved_123');
  assert.equal(fetchCalls[1].body.source.id, 'tok_saved_renewal_123');

  const renewalPayment = await Payment.findOne({
    subscription: activeSubscription._id,
    paymentType: 'renewal',
  });
  assert.ok(renewalPayment);
  assert.equal(renewalPayment.status, 'captured');
  assert.equal(renewalPayment.customerInitiated, false);

  const renewedSubscription = await Subscription.findById(activeSubscription._id);
  assert.equal(renewedSubscription.status, 'active');
  assert.equal(renewedSubscription.autoRenewEnabled, true);
  assert.ok(renewedSubscription.lastRenewalAt);
  assert.ok(renewedSubscription.endDate > previousEndDate);
  assert.equal(renewedSubscription.renewalFailureReason, null);
});

test('failed automatic renewals move subscriptions into grace period and schedule a retry', async () => {
  process.env.TAP_SECRET_KEY = 'sk_test_tap_secret_key';
  process.env.TAP_PUBLIC_KEY = 'pk_test_tap_public_key';
  process.env.APP_URL = 'http://localhost:3001';
  process.env.FRONTEND_URL = 'http://localhost:5000';
  process.env.SUBSCRIPTION_CURRENCY = 'SAR';
  process.env.SUBSCRIPTION_RENEWAL_GRACE_PERIOD_DAYS = '7';
  process.env.SUBSCRIPTION_RENEWAL_MAX_RETRIES = '3';
  process.env.SUBSCRIPTION_RENEWAL_RETRY_DELAYS_HOURS = '12,36,72';

  const student = await createUser({ role: 'student', name: 'Failed Renewal Student' });
  student.user.tapCustomerId = 'cus_saved_456';
  student.user.tapCardId = 'card_saved_456';
  student.user.tapPaymentAgreementId = 'payment_agreement_saved_456';
  await student.user.save();

  const packageRecord = await createSubscriptionPackage({ price: 499, durationDays: 30 });
  const activeSubscription = await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'active',
    startDate: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)),
    endDate: new Date(Date.now() - (5 * 60 * 1000)),
    durationDaysSnapshot: 30,
    priceAtPurchase: 499,
  });
  activeSubscription.autoRenewEnabled = true;
  await activeSubscription.save();

  globalThis.fetch = async (url, options = {}) => {
    if (url === 'https://api.tap.company/v2/tokens/') {
      return createTextResponse({ id: 'tok_saved_renewal_456' });
    }

    if (url === 'https://api.tap.company/v2/charges') {
      const requestBody = JSON.parse(options.body);
      return createTextResponse({
        id: 'chg_renewal_456',
        object: 'charge',
        status: 'FAILED',
        amount: requestBody.amount,
        currency: requestBody.currency,
        customer_initiated: false,
        threeDSecure: false,
        save_card: false,
        transaction: {
          created: '1710000000001',
          amount: requestBody.amount,
          currency: requestBody.currency,
        },
        reference: {
          payment: '240000000000199',
          gateway: 'GW-RENEW-FAIL-001',
          transaction: requestBody.reference.transaction,
          order: requestBody.reference.order,
        },
        response: {
          code: '301',
          message: 'Card expired',
        },
        customer: {
          id: 'cus_saved_456',
          email: 'failed.renewal.student@example.com',
        },
        card: {
          id: 'card_saved_456',
          brand: 'VISA',
          last_four: '2222',
        },
        payment_agreement: {
          id: 'payment_agreement_saved_456',
          contract: {
            id: 'card_saved_456',
            customer_id: 'cus_saved_456',
            type: 'SAVED_CARD',
          },
        },
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const result = await processDueTapSubscriptionRenewals();
  assert.equal(result.processed, 1);
  assert.equal(result.renewed, 0);
  assert.equal(result.failed, 1);

  const failedRenewalPayment = await Payment.findOne({
    subscription: activeSubscription._id,
    paymentType: 'renewal',
  });
  assert.ok(failedRenewalPayment);
  assert.equal(failedRenewalPayment.status, 'failed');
  assert.equal(failedRenewalPayment.failureReason, 'Card expired');

  const graceSubscription = await Subscription.findById(activeSubscription._id);
  assert.equal(graceSubscription.status, 'grace_period');
  assert.equal(graceSubscription.autoRenewEnabled, true);
  assert.equal(graceSubscription.autoRenewDisabledReason, null);
  assert.equal(graceSubscription.renewalFailureReason, 'Card expired');
  assert.equal(graceSubscription.renewalFailureCount, 1);
  assert.ok(graceSubscription.gracePeriodEndsAt);
  assert.ok(graceSubscription.nextRenewalRetryAt);
});

test('members can remove the saved payment method and automatic renewal is turned off', async () => {
  const student = await createUser({ role: 'student' });
  student.user.tapCustomerId = 'cus_saved_remove_123';
  student.user.tapCardId = 'card_saved_remove_123';
  student.user.tapPaymentAgreementId = 'payment_agreement_saved_remove_123';
  student.user.tapCardBrand = 'VISA';
  student.user.tapCardLastFour = '1111';
  await student.user.save();

  const packageRecord = await createSubscriptionPackage({ price: 499 });
  const activeSubscription = await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)),
  });
  activeSubscription.autoRenewEnabled = true;
  await activeSubscription.save();

  const response = await request(suite.app)
    .delete('/api/payments/tap/billing-profile')
    .set(authHeader(student.token));

  assert.equal(response.status, 200);
  assert.equal(response.body.hasSavedCard, false);

  const updatedUser = await User.findById(student.user._id);
  assert.equal(updatedUser.tapCustomerId, 'cus_saved_remove_123');
  assert.equal(updatedUser.tapCardId, null);
  assert.equal(updatedUser.tapPaymentAgreementId, null);

  const updatedSubscription = await Subscription.findById(activeSubscription._id);
  assert.equal(updatedSubscription.autoRenewEnabled, false);
  assert.equal(updatedSubscription.autoRenewDisabledReason, 'member');
  assert.equal(updatedSubscription.nextRenewalRetryAt, null);
});

test('grace-period subscriptions can be restored through a new checkout and save the refreshed payment method', async () => {
  process.env.TAP_SECRET_KEY = 'sk_test_tap_secret_key';
  process.env.TAP_PUBLIC_KEY = 'pk_test_tap_public_key';
  process.env.APP_URL = 'http://localhost:3001';
  process.env.FRONTEND_URL = 'http://localhost:5000';
  process.env.SUBSCRIPTION_CURRENCY = 'SAR';

  const student = await createUser({ role: 'student', name: 'Recovery Student' });
  const packageRecord = await createSubscriptionPackage({ price: 349, durationDays: 30 });
  const previousEndDate = new Date(Date.now() - (24 * 60 * 60 * 1000));
  const graceEndsAt = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000));

  const recoverySubscription = await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'grace_period',
    startDate: new Date(Date.now() - (31 * 24 * 60 * 60 * 1000)),
    endDate: previousEndDate,
    gracePeriodEndsAt: graceEndsAt,
    durationDaysSnapshot: 30,
    priceAtPurchase: 349,
  });
  recoverySubscription.autoRenewEnabled = false;
  recoverySubscription.autoRenewDisabledReason = 'payment_failed';
  recoverySubscription.renewalFailureReason = 'Card expired';
  recoverySubscription.renewalFailureCount = 1;
  await recoverySubscription.save();

  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, 'https://api.tap.company/v2/charges');
    const requestBody = JSON.parse(options.body);

    return createTextResponse({
      id: 'chg_recovery_123',
      object: 'charge',
      status: 'CAPTURED',
      amount: requestBody.amount,
      currency: requestBody.currency,
      customer_initiated: true,
      threeDSecure: true,
      save_card: true,
      transaction: {
        created: '1710000000999',
        amount: requestBody.amount,
        currency: requestBody.currency,
      },
      reference: {
        payment: '240000000000299',
        gateway: 'GW-RECOVERY-001',
        transaction: requestBody.reference.transaction,
        order: requestBody.reference.order,
      },
      response: {
        code: '000',
        message: 'Captured',
      },
      customer: {
        id: 'cus_recovery_123',
        email: student.user.email,
      },
      card: {
        id: 'card_recovery_123',
        brand: 'VISA',
        last_four: '4242',
      },
      payment_agreement: {
        id: 'payment_agreement_recovery_123',
        contract: {
          id: 'card_recovery_123',
          customer_id: 'cus_recovery_123',
          type: 'SAVED_CARD',
        },
      },
      metadata: requestBody.metadata,
    });
  };

  const response = await request(suite.app)
    .post('/api/payments/tap/charge')
    .set(authHeader(student.token))
    .send({
      subscriptionId: recoverySubscription._id.toString(),
      tokenId: 'tok_recovery_123',
      checkoutMethod: 'card',
      phoneCountryCode: '966',
      phoneNumber: '512345678',
      checkoutDisclaimerAccepted: true,
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.payment.status, 'captured');
  assert.equal(response.body.payment.paymentType, 'recovery');

  const refreshedUser = await User.findById(student.user._id);
  assert.equal(refreshedUser.tapCustomerId, 'cus_recovery_123');
  assert.equal(refreshedUser.tapCardId, 'card_recovery_123');
  assert.equal(refreshedUser.tapPaymentAgreementId, 'payment_agreement_recovery_123');

  const updatedSubscription = await Subscription.findById(recoverySubscription._id);
  assert.equal(updatedSubscription.status, 'active');
  assert.equal(updatedSubscription.autoRenewEnabled, true);
  assert.equal(updatedSubscription.renewalFailureReason, null);
  assert.equal(updatedSubscription.gracePeriodEndsAt, null);
  assert.ok(updatedSubscription.endDate > previousEndDate);
});
