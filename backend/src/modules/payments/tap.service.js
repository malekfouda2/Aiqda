import { createHmac, timingSafeEqual } from 'node:crypto';

const TAP_API_BASE_URL = 'https://api.tap.company/v2';
const DEFAULT_TAP_CARD_SDK_URL = 'https://tap-sdks.b-cdn.net/card/1.0.2/index.js';
const DEFAULT_TAP_APPLE_PAY_SDK_URL = 'https://tap-sdks.b-cdn.net/apple-pay/build-1.2.0/main.js';
const DEFAULT_TAP_APPLE_PAY_CSS_URL = 'https://tap-sdks.b-cdn.net/apple-pay/build-1.2.0/main.css';

const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'OMR']);

const DEFAULT_TAP_REQUEST_TIMEOUT_MS = 30000;

const getTapRequestTimeoutMs = () => {
  const configured = Number(process.env.TAP_REQUEST_TIMEOUT_MS);
  return Number.isInteger(configured) && configured > 0 && configured <= 2147483647
    ? configured
    : DEFAULT_TAP_REQUEST_TIMEOUT_MS;
};

export class TapRequestError extends Error {
  constructor(message, { code, statusCode = null, uncertainOutcome = false }) {
    super(message);
    this.name = 'TapRequestError';
    this.code = code;
    this.statusCode = statusCode;
    this.uncertainOutcome = uncertainOutcome;
  }
}

export const normalizeCurrency = (value) => (
  typeof value === 'string' && value.trim()
    ? value.trim().toUpperCase()
    : 'SAR'
);

const normalizeDomain = (value = '') => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '';
  }

  try {
    const url = new URL(normalizedValue.includes('://') ? normalizedValue : `https://${normalizedValue}`);
    return url.hostname.replace(/\/$/, '');
  } catch {
    return normalizedValue.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
  }
};

const buildTapHeaders = (includeJsonContentType = true) => {
  const headers = {
    Authorization: `Bearer ${getTapSecretKey()}`,
    accept: 'application/json',
    lang_code: 'EN',
  };

  if (includeJsonContentType) {
    headers['content-type'] = 'application/json';
  }

  return headers;
};

const extractTapErrorMessage = (payload, fallbackMessage) => {
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const descriptions = payload.errors
      .map((entry) => entry?.description)
      .filter((description) => typeof description === 'string' && description.trim());

    if (descriptions.length > 0) {
      return descriptions.join(' ').slice(0, 500);
    }
  }

  if (typeof payload?.response?.message === 'string' && payload.response.message.trim()) {
    return payload.response.message.slice(0, 500);
  }

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message.slice(0, 500);
  }

  return fallbackMessage;
};

const tapRequest = async (path, { method = 'GET', body } = {}) => {
  let requestBody;
  try {
    requestBody = body === undefined ? undefined : JSON.stringify(body);
  } catch {
    throw new TapRequestError('Tap request payload is invalid.', { code: 'TAP_INVALID_REQUEST' });
  }

  const isPaymentMutation = method === 'POST' && ['/charges', '/refunds'].includes(path);
  const controller = new AbortController();
  let statusCode = null;
  let timer;
  const deadline = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new TapRequestError('Tap request timed out.', {
        code: 'TAP_REQUEST_TIMEOUT',
        statusCode,
        uncertainOutcome: isPaymentMutation,
      }));
      controller.abort();
    }, getTapRequestTimeoutMs());
  });

  const request = async () => {
    const response = await fetch(`${TAP_API_BASE_URL}${path}`, {
      method,
      headers: buildTapHeaders(body !== undefined),
      body: requestBody,
      signal: controller.signal,
    });
    statusCode = response.status;
    const rawText = await response.text();
    let payload;
    try {
      payload = JSON.parse(rawText);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Invalid response shape');
      }
    } catch {
      throw new TapRequestError('Tap returned an invalid response.', {
        code: 'TAP_INVALID_RESPONSE',
        statusCode,
        uncertainOutcome: isPaymentMutation,
      });
    }

    if (!response.ok) {
      const isClientError = statusCode >= 400 && statusCode < 500;
      throw new TapRequestError(
        isClientError ? extractTapErrorMessage(payload, 'Tap request failed.') : 'Tap request failed.',
        {
          code: 'TAP_HTTP_ERROR',
          statusCode,
          uncertainOutcome: isPaymentMutation && (statusCode >= 500 || statusCode === 408),
        }
      );
    }

    return payload;
  };

  try {
    // Bound both headers and body, even when the transport ignores cancellation.
    return await Promise.race([request(), deadline]);
  } catch (error) {
    if (error instanceof TapRequestError) {
      throw error;
    }
    const timedOut = controller.signal.aborted || error?.name === 'AbortError';
    throw new TapRequestError(timedOut ? 'Tap request timed out.' : 'Tap network request failed.', {
      code: timedOut ? 'TAP_REQUEST_TIMEOUT' : 'TAP_NETWORK_ERROR',
      statusCode,
      uncertainOutcome: isPaymentMutation,
    });
  } finally {
    clearTimeout(timer);
  }
};

export const getTapSecretKey = () => process.env.TAP_SECRET_KEY || '';

export const getTapPublicKey = () => process.env.TAP_PUBLIC_KEY || '';

