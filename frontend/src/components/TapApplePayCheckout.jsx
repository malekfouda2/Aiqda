import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  APPLE_PAY_JS_URL,
  APPLE_PAY_SESSION_TIMEOUT_MS,
  SDK_READY_TIMEOUT_MS,
  extractTapToken,
  getApplePaySupport,
  loadTapSdk,
  loadTapStyles,
} from '../utils/tapSdk';

const getErrorMessage = (error, locale) => {
  const ar = locale === 'ar';
  const message = typeof error === 'string' ? error : error?.message || error?.errors?.[0]?.description || '';
  if (/unsupported|not available on this device/i.test(message)) return ar
    ? 'لا يمكن استخدام Apple Pay في هذا المتصفح حاليًا. استخدم البطاقة أو جرّب جهازًا ومتصفحًا مدعومين.'
    : 'Apple Pay cannot be used in this browser right now. Use a card or try a supported device and browser.';
  if (/insecure|secure context/i.test(message)) return ar
    ? 'يتطلب Apple Pay اتصال HTTPS آمنًا. يمكنك استخدام طريقة دفع أخرى.'
    : 'Apple Pay requires a secure HTTPS connection. Please use another payment method.';
  if (/configured|domain|merchant/i.test(message)) return ar
    ? 'تعذر تهيئة Apple Pay لهذا الموقع. جرّب طريقة دفع أخرى.'
    : 'Apple Pay could not be set up for this site. Please use another payment method.';
  if (/timed out/i.test(message)) return ar
    ? 'انتهت مهلة Apple Pay. أغلق نافذة الدفع إن كانت مفتوحة ثم حاول مرة أخرى.'
    : 'Apple Pay timed out. Close the payment sheet if it is open, then try again.';
  return ar
    ? 'تعذر تجهيز Apple Pay الآن. حاول مرة أخرى أو استخدم البطاقة.'
    : 'Apple Pay could not be prepared right now. Try again or use a card.';
};

