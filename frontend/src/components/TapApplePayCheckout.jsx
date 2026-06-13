import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const scriptPromises = new Map();
const loadedStyles = new Set();

const loadScript = (url) => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Apple Pay can only load in the browser.'));
  }

  if (window.TapApplepaySDK) {
    return Promise.resolve(window.TapApplepaySDK);
  }

  if (scriptPromises.has(url)) {
    return scriptPromises.get(url);
  }

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-tap-apple-pay-sdk="${url}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.TapApplepaySDK), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Apple Pay.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.tapApplePaySdk = url;
    script.onload = () => resolve(window.TapApplepaySDK);
    script.onerror = () => reject(new Error('Failed to load Apple Pay.'));
    document.head.appendChild(script);
  });

  scriptPromises.set(url, promise);
  return promise;
};

const loadStylesheet = (url) => {
  if (!url || typeof document === 'undefined' || loadedStyles.has(url)) {
    return;
  }

  const existing = document.querySelector(`link[data-tap-apple-pay-css="${url}"]`);
  if (existing) {
    loadedStyles.add(url);
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.dataset.tapApplePayCss = url;
  document.head.appendChild(link);
  loadedStyles.add(url);
};

const extractTokenId = (payload) => (
  payload?.id
  || payload?.token?.id
  || payload?.data?.id
  || null
);

const getErrorMessage = (errorLike, locale = 'en') => {
  const isArabic = locale === 'ar';
  const rawMessage = typeof errorLike === 'string'
    ? errorLike
    : errorLike?.message || errorLike?.errors?.[0]?.description || '';

  if (/not configured|domain|merchant/i.test(rawMessage)) {
    return isArabic
      ? 'Apple Pay غير متاح حاليًا على هذا النطاق.'
      : 'Apple Pay is not available on this domain right now.';
  }

  if (/device|browser|available/i.test(rawMessage)) {
    return isArabic
      ? 'Apple Pay غير متاح على هذا الجهاز أو المتصفح.'
      : 'Apple Pay is not available on this device or browser.';
  }

  if (/load/i.test(rawMessage)) {
    return isArabic
      ? 'تعذر تحميل Apple Pay الآن. يرجى المحاولة مرة أخرى.'
      : 'Apple Pay could not be loaded right now. Please try again.';
  }

  if (/token/i.test(rawMessage)) {
    return isArabic
      ? 'تعذر تجهيز بيانات Apple Pay الآمنة.'
      : 'We could not prepare the secure Apple Pay details.';
  }

  return rawMessage || (isArabic ? 'تعذر تجهيز Apple Pay.' : 'We could not prepare Apple Pay.');
};

const TapApplePayCheckout = forwardRef(function TapApplePayCheckout({
  config,
  amount,
  currency,
  locale = 'en',
  customer,
  onReadyStateChange,
  onTokenReady,
}, ref) {
  const containerIdRef = useRef(`tap-apple-pay-${Math.random().toString(36).slice(2, 10)}`);
  const [loadError, setLoadError] = useState('');

  useImperativeHandle(ref, () => ({
    start: () => {
      const container = document.getElementById(containerIdRef.current);
      const trigger = container?.querySelector('button, [role="button"], apple-pay-button');
      if (!trigger) {
        throw new Error(locale === 'ar' ? 'زر Apple Pay غير جاهز بعد.' : 'Apple Pay is not ready yet.');
      }
      trigger.click();
    },
  }), [locale]);

  useEffect(() => {
    let disposed = false;

    const teardown = () => {
      const container = document.getElementById(containerIdRef.current);
      if (container) {
        container.innerHTML = '';
      }
    };

    const mountApplePay = async () => {
      if (!config?.enabled || !config?.sdkUrl || !config?.merchantId || !config?.domain || !config?.publicKey) {
        const message = getErrorMessage('Apple Pay is not configured.', locale);
        setLoadError(message);
        onReadyStateChange?.({ ready: false, error: message });
        return;
      }

      if (typeof window === 'undefined' || typeof window.ApplePaySession === 'undefined') {
        const message = getErrorMessage('Apple Pay is not available on this device or browser.', locale);
        setLoadError(message);
        onReadyStateChange?.({ ready: false, error: message });
        return;
      }

      try {
        setLoadError('');
        onReadyStateChange?.({ ready: false, error: '' });
        loadStylesheet(config.cssUrl);
        await loadScript(config.sdkUrl);
        if (disposed) {
          return;
        }

        const sdk = window.TapApplepaySDK;
        if (!sdk?.render) {
          throw new Error('Apple Pay did not initialize correctly.');
        }

        teardown();

        sdk.render({
          debug: false,
          scope: 'TapToken',
          publicKey: config.publicKey,
          environment: config.environment || 'development',
          merchant: {
            domain: config.domain,
            id: config.merchantId,
          },
          acceptance: {
            supportedBrands: ['mada', 'masterCard', 'visa'],
          },
          features: {
            supportsCouponCode: false,
          },
          transaction: {
            currency,
            amount: String(amount),
          },
          customer: {
            name: [
              {
                locale: locale === 'ar' ? 'ar' : 'en',
                first: customer?.firstName || 'Aiqda',
                last: customer?.lastName || 'Member',
              },
            ],
            contact: {
              ...(customer?.email ? { email: customer.email } : {}),
              ...(customer?.phoneCountryCode && customer?.phoneNumber ? {
                phone: {
                  countryCode: `+${String(customer.phoneCountryCode).replace(/^\+/, '')}`,
                  number: customer.phoneNumber,
                },
              } : {}),
            },
          },
          interface: {
            locale: locale === 'ar' ? 'ar' : 'en',
            theme: 'light',
            type: 'buy',
            edges: 'curved',
          },
          onReady: () => {
            if (!disposed) {
              onReadyStateChange?.({ ready: true, error: '' });
            }
          },
          onCancel: () => {},
          onError: (error) => {
            if (disposed) {
              return;
            }

            const message = getErrorMessage(error, locale);
            setLoadError(message);
            onReadyStateChange?.({ ready: false, error: message });
          },
          onSuccess: (data) => {
            if (disposed) {
              return;
            }

            const tokenId = extractTokenId(data);
            if (!tokenId) {
              const message = getErrorMessage('Apple Pay token was not returned.', locale);
              setLoadError(message);
              onReadyStateChange?.({ ready: false, error: message });
              return;
            }

            onTokenReady?.(tokenId, data);
          },
        }, containerIdRef.current);

      } catch (error) {
        const message = getErrorMessage(error, locale);
        if (!disposed) {
          setLoadError(message);
          onReadyStateChange?.({ ready: false, error: message });
        }
      }
    };

    mountApplePay();

    return () => {
      disposed = true;
      teardown();
    };
  }, [amount, config, currency, customer?.email, customer?.firstName, customer?.lastName, customer?.phoneCountryCode, customer?.phoneNumber, locale, onReadyStateChange, onTokenReady]);

  return (
    <div className="space-y-3">
      <div id={containerIdRef.current} className="min-h-[56px]" />
      {loadError && (
        <p className="text-sm text-red-600">{loadError}</p>
      )}
    </div>
  );
});

export default TapApplePayCheckout;
