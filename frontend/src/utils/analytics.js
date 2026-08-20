import { analyticsAPI } from '../services/api';

const VISITOR_STORAGE_KEY = 'aiqda.analytics.visitorId';
const SESSION_STORAGE_KEY = 'aiqda.analytics.sessionId';
const SESSION_UTM_STORAGE_KEY = 'aiqda.analytics.utm';
const SESSION_STARTED_STORAGE_KEY = 'aiqda.analytics.sessionStarted';
const USER_CONTEXT_STORAGE_KEY = 'aiqda.analytics.userContext';
const GTM_CONTAINER_ID = String(import.meta.env.VITE_GTM_CONTAINER_ID || '').trim();
const META_PIXEL_ID = String(import.meta.env.VITE_META_PIXEL_ID || '').trim();
const EXCLUDED_ANALYTICS_ROLES = new Set(['admin', 'applications_admin', 'instructor', 'creator']);

let gtmInitializationPromise = null;
let metaPixelInitializationPromise = null;

const generateAnalyticsId = (prefix) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
};

const safeStorageRead = (storage, key) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageWrite = (storage, key, value) => {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
};

const getCurrentPath = () => {
  if (typeof window === 'undefined') {
    return '/';
  }

  return `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`;
};

const readStoredFlag = (storage, key) => {
  const value = safeStorageRead(storage, key);
  return value === '1';
};

const safeStorageRemove = (storage, key) => {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
};

const sanitizeEventValue = (value, maxLength = 200) => (
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
);

const sanitizeMetadata = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [key, entryValue]) => {
    if (!key) {
      return accumulator;
    }

    if (typeof entryValue === 'string') {
      accumulator[key] = entryValue.trim().slice(0, 500);
      return accumulator;
    }

    if (typeof entryValue === 'number' || typeof entryValue === 'boolean') {
      accumulator[key] = entryValue;
      return accumulator;
    }

    return accumulator;
  }, {});
};

const toGaEventName = (eventType) => {
  switch (eventType) {
    case 'member_registration':
      return 'sign_up';
    case 'contact_request':
    case 'creator_application':
    case 'studio_application':
    case 'consultation_request':
      return 'generate_lead';
    default:
      return eventType;
  }
};

const getNavigationType = () => {
  if (typeof window === 'undefined' || !window.performance?.getEntriesByType) {
    return '';
  }

  const navigationEntries = window.performance.getEntriesByType('navigation');
  return navigationEntries[0]?.type || '';
};

const getStoredUserContext = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  const stored = safeStorageRead(window.sessionStorage, USER_CONTEXT_STORAGE_KEY);
  if (!stored) {
    return {};
  }

  try {
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const storeUserContext = (user = {}) => {
  if (typeof window === 'undefined') {
    return;
  }

  safeStorageWrite(window.sessionStorage, USER_CONTEXT_STORAGE_KEY, JSON.stringify({
    userId: sanitizeEventValue(user.userId || user.id || user._id || '', 120),
    role: sanitizeEventValue(user.role || '', 80),
    locale: sanitizeEventValue(user.locale || '', 16),
    subscriptionStatus: sanitizeEventValue(user.subscriptionStatus || '', 80),
  }));
};

const clearStoredUserContext = () => {
  if (typeof window === 'undefined') {
    return;
  }

  safeStorageRemove(window.sessionStorage, USER_CONTEXT_STORAGE_KEY);
};

export const isExcludedAnalyticsRole = (role) => EXCLUDED_ANALYTICS_ROLES.has(sanitizeEventValue(role || '', 80));

export const isExcludedAnalyticsPath = (path = getCurrentPath()) => /^\/(?:admin|creator)(?:\/|$)/.test(String(path || '/'));

const getEffectiveUserRole = (payload = {}) => (
  sanitizeEventValue(payload.userRole || payload.metadata?.role || getStoredUserContext().role || '', 80)
);

const shouldSkipAnalyticsEvent = (eventType, payload = {}) => (
  isExcludedAnalyticsRole(getEffectiveUserRole(payload))
  || isExcludedAnalyticsPath(payload.path || getCurrentPath())
);

const buildDefaultEventPayload = (payload = {}) => ({
  path: payload.path || getCurrentPath(),
  title: payload.title || (typeof document !== 'undefined' ? document.title || '' : ''),
  locale: payload.locale || null,
  userRole: getEffectiveUserRole(payload) || null,
  visitorId: getOrCreateVisitorId(),
  sessionId: getOrCreateSessionId(),
  referrer: payload.referrer || (typeof document !== 'undefined' ? document.referrer || '' : ''),
  utm: payload.utm || getSessionUtmParams(),
  metadata: sanitizeMetadata(payload.metadata),
});

const pushDataLayerEvent = (entry = {}) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(entry);
};

