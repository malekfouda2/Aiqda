import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach } from 'node:test';
import test from 'node:test';
import request from 'supertest';

import Payment from '../src/modules/payments/payment.model.js';
import { Subscription } from '../src/modules/subscriptions/subscription.model.js';
import User from '../src/modules/users/user.model.js';
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
const ENV_KEYS = ['TAP_SECRET_KEY', 'TAP_PUBLIC_KEY', 'APP_URL', 'FRONTEND_URL', 'SUBSCRIPTION_CURRENCY'];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

const createTextResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  async text() {
    return JSON.stringify(body);
  },
});

const formatTapAmount = (amount, currency = 'SAR') => {
  const normalizedCurrency = String(currency || 'SAR').toUpperCase();
  const decimalPlaces = ['BHD', 'JOD', 'KWD', 'OMR'].includes(normalizedCurrency) ? 3 : 2;
  return Number(amount || 0).toFixed(decimalPlaces);
};

const buildTapHashString = (charge) => {
  const parts = [
    `x_id${charge.id || ''}`,
    `x_amount${formatTapAmount(charge.amount, charge.currency)}`,
    `x_currency${charge.currency || ''}`,
    `x_gateway_reference${charge.reference?.gateway || ''}`,
    `x_payment_reference${charge.reference?.payment || ''}`,
    `x_status${charge.status || ''}`,
    `x_created${charge.transaction?.created || ''}`,
  ];

  return createHmac('sha256', process.env.TAP_SECRET_KEY)
    .update(parts.join(''))
    .digest('hex');
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

test('tap charge creation and verified webhook capture activate a pending subscription', async () => {
  process.env.TAP_SECRET_KEY = 'sk_test_tap_secret_key';
  process.env.TAP_PUBLIC_KEY = 'pk_test_tap_public_key';
  process.env.APP_URL = 'http://localhost:3001';
  process.env.FRONTEND_URL = 'http://localhost:5000';
  process.env.SUBSCRIPTION_CURRENCY = 'SAR';

  const student = await createUser({ role: 'student', name: 'Tap Student' });
  const packageRecord = await createSubscriptionPackage({ price: 499 });
  const subscription = await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'pending',
  });

  let postedChargeBody = null;

  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, 'https://api.tap.company/v2/charges');
    postedChargeBody = JSON.parse(options.body);

    return createTextResponse({
      id: 'chg_test_123',
      object: 'charge',
      status: 'INITIATED',
      amount: 499,
      currency: 'SAR',
      customer_initiated: true,
      threeDSecure: true,
      save_card: true,
      transaction: {
        created: '1710000000000',
        amount: 499,
        currency: 'SAR',
        url: 'https://tap.example/3ds',
      },
      reference: {
        payment: '240000000000001',
        gateway: 'GW-123456',
        transaction: postedChargeBody.reference.transaction,
        order: postedChargeBody.reference.order,
      },
      response: {
        code: '100',
        message: 'Initiated',
      },
      customer: {
        id: 'cus_tap_123',
        email: 'tap.student@example.com',
        phone: {
          country_code: '966',
          number: '512345678',
        },
      },
      card: {
        id: 'card_tap_123',
        brand: 'VISA',
        last_four: '1111',
      },
      source: {
        object: 'token',
        type: 'CARD_NOT_PRESENT',
        payment_type: 'CREDIT',
        payment_method: 'VISA',
        channel: 'INTERNET',
        id: 'tok_test_123',
      },
      redirect: {
        status: 'PENDING',
        url: postedChargeBody.redirect.url,
      },
      post: {
        status: 'PENDING',
        url: postedChargeBody.post.url,
      },
      payment_agreement: {
        id: 'payment_agreement_tap_123',
        contract: {
          id: 'card_tap_123',
          customer_id: 'cus_tap_123',
          type: 'SAVED_CARD',
        },
      },
      metadata: postedChargeBody.metadata,
    });
  };

  const tapConfigResponse = await request(suite.app)
    .get('/api/payments/tap/config')
    .set(authHeader(student.token));
  assert.equal(tapConfigResponse.status, 200);
  assert.equal(tapConfigResponse.body.publicKey, 'pk_test_tap_public_key');

  const chargeResponse = await request(suite.app)
    .post('/api/payments/tap/charge')
    .set(authHeader(student.token))
    .send({
      subscriptionId: subscription._id.toString(),
      tokenId: 'tok_test_123',
      phoneCountryCode: '966',
      phoneNumber: '512345678',
      checkoutDisclaimerAccepted: true,
    });

  assert.equal(chargeResponse.status, 201);
  assert.equal(chargeResponse.body.payment.status, 'initiated');
  assert.equal(chargeResponse.body.redirectUrl, 'https://tap.example/3ds');
  assert.equal(postedChargeBody.amount, 499);
  assert.equal(postedChargeBody.source.id, 'tok_test_123');
  assert.equal(postedChargeBody.customer.phone.country_code, '966');
  assert.equal(postedChargeBody.customer.phone.number, '512345678');

  const userAfterCharge = await User.findById(student.user._id);
  assert.equal(userAfterCharge.phone.countryCode, '966');
  assert.equal(userAfterCharge.phone.number, '512345678');
  assert.equal(userAfterCharge.tapCustomerId, 'cus_tap_123');
  assert.equal(userAfterCharge.tapCardId, 'card_tap_123');
  assert.equal(userAfterCharge.tapPaymentAgreementId, 'payment_agreement_tap_123');

  const paymentAfterCharge = await Payment.findById(chargeResponse.body.payment._id);
  assert.equal(paymentAfterCharge.tapChargeId, 'chg_test_123');
  assert.equal(paymentAfterCharge.status, 'initiated');

  const capturedWebhookPayload = {
    id: 'chg_test_123',
    object: 'charge',
    status: 'CAPTURED',
    amount: 499,
    currency: 'SAR',
    customer_initiated: true,
    threeDSecure: true,
    save_card: true,
    transaction: {
      created: '1710000000000',
      amount: 499,
      currency: 'SAR',
    },
    reference: {
      payment: '240000000000001',
      gateway: 'GW-123456',
      transaction: postedChargeBody.reference.transaction,
      order: postedChargeBody.reference.order,
    },
    response: {
      code: '000',
      message: 'Captured',
    },
    customer: {
      id: 'cus_tap_123',
      email: 'tap.student@example.com',
      phone: {
        country_code: '966',
        number: '512345678',
      },
    },
    card: {
      id: 'card_tap_123',
      brand: 'VISA',
      last_four: '1111',
    },
    source: {
      object: 'token',
      type: 'CARD_NOT_PRESENT',
      payment_type: 'CREDIT',
      payment_method: 'VISA',
      channel: 'INTERNET',
      id: 'tok_test_123',
    },
    redirect: {
      status: 'SUCCESS',
      url: postedChargeBody.redirect.url,
    },
    post: {
      status: 'PENDING',
      url: postedChargeBody.post.url,
    },
    payment_agreement: {
      id: 'payment_agreement_tap_123',
      contract: {
        id: 'card_tap_123',
        customer_id: 'cus_tap_123',
        type: 'SAVED_CARD',
      },
    },
    metadata: postedChargeBody.metadata,
  };

  const webhookResponse = await request(suite.app)
    .post('/api/payments/tap/webhook')
    .set('hashstring', buildTapHashString(capturedWebhookPayload))
    .send(capturedWebhookPayload);
  assert.equal(webhookResponse.status, 200);

  const updatedPayment = await Payment.findById(paymentAfterCharge._id);
  assert.equal(updatedPayment.status, 'captured');
  assert.ok(updatedPayment.tapWebhookVerifiedAt);

  const updatedSubscription = await Subscription.findById(subscription._id);
  assert.equal(updatedSubscription.status, 'active');
  assert.ok(updatedSubscription.startDate);
  assert.ok(updatedSubscription.endDate);
  assert.equal(updatedSubscription.activationSource, 'tap_webhook');
});

