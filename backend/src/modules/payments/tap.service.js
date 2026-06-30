const TAP_API_BASE_URL = 'https://api.tap.company/v2';
const DEFAULT_TAP_CARD_SDK_URL = 'https://tap-sdks.b-cdn.net/card/1.0.2/index.js';
const DEFAULT_TAP_APPLE_PAY_SDK_URL = 'https://tap-sdks.b-cdn.net/apple-pay/build-1.2.0/main.js';
const DEFAULT_TAP_APPLE_PAY_CSS_URL = 'https://tap-sdks.b-cdn.net/apple-pay/build-1.2.0/main.css';

const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'OMR']);

// Tap API calls must never hang the checkout request indefinitely. Without a
// timeout a stalled Tap response leaves the payment stuck and freezes the
// client checkout modal that is awaiting our reply.
const TAP_REQUEST_TIMEOUT_MS = Number(process.env.TAP_REQUEST_TIMEOUT_MS) || 30000;

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
      .filter(Boolean);

    if (descriptions.length > 0) {
      return descriptions.join(' ');
    }
  }

  if (payload?.response?.message) {
    return payload.response.message;
  }

  if (payload?.message) {
    return payload.message;
  }

  return fallbackMessage;
};

const tapRequest = async (path, { method = 'GET', body } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TAP_REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${TAP_API_BASE_URL}${path}`, {
      method,
      headers: buildTapHeaders(body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Tap request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : {};

  if (!response.ok) {
    throw new Error(extractTapErrorMessage(payload, 'Tap request failed.'));
  }

  return payload;
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
  if (!secretKey || !receivedHashString) {
    return false;
  }

  const toBeHashedString = calculateTapChargeHashString(charge);
  const encoder = new TextEncoder();

  const key = encoder.encode(secretKey);
  const data = encoder.encode(toBeHashedString);

  return crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ).then(async (cryptoKey) => {
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const computedHash = Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    return computedHash === String(receivedHashString).toLowerCase();
  });
};

export const mapTapChargeStatus = (status) => {
  switch (String(status || '').toUpperCase()) {
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
    case 'UNKNOWN':
    default:
      return 'failed';
  }
};