export default function TapApplePayCheckout({
  config, amount, currency, locale = 'en', customer, disabled = false,
  onReadyStateChange, onBusyStateChange, onTokenReady,
}) {
  const containerIdRef = useRef(`tap-apple-pay-${Math.random().toString(36).slice(2, 10)}`);
  const [state, setState] = useState({ status: 'loading', error: '' });
  const [attempt, setAttempt] = useState(0);
  const notify = useEffectEvent((next) => {
    setState(next);
    onReadyStateChange?.({ ready: next.status === 'ready', error: next.error });
    onBusyStateChange?.(next.status === 'busy');
  });
  const deliverToken = useEffectEvent((token, data) => onTokenReady?.(token, data));
  const clearBusy = useEffectEvent(() => onBusyStateChange?.(false));

  useEffect(() => {
    let disposed = false;
    let terminal = false;
    let busy = false;
    let tokenDelivered = false;
    let renderResult;
    let sdk;
    let readyTimer;
    let sessionTimer;

    const stopSession = () => {
      clearTimeout(sessionTimer);
      if (busy) {
        busy = false;
        try { sdk?.abortApplePaySession?.(); } catch { /* Already closed by the SDK. */ }
      }
    };
    const fail = (error, status = 'error') => {
      if (disposed || terminal) return;
      terminal = true;
      clearTimeout(readyTimer);
      stopSession();
      notify({ status, error: getErrorMessage(error, locale) });
    };

    const mount = async () => {
      notify({ status: 'loading', error: '' });
      try {
        if (!config?.enabled || !config?.sdkUrl || !config?.merchantId || !config?.domain || !config?.publicKey) {
          throw new Error('Apple Pay is not configured.');
        }
        if (!window.isSecureContext) {
          fail('insecure', 'unsupported');
          return;
        }
        // Tap 1.2.0 uses Apple's JS button, including third-party browser support.
        // Do not reject a missing native ApplePaySession before this script loads.
        // Apple registers <apple-pay-button> from a follow-up script, so the load
        // event is the only readiness signal here.
        await loadTapSdk(APPLE_PAY_JS_URL);
        if (disposed) return;
        const support = getApplePaySupport();
        if (support === 'unsupported' || support === 'insecure') {
          fail(support, 'unsupported');
          return;
        }
        await loadTapStyles(config.cssUrl);
        sdk = await loadTapSdk(config.sdkUrl, () => window.TapApplepaySDK?.render && window.TapApplepaySDK);
        if (disposed) return;

        readyTimer = setTimeout(() => fail('Apple Pay readiness timed out.'), SDK_READY_TIMEOUT_MS);
        renderResult = sdk.render({
          debug: false,
          scope: 'TapToken',
          publicKey: config.publicKey,
          environment: config.environment || 'development',
          merchant: { domain: config.domain, id: config.merchantId },
          acceptance: { supportedBrands: ['mada', 'masterCard', 'visa'] },
          features: { supportsCouponCode: false },
          transaction: { currency, amount: String(amount) },
          customer: {
            name: [{ locale: locale === 'ar' ? 'ar' : 'en', first: customer?.firstName || 'Aiqda', last: customer?.lastName || 'Member' }],
            contact: {
              ...(customer?.email ? { email: customer.email } : {}),
              ...(customer?.phoneCountryCode && customer?.phoneNumber ? {
                phone: { countryCode: `+${String(customer.phoneCountryCode).replace(/^\+/, '')}`, number: customer.phoneNumber },
              } : {}),
            },
          },
          interface: { locale: locale === 'ar' ? 'ar' : 'en', theme: 'light', type: 'buy', edges: 'curved' },
          onReady: () => {
            if (disposed || terminal || busy || tokenDelivered) return;
            clearTimeout(readyTimer);
            // Apple hides its own button where Apple Pay cannot run; say so instead
            // of pointing the member at a button that is not there.
            if (document.getElementById(containerIdRef.current)?.querySelector('apple-pay-button')?.hidden) {
              fail('unsupported', 'unsupported');
              return;
            }
            notify({ status: 'ready', error: '' });
          },
          onClick: () => {
            if (disposed || terminal || busy || tokenDelivered) return;
            // Tap only logs to the console when no session can be created.
            if (!window.ApplePaySession) { fail('unsupported', 'unsupported'); return; }
            busy = true;
            notify({ status: 'busy', error: '' });
            sessionTimer = setTimeout(() => fail('Apple Pay session timed out.'), APPLE_PAY_SESSION_TIMEOUT_MS);
          },
          onCancel: () => {
            if (disposed || terminal || tokenDelivered) return;
            busy = false;
            clearTimeout(sessionTimer);
            notify({ status: 'ready', error: '' });
          },
          onError: (error) => fail(error),
          onSuccess: async (data) => {
            if (disposed || terminal || tokenDelivered) return;
            const tokenId = extractTapToken(data);
            if (!tokenId) { fail('Apple Pay token was not returned.'); return; }
            tokenDelivered = true;
            busy = false;
            clearTimeout(sessionTimer);
            clearTimeout(readyTimer);
            notify({ status: 'submitting', error: '' });
            try {
              await deliverToken(tokenId, data);
            } catch (error) {
              fail(error);
            }
          },
        }, containerIdRef.current);
      } catch (error) {
        fail(error);
      }
    };
    void mount();
    return () => {
      disposed = true;
      clearTimeout(readyTimer);
      stopSession();
      clearBusy();
      // Tap caches a singleton React root: clearing innerHTML does not release it.
      try { renderResult?.unmount?.(); } catch { /* Keep cleanup safe during navigation. */ }
    };
  }, [attempt, amount, currency, locale, config?.enabled, config?.sdkUrl, config?.cssUrl,
    config?.merchantId, config?.domain, config?.publicKey, config?.environment,
    customer?.email, customer?.firstName, customer?.lastName, customer?.phoneCountryCode, customer?.phoneNumber]);

  return (
    <div className="space-y-3" aria-busy={state.status === 'loading' || state.status === 'busy'}>
      <div id={containerIdRef.current} className="min-h-[48px]" hidden={Boolean(state.error)} inert={disabled || state.status !== 'ready'} />
      {state.status === 'loading' && <p role="status" className="text-sm text-gray-600">{locale === 'ar' ? 'جارٍ تجهيز Apple Pay...' : 'Preparing Apple Pay...'}</p>}
      {state.status === 'ready' && <p className="text-sm text-gray-600">{locale === 'ar' ? 'اضغط زر Apple Pay أعلاه للمتابعة.' : 'Select the Apple Pay button above to continue.'}</p>}
      {state.status === 'busy' && <p role="status" className="text-sm text-gray-600">{locale === 'ar' ? 'أكمل الدفع في نافذة Apple Pay أو أغلقها.' : 'Continue in the Apple Pay sheet, or close it to cancel.'}</p>}
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.status === 'error' && <button type="button" className="btn-secondary" disabled={disabled} onClick={() => setAttempt((value) => value + 1)}>{locale === 'ar' ? 'إعادة المحاولة' : 'Retry Apple Pay'}</button>}
    </div>
  );
}