test('subscription checkout supports Tabby redirect flow without card tokenization', async () => {
  process.env.TAP_SECRET_KEY = 'sk_test_tap_secret_key';
  process.env.TAP_PUBLIC_KEY = 'pk_test_tap_public_key';
  process.env.APP_URL = 'http://localhost:3001';
  process.env.FRONTEND_URL = 'http://localhost:5000';
  process.env.SUBSCRIPTION_CURRENCY = 'SAR';

  const student = await createUser({ role: 'student', name: 'Tabby Student' });
  const packageRecord = await createSubscriptionPackage({ price: 349 });
  const subscription = await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'pending',
    currency: 'SAR',
  });

  let postedChargeBody = null;

  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, 'https://api.tap.company/v2/charges');
    postedChargeBody = JSON.parse(options.body);

    return createTextResponse({
      id: 'chg_tabby_123',
      status: 'INITIATED',
      amount: 349,
      currency: 'SAR',
      transaction: {
        url: 'https://tap.example/tabby',
      },
      reference: {
        payment: '240000000000111',
        gateway: 'GW-TABBY-1',
        transaction: postedChargeBody.reference.transaction,
        order: postedChargeBody.reference.order,
      },
      response: {
        code: '100',
        message: 'Initiated',
      },
      customer: {
        id: 'cus_tabby_123',
      },
      source: {
        id: 'src_tabby.installement',
        payment_method: 'TABBY',
        channel: 'TABBY',
      },
      redirect: {
        url: postedChargeBody.redirect.url,
      },
      metadata: postedChargeBody.metadata,
    });
  };

  const chargeResponse = await request(suite.app)
    .post('/api/payments/tap/charge')
    .set(authHeader(student.token))
    .send({
      subscriptionId: subscription._id.toString(),
      checkoutMethod: 'tabby',
      phoneCountryCode: '966',
      phoneNumber: '512345678',
      checkoutDisclaimerAccepted: true,
    });

  assert.equal(chargeResponse.status, 201);
  assert.equal(chargeResponse.body.payment.checkoutMethod, 'tabby');
  assert.equal(chargeResponse.body.redirectUrl, 'https://tap.example/tabby');
  assert.equal(postedChargeBody.source.id, 'src_tabby.installement');
  assert.equal(postedChargeBody.save_card, false);
  assert.equal(postedChargeBody.threeDSecure, true);
});