export const getTapMerchantId = () => process.env.TAP_MERCHANT_ID || '';

export const getTapCardSdkUrl = () => process.env.TAP_CARD_SDK_URL || DEFAULT_TAP_CARD_SDK_URL;

export const getTapApplePaySdkUrl = () => process.env.TAP_APPLE_PAY_SDK_URL || DEFAULT_TAP_APPLE_PAY_SDK_URL;

export const getTapApplePayCssUrl = () => process.env.TAP_APPLE_PAY_CSS_URL || DEFAULT_TAP_APPLE_PAY_CSS_URL;

export const getTapApplePayDomain = () => {
  const configuredDomain = normalizeDomain(process.env.TAP_APPLE_PAY_DOMAIN || '');
  if (configuredDomain) {
    return configuredDomain;
  }

  const publicFrontendDomain = normalizeDomain(
    process.env.PUBLIC_WEB_URL
    || process.env.FRONTEND_PUBLIC_URL
    || process.env.FRONTEND_URL
    || ''
  );

  if (['localhost', '127.0.0.1', '::1'].includes(publicFrontendDomain)) {
    return '';
  }

  return publicFrontendDomain;
};

export const getTapApplePayEnvironment = () => {
  const configured = String(process.env.TAP_APPLE_PAY_ENVIRONMENT || '').trim().toLowerCase();
  if (['development', 'beta', 'production'].includes(configured)) {
    return configured;
  }

  return getTapPublicKey().startsWith('pk_live_') ? 'production' : 'development';
};

export const isTapApplePayConfigured = () => Boolean(
  getTapPublicKey()
  && getTapMerchantId()
  && getTapApplePayDomain()
);

export const getSubscriptionCurrency = () => normalizeCurrency(process.env.SUBSCRIPTION_CURRENCY || 'SAR');

export const formatTapAmount = (amount, currency = 'SAR') => {
  const normalizedAmount = Number(amount || 0);
  const normalizedCurrency = normalizeCurrency(currency);
  const decimalPlaces = THREE_DECIMAL_CURRENCIES.has(normalizedCurrency) ? 3 : 2;
  return normalizedAmount.toFixed(decimalPlaces);
};

export const isTapConfigured = () => Boolean(getTapSecretKey() && getTapPublicKey());

export const assertTapConfigured = () => {
  if (!getTapSecretKey()) {
    throw new Error('Tap secret key is not configured.');
  }

  if (!getTapPublicKey()) {
    throw new Error('Tap public key is not configured.');
  }
};

export const createTapCharge = async (payload) => {
  assertTapConfigured();
  return tapRequest('/charges', {
    method: 'POST',
    body: payload,
  });
};

export const createTapRefund = async (payload) => {
  assertTapConfigured();
  return tapRequest('/refunds', {
    method: 'POST',
    body: payload,
  });
};

export const createTapSavedCardToken = async ({ cardId, customerId, clientIp = '127.0.0.1' }) => {
  assertTapConfigured();

  if (!cardId || !customerId) {
    throw new Error('Tap card id and customer id are required to create a saved-card token.');
  }

  return tapRequest('/tokens/', {
    method: 'POST',
    body: {
      saved_card: {
        card_id: cardId,
        customer_id: customerId,
      },
      client_ip: clientIp,
    },
  });
};

export const retrieveTapCharge = async (chargeId) => {
  assertTapConfigured();

  if (!chargeId) {
    throw new Error('Tap charge id is required.');
  }

  return tapRequest(`/charges/${chargeId}`);
};

export const calculateTapChargeHashString = (charge = {}) => {
  const amount = formatTapAmount(charge.amount, charge.currency);
  const currency = normalizeCurrency(charge.currency);
  const gatewayReference = charge.reference?.gateway || '';
  const paymentReference = charge.reference?.payment || '';
  const created = charge.transaction?.created || '';
  const status = charge.status || '';
  const id = charge.id || '';

  return [
    `x_id${id}`,
    `x_amount${amount}`,
    `x_currency${currency}`,
    `x_gateway_reference${gatewayReference}`,
    `x_payment_reference${paymentReference}`,
    `x_status${status}`,
    `x_created${created}`,
  ].join('');
};

export const verifyTapChargeHashString = (charge = {}, receivedHashString = '') => {
  const secretKey = getTapSecretKey();
  if (
    !secretKey
    || typeof receivedHashString !== 'string'
    || !/^[a-f\d]{64}$/i.test(receivedHashString)
  ) {
    return false;
  }

  const computedHash = createHmac('sha256', secretKey)
    .update(calculateTapChargeHashString(charge))
    .digest();
  return timingSafeEqual(computedHash, Buffer.from(receivedHashString, 'hex'));
};

export const mapTapChargeStatus = (status) => {
  switch (String(status || '').trim().toUpperCase()) {
    case 'CAPTURED':
      return 'captured';
    case 'INITIATED':
    case 'PENDING':
      return 'initiated';
    case 'ABANDONED':
    case 'CANCELLED':
    case 'VOID':
      return 'cancelled';
    case 'FAILED':
    case 'DECLINED':
    case 'RESTRICTED':
    case 'TIMEDOUT':
      return 'failed';
    case 'UNKNOWN':
    default:
      return 'initiated';
  }
};