const buildDataLayerPayload = (eventType, payload = {}, options = {}) => {
  const fullPayload = buildDefaultEventPayload(payload);
  const metadata = fullPayload.metadata || {};
  const gaEventName = sanitizeEventValue(options.gaEventName || toGaEventName(eventType), 80);
  const backendEventType = sanitizeEventValue(options.backendEventType || eventType, 80);

  return {
    event: gaEventName || backendEventType || 'aiqda_event',
    aiqda_event_type: backendEventType || undefined,
    page_title: fullPayload.title || undefined,
    page_path: fullPayload.path || undefined,
    page_location: typeof window !== 'undefined' ? window.location.href : undefined,
    locale: fullPayload.locale || undefined,
    user_role: fullPayload.userRole || undefined,
    visitor_id: fullPayload.visitorId || undefined,
    session_id: fullPayload.sessionId || undefined,
    referrer: fullPayload.referrer || undefined,
    utm_source: fullPayload.utm?.source || undefined,
    utm_medium: fullPayload.utm?.medium || undefined,
    utm_campaign: fullPayload.utm?.campaign || undefined,
    utm_term: fullPayload.utm?.term || undefined,
    utm_content: fullPayload.utm?.content || undefined,
    ...metadata,
  };
};

const getMetaStandardEventName = (eventType) => {
  switch (eventType) {
    case 'page_view':
      return 'PageView';
    case 'search':
      return 'Search';
    case 'sign_up':
    case 'member_registration':
      return 'CompleteRegistration';
    case 'contact_request':
    case 'creator_application':
    case 'studio_application':
    case 'consultation_request':
    case 'generate_lead':
      return 'Lead';
    case 'begin_checkout':
      return 'InitiateCheckout';
    case 'add_payment_info':
      return 'AddPaymentInfo';
    case 'purchase':
      return 'Purchase';
    default:
      return '';
  }
};

const buildMetaParams = (eventType, payload = {}, options = {}) => {
  const fullPayload = buildDefaultEventPayload(payload);
  const metadata = fullPayload.metadata || {};
  const eventName = sanitizeEventValue(options.metaEventName || getMetaStandardEventName(eventType), 80);
  const customEventName = sanitizeEventValue(options.metaCustomEventName || toGaEventName(eventType) || eventType, 80);

  const params = {
    content_name: metadata.label || fullPayload.title || undefined,
    content_category: metadata.elementTag || metadata.elementType || undefined,
    content_type: metadata.elementType || undefined,
    content_ids: metadata.analyticsId ? [sanitizeEventValue(metadata.analyticsId, 120)] : undefined,
    content_name_path: fullPayload.path || undefined,
    search_string: metadata.searchTerm || undefined,
    value: typeof metadata.value === 'number' ? metadata.value : undefined,
    currency: sanitizeEventValue(metadata.currency || '', 12) || undefined,
    status: sanitizeEventValue(metadata.status || '', 80) || undefined,
    locale: fullPayload.locale || undefined,
    destination_path: metadata.destinationPath || undefined,
    link_url: metadata.href || undefined,
    referrer: fullPayload.referrer || undefined,
  };

  return {
    eventName,
    customEventName,
    params: Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    ),
  };
};

const sendMetaPixelEvent = async (eventType, payload = {}, options = {}) => {
  await initializeMetaPixel();

  if (typeof window === 'undefined' || typeof window.fbq !== 'function' || !META_PIXEL_ID) {
    return;
  }

  const { eventName, customEventName, params } = buildMetaParams(eventType, payload, options);

  if (eventName === 'PageView') {
    window.fbq('track', 'PageView');
    return;
  }

  if (eventName) {
    window.fbq('track', eventName, params);
    return;
  }

  if (customEventName) {
    window.fbq('trackCustom', customEventName, params);
  }
};