test('consultation checkout supports Tamara redirect flow without card tokenization', async () => {
  process.env.TAP_SECRET_KEY = 'sk_test_tap_secret_key';
  process.env.TAP_PUBLIC_KEY = 'pk_test_tap_public_key';
  process.env.APP_URL = 'http://localhost:3001';
  process.env.FRONTEND_URL = 'http://localhost:5000';
  process.env.SUBSCRIPTION_CURRENCY = 'SAR';

  const student = await createUser({ role: 'student', name: 'Tamara Student' });
  const consultation = await createConsultation({ price: 250, currency: 'SAR' });

  let postedChargeBody = null;

  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, 'https://api.tap.company/v2/charges');
    postedChargeBody = JSON.parse(options.body);

    return createTextResponse({
      id: 'chg_tamara_123',
      status: 'INITIATED',
      amount: 250,
      currency: 'SAR',
      transaction: {
        url: 'https://tap.example/tamara',
      },
      reference: {
        payment: '240000000000222',
        gateway: 'GW-TAMARA-1',
        transaction: postedChargeBody.reference.transaction,
        order: postedChargeBody.reference.order,
      },
      response: {
        code: '100',
        message: 'Initiated',
      },
      customer: {
        id: 'cus_tamara_123',
      },
      source: {
        id: 'src_tamara',
        channel: 'TAMARA',
      },
      redirect: {
        url: postedChargeBody.redirect.url,
      },
      metadata: postedChargeBody.metadata,
    });
  };

  const chargeResponse = await request(suite.app)
    .post('/api/consultation-bookings/checkout')
    .set(authHeader(student.token))
    .send({
      consultationId: consultation._id.toString(),
      checkoutMethod: 'tamara',
      phoneCountryCode: '966',
      phoneNumber: '512345678',
      checkoutDisclaimerAccepted: true,
    });

  assert.equal(chargeResponse.status, 201);
  assert.equal(chargeResponse.body.payment.checkoutMethod, 'tamara');
  assert.equal(chargeResponse.body.redirectUrl, 'https://tap.example/tamara');
  assert.equal(postedChargeBody.source.id, 'src_tamara');
  assert.equal(postedChargeBody.save_card, false);
  assert.equal(postedChargeBody.threeDSecure, true);
});
