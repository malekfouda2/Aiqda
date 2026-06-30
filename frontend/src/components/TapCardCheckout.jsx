import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const scriptPromises = new Map();

const loadScript = (url) => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Tap Card SDK can only load in the browser.'));
  }

  if (window.CardSDK) {
    return Promise.resolve(window.CardSDK);
  }

  if (scriptPromises.has(url)) {
    return scriptPromises.get(url);
  }

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-tap-card-sdk="${url}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.CardSDK), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Tap Card SDK.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.tapCardSdk = url;
    script.onload = () => resolve(window.CardSDK);
    script.onerror = () => reject(new Error('Failed to load Tap Card SDK.'));
    document.head.appendChild(script);
  });

  scriptPromises.set(url, promise);
  return promise;
};

const getErrorMessage = (errorLike, locale = 'en') => {
  const isArabic = locale === 'ar';

  if (!errorLike) {
    return isArabic
      ? 'تعذر تجهيز نموذج الدفع الآمن.'
      : 'We could not prepare the secure payment form.';
  }

  if (typeof errorLike === 'string') {
    if (/failed to load|did not initialize|unknown error/i.test(errorLike)) {
      return isArabic
        ? 'تعذر تحميل نموذج الدفع الآمن. يرجى تحديث الصفحة والمحاولة مرة أخرى.'
        : 'The secure payment form could not be loaded. Please refresh the page and try again.';
    }

    if (/interrupted/i.test(errorLike)) {
      return isArabic
        ? 'تمت مقاطعة إدخال الدفع. يرجى المحاولة مرة أخرى.'
        : 'Payment entry was interrupted. Please try again.';
    }

    if (/not ready/i.test(errorLike)) {
      return isArabic
        ? 'نموذج الدفع الآمن لا يزال قيد التحميل.'
        : 'The secure payment form is still loading.';
    }

    if (/configured/i.test(errorLike)) {
      return isArabic
        ? 'الدفع الإلكتروني غير متاح حاليًا.'
        : 'Electronic checkout is not available right now.';
    }

    return errorLike.replace(/\bTap\b/gi, isArabic ? 'وسيلة الدفع' : 'payment');
  }

  if (errorLike.message) {
    return getErrorMessage(errorLike.message, locale);
  }

  if (errorLike.errors?.[0]?.description) {
    return getErrorMessage(errorLike.errors[0].description, locale);
  }

  return isArabic
    ? 'تعذر تجهيز نموذج الدفع الآمن.'
    : 'We could not prepare the secure payment form.';
};

