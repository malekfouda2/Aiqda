export const SDK_LOAD_TIMEOUT_MS = 15000;
export const SDK_READY_TIMEOUT_MS = 20000;
export const TOKENIZE_TIMEOUT_MS = 45000;
export const APPLE_PAY_SESSION_TIMEOUT_MS = 120000;
export const APPLE_PAY_JS_URL = 'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js';

const pendingResources = new Map();

const loadResource = (url, { stylesheet = false, getSdk, timeoutMs = SDK_LOAD_TIMEOUT_MS } = {}) => {
  if (typeof window === 'undefined' || !url) {
    return Promise.reject(new Error('Payment SDK is not configured.'));
  }
  const readySdk = getSdk?.();
  if (readySdk) return Promise.resolve(readySdk);

  const key = `${stylesheet ? 'css' : 'js'}:${url}`;
  if (pendingResources.has(key)) return pendingResources.get(key);

  const promise = new Promise((resolve, reject) => {
    const selector = stylesheet ? 'link[rel="stylesheet"]' : 'script[src]';
    const absoluteUrl = new URL(url, document.baseURI).href;
    let element = [...document.querySelectorAll(selector)].find((node) => (
      (stylesheet ? node.href : node.src) === absoluteUrl
    ));
    const existing = Boolean(element);
    if (stylesheet && element?.sheet) {
      resolve(element);
      return;
    }
    element ||= document.createElement(stylesheet ? 'link' : 'script');
    const finish = (error) => {
      clearTimeout(timer);
      element.removeEventListener('load', onLoad);
      element.removeEventListener('error', onError);
      if (error) {
        // A failed or silent resource must not poison subsequent retries.
        element.remove();
        reject(error);
      } else {
        element.dataset.tapSdkLoaded = 'true';
        // Tap's Apple Pay SDK reuses an existing Apple script tag and reads this
        // attribute to know it has loaded; without it the SDK never becomes ready.
        if (!stylesheet) element.dataset.status = 'ready';
        resolve(getSdk?.() || element);
      }
    };
    // Without a getSdk probe the script's own load event is the readiness signal.
    const onLoad = () => finish(!stylesheet && getSdk && !getSdk()
      ? new Error('Payment SDK did not initialize correctly.')
      : null);
    const onError = () => finish(new Error('Failed to load the secure payment form.'));
    const timer = setTimeout(() => finish(new Error('Payment SDK loading timed out. Please try again.')), timeoutMs);
    element.addEventListener('load', onLoad);
    element.addEventListener('error', onError);
    if (existing) {
      const alreadyLoaded = element.dataset.tapSdkLoaded === 'true'
        || element.dataset.status === 'ready'
        || /loaded|complete/.test(element.readyState || '');
      if (alreadyLoaded) onLoad();
      return;
    }
    if (stylesheet) {
      element.rel = 'stylesheet';
      element.href = url;
    } else {
      element.src = url;
      element.async = true;
    }
    document.head.appendChild(element);
  });
  pendingResources.set(key, promise);
  const forget = () => pendingResources.delete(key);
  promise.then(forget, forget);
  return promise;
};

export const loadTapSdk = (url, getSdk, timeoutMs) => loadResource(url, { getSdk, timeoutMs });
export const loadTapStyles = (url) => url ? loadResource(url, { stylesheet: true }) : Promise.resolve();
export const extractTapToken = (payload) => payload?.id || payload?.token?.id || payload?.data?.id || null;

export const getApplePaySupport = () => {
  if (typeof window === 'undefined' || !window.isSecureContext) return 'insecure';
  try {
    if (typeof window.ApplePaySession?.canMakePayments !== 'function') return 'unsupported';
    return window.ApplePaySession.canMakePayments() ? 'supported' : 'unsupported';
  } catch (error) {
    if (/insecure/i.test(String(error?.message || error))) return 'insecure';
    // Privacy restrictions/iframes can prevent capability checks without proving lack of support.
    return 'unknown';
  }
};