const sendBackendEvent = async (eventType, payload = {}, { useBeacon = false } = {}) => {
  const body = {
    eventType,
    ...buildDefaultEventPayload(payload),
  };

  if (
    useBeacon
    && typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && typeof navigator.sendBeacon === 'function'
  ) {
    try {
      const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/public', blob);
      return;
    } catch {
      // Fall back to the normal API request.
    }
  }

  await analyticsAPI.trackPublicEvent(body);
};

const initializeGoogleTagManager = async () => {
  if (typeof window === 'undefined' || !GTM_CONTAINER_ID) {
    return;
  }

  if (window.__aiqdaGtmInitialized) {
    return;
  }

  if (gtmInitializationPromise) {
    await gtmInitializationPromise;
    return;
  }

  gtmInitializationPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[data-gtm-id="${GTM_CONTAINER_ID}"]`);
    const existingNoScript = document.querySelector(`noscript[data-gtm-id="${GTM_CONTAINER_ID}"]`);

    window.dataLayer = window.dataLayer || [];

    if (!existingScript) {
      window.dataLayer.push({
        'gtm.start': Date.now(),
        event: 'gtm.js',
      });

      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_CONTAINER_ID)}`;
      script.dataset.gtmId = GTM_CONTAINER_ID;
      script.onload = () => {
        window.__aiqdaGtmInitialized = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Google Tag Manager'));
      document.head.appendChild(script);
    } else {
      window.__aiqdaGtmInitialized = true;
      resolve();
    }

    if (!existingNoScript && document.body) {
      const noScript = document.createElement('noscript');
      noScript.dataset.gtmId = GTM_CONTAINER_ID;

      const iframe = document.createElement('iframe');
      iframe.src = `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(GTM_CONTAINER_ID)}`;
      iframe.height = '0';
      iframe.width = '0';
      iframe.style.display = 'none';
      iframe.style.visibility = 'hidden';

      noScript.appendChild(iframe);
      document.body.prepend(noScript);
    }
  });

  try {
    await gtmInitializationPromise;
  } catch (error) {
    gtmInitializationPromise = null;
    if (import.meta.env.DEV) {
      console.warn('Google Tag Manager initialization failed:', error);
    }
  }
};

const initializeMetaPixel = async () => {
  if (typeof window === 'undefined' || !META_PIXEL_ID) {
    return;
  }

  if (window.__aiqdaMetaPixelInitialized) {
    return;
  }

  if (metaPixelInitializationPromise) {
    await metaPixelInitializationPromise;
    return;
  }

  metaPixelInitializationPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[data-meta-pixel-id="${META_PIXEL_ID}"]`);
    const existingNoScript = document.querySelector(`noscript[data-meta-pixel-id="${META_PIXEL_ID}"]`);

    if (!window.fbq) {
      const fbq = function fbqShim(...args) {
        if (fbq.callMethod) {
          fbq.callMethod(...args);
        } else {
          fbq.queue.push(args);
        }
      };

      fbq.queue = [];
      fbq.loaded = true;
      fbq.version = '2.0';
      window.fbq = fbq;
      window._fbq = fbq;
    }

    window.fbq('init', META_PIXEL_ID);

    if (!existingScript) {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      script.dataset.metaPixelId = META_PIXEL_ID;
      script.onload = () => {
        window.__aiqdaMetaPixelInitialized = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Meta Pixel'));
      document.head.appendChild(script);
    } else {
      window.__aiqdaMetaPixelInitialized = true;
      resolve();
    }

    if (!existingNoScript && document.body) {
      const noScript = document.createElement('noscript');
      noScript.dataset.metaPixelId = META_PIXEL_ID;

      const image = document.createElement('img');
      image.height = 1;
      image.width = 1;
      image.style.display = 'none';
      image.src = `https://www.facebook.com/tr?id=${encodeURIComponent(META_PIXEL_ID)}&ev=PageView&noscript=1`;

      noScript.appendChild(image);
      document.body.prepend(noScript);
    }
  });

  try {
    await metaPixelInitializationPromise;
  } catch (error) {
    metaPixelInitializationPromise = null;
    if (import.meta.env.DEV) {
      console.warn('Meta Pixel initialization failed:', error);
    }
  }
};