const TapCardCheckout = forwardRef(function TapCardCheckout({
  sdkUrl,
  publicKey,
  merchantId,
  amount,
  currency,
  locale = 'en',
  direction = 'ltr',
  customer,
  onSdkStateChange,
}, ref) {
  const containerIdRef = useRef(`tap-card-${Math.random().toString(36).slice(2, 10)}`);
  const unmountRef = useRef(null);
  const tokenizePromiseRef = useRef(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let disposed = false;

    const teardownCard = () => {
      if (typeof unmountRef.current === 'function') {
        unmountRef.current();
        unmountRef.current = null;
      }
    };

    const rejectPendingTokenization = (message) => {
      if (tokenizePromiseRef.current) {
        tokenizePromiseRef.current.reject(new Error(message));
        tokenizePromiseRef.current = null;
      }
    };

    const mountCard = async () => {
      if (!sdkUrl || !publicKey) {
        const message = locale === 'ar'
          ? 'الدفع الإلكتروني غير متاح حاليًا.'
          : 'Electronic checkout is not available right now.';
        setLoadError(message);
        onSdkStateChange?.({ ready: false, valid: false, error: message });
        return;
      }

      try {
        setLoadError('');
        onSdkStateChange?.({ ready: false, valid: false, error: '' });
        await loadScript(sdkUrl);
        if (disposed) {
          return;
        }

        const sdk = window.CardSDK;
        if (!sdk?.renderTapCard) {
          throw new Error('Tap Card SDK did not initialize correctly.');
        }

        teardownCard();

        const { renderTapCard, Theme, Direction, Edges, Locale } = sdk;
        const cardLocale = locale === 'ar' ? Locale.AR : Locale.EN;
        const cardDirection = direction === 'rtl' ? Direction.RTL : Direction.LTR;

        const customerPayload = {
          ...(customer?.id ? { id: customer.id } : {}),
          ...(customer?.firstName || customer?.lastName
            ? {
                name: [
                  {
                    lang: cardLocale,
                    first: customer?.firstName || 'Aiqda',
                    last: customer?.lastName || 'Member',
                  },
                ],
                nameOnCard: customer?.nameOnCard || [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || 'Aiqda Member',
                editable: true,
              }
            : {}),
          ...(customer?.email || customer?.phoneCountryCode || customer?.phoneNumber
            ? {
                contact: {
                  ...(customer?.email ? { email: customer.email } : {}),
                  ...(customer?.phoneCountryCode && customer?.phoneNumber
                    ? {
                        phone: {
                          countryCode: customer.phoneCountryCode,
                          number: customer.phoneNumber,
                        },
                      }
                    : {}),
                },
              }
            : {}),
        };

        const renderResult = renderTapCard(containerIdRef.current, {
          publicKey,
          ...(merchantId ? { merchant: { id: merchantId } } : {}),
          transaction: {
            amount,
            currency,
          },
          customer: customerPayload,
          acceptance: {
            supportedBrands: ['AMERICAN_EXPRESS', 'VISA', 'MASTERCARD', 'MADA'],
            supportedCards: 'ALL',
          },
          fields: {
            cardHolder: true,
          },
          addons: {
            displayPaymentBrands: true,
            loader: true,
            saveCard: false,
          },
          interface: {
            locale: cardLocale,
            theme: Theme.LIGHT,
            edges: Edges.CURVED,
            direction: cardDirection,
          },
          onReady: () => {
            if (!disposed) {
              onSdkStateChange?.({ ready: true, valid: false, error: '' });
            }
          },
          onValidInput: () => {
            if (!disposed) {
              onSdkStateChange?.({ ready: true, valid: true, error: '' });
            }
          },
          onInvalidInput: () => {
            if (!disposed) {
              onSdkStateChange?.({ ready: true, valid: false, error: '' });
            }
          },
          onError: (data) => {
            if (disposed) {
              return;
            }

            const message = getErrorMessage(data, locale);
            setLoadError(message);
            rejectPendingTokenization(message);
            onSdkStateChange?.({ ready: true, valid: false, error: message });
          },
          onSuccess: (data) => {
            if (disposed || !tokenizePromiseRef.current) {
              return;
            }

            tokenizePromiseRef.current.resolve(data);
            tokenizePromiseRef.current = null;
          },
        });

        if (renderResult?.unmount) {
          unmountRef.current = renderResult.unmount;
        }
      } catch (error) {
        const message = getErrorMessage(error, locale);
        if (!disposed) {
          setLoadError(message);
          rejectPendingTokenization(message);
          onSdkStateChange?.({ ready: false, valid: false, error: message });
        }
      }
    };

    mountCard();

    return () => {
      disposed = true;
      teardownCard();
      rejectPendingTokenization('Tap card checkout was interrupted.');
    };
  }, [
    amount,
    currency,
    customer?.email,
    customer?.firstName,
    customer?.id,
    customer?.lastName,
    customer?.nameOnCard,
    customer?.phoneCountryCode,
    customer?.phoneNumber,
    direction,
    locale,
    merchantId,
    onSdkStateChange,
    publicKey,
    sdkUrl,
  ]);

  useImperativeHandle(ref, () => ({
    tokenize: async () => {
      if (!window.CardSDK?.tokenize) {
        throw new Error(
          locale === 'ar'
            ? 'نموذج الدفع الآمن لا يزال قيد التحميل.'
            : 'The secure payment form is still loading.'
        );
      }

      // Drop any stale pending tokenization so a previous attempt can never
      // leave this one unresolved.
      if (tokenizePromiseRef.current) {
        tokenizePromiseRef.current.reject(
          new Error(locale === 'ar' ? 'تمت مقاطعة إدخال الدفع.' : 'Payment entry was interrupted.')
        );
        tokenizePromiseRef.current = null;
      }

      return new Promise((resolve, reject) => {
        let settled = false;
        // Tap fires onSuccess/onError, but if the SDK stays silent the promise
        // would hang forever and freeze the checkout modal. Guard with a timeout.
        const timer = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          tokenizePromiseRef.current = null;
          reject(
            new Error(
              locale === 'ar'
                ? 'انتهت مهلة تجهيز الدفع. يرجى المحاولة مرة أخرى.'
                : 'Payment processing timed out. Please try again.'
            )
          );
        }, 45000);

        tokenizePromiseRef.current = {
          resolve: (value) => {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timer);
            resolve(value);
          },
          reject: (error) => {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timer);
            reject(error);
          },
        };
        window.CardSDK.tokenize();
      });
    },
  }), [locale]);

  return (
    <div className="space-y-3">
      <div
        id={containerIdRef.current}
        className="min-h-[200px] rounded-2xl border border-gray-200 bg-white p-3"
      />
      {loadError && (
        <p className="text-sm text-red-600">{loadError}</p>
      )}
    </div>
  );
});

export default TapCardCheckout;