export const getOrCreateVisitorId = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const existing = safeStorageRead(window.localStorage, VISITOR_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = generateAnalyticsId('visitor');
  safeStorageWrite(window.localStorage, VISITOR_STORAGE_KEY, created);
  return created;
};

export const getOrCreateSessionId = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const existing = safeStorageRead(window.sessionStorage, SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = generateAnalyticsId('session');
  safeStorageWrite(window.sessionStorage, SESSION_STORAGE_KEY, created);
  return created;
};

const readStoredUtm = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  const stored = safeStorageRead(window.sessionStorage, SESSION_UTM_STORAGE_KEY);
  if (!stored) {
    return {};
  }

  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
};

const storeUtm = (value) => {
  if (typeof window === 'undefined') {
    return;
  }

  safeStorageWrite(window.sessionStorage, SESSION_UTM_STORAGE_KEY, JSON.stringify(value));
};

export const getSessionUtmParams = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  const params = new URLSearchParams(window.location.search);
  const current = {
    source: params.get('utm_source') || '',
    medium: params.get('utm_medium') || '',
    campaign: params.get('utm_campaign') || '',
    term: params.get('utm_term') || '',
    content: params.get('utm_content') || '',
  };

  if (Object.values(current).some(Boolean)) {
    storeUtm(current);
    return current;
  }

  return readStoredUtm();
};

export const initAnalytics = async () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (shouldSkipAnalyticsEvent('session_start')) {
    return;
  }

  await initializeMetaPixel();
  await initializeGoogleTagManager();

  const hasStartedSession = readStoredFlag(window.sessionStorage, SESSION_STARTED_STORAGE_KEY);
  if (hasStartedSession) {
    return;
  }

  safeStorageWrite(window.sessionStorage, SESSION_STARTED_STORAGE_KEY, '1');
  void trackAnalyticsEvent('session_start', {
    metadata: {
      navigationType: getNavigationType(),
      viewportWidth: window.innerWidth || null,
      viewportHeight: window.innerHeight || null,
    },
  });
};

export const setAnalyticsUserContext = async (user = {}) => {
  if (typeof window === 'undefined') {
    return;
  }

  storeUserContext(user);

  if (isExcludedAnalyticsRole(user.role)) {
    return;
  }

  await initializeMetaPixel();
  await initializeGoogleTagManager();

  pushDataLayerEvent({
    event: 'aiqda_user_context',
    user_id: sanitizeEventValue(user.userId || user.id || user._id || '', 120) || undefined,
    user_role: sanitizeEventValue(user.role || '', 80) || undefined,
    locale: sanitizeEventValue(user.locale || '', 16) || undefined,
    subscription_status: sanitizeEventValue(user.subscriptionStatus || '', 80) || undefined,
  });

};

export const clearAnalyticsUserContext = async () => {
  if (typeof window === 'undefined') {
    return;
  }

  clearStoredUserContext();

  await initializeMetaPixel();
  await initializeGoogleTagManager();

  pushDataLayerEvent({
    event: 'aiqda_user_context_cleared',
    user_id: undefined,
    user_role: undefined,
    locale: undefined,
    subscription_status: undefined,
  });

};

export const trackAnalyticsEvent = async (eventType, payload = {}, options = {}) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (shouldSkipAnalyticsEvent(eventType, payload)) {
    return;
  }

  const backendEventType = sanitizeEventValue(options.backendEventType || eventType, 80);
  const shouldSendToBackend = options.sendToBackend !== false;
  const useBeacon = options.useBeacon === true;

  try {
    await sendMetaPixelEvent(eventType, payload, options);
    await initializeGoogleTagManager();
    pushDataLayerEvent(buildDataLayerPayload(eventType, payload, options));

    if (shouldSendToBackend && backendEventType) {
      await sendBackendEvent(backendEventType, payload, { useBeacon });
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Analytics tracking failed:', error);
    }
  }
};

export const trackPageView = async (payload = {}) => (
  trackAnalyticsEvent('page_view', payload)
);

export const trackPageEngagement = async (payload = {}, options = {}) => (
  trackAnalyticsEvent('page_engagement', payload, options)
);

export const trackPublicAnalyticsEvent = async (eventType, payload = {}) => (
  trackAnalyticsEvent(eventType, payload)
);
