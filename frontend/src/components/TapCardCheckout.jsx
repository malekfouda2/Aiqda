import { forwardRef, useEffect, useEffectEvent, useImperativeHandle, useRef, useState } from 'react';
import { extractTapToken, loadTapSdk, SDK_READY_TIMEOUT_MS, TOKENIZE_TIMEOUT_MS } from '../utils/tapSdk';

const getErrorMessage = (errorLike, locale = 'en') => {
  const isArabic = locale === 'ar';

  if (!errorLike) {
    return isArabic
      ? 'تعذر تجهيز نموذج الدفع الآمن.'
      : 'We could not prepare the secure payment form.';
  }

  if (typeof errorLike === 'string') {
    if (/timed out/i.test(errorLike)) {
      return isArabic
        ? 'انتهت مهلة تجهيز البطاقة. أعد تحميل النموذج ثم حاول مرة أخرى.'
        : 'The secure card form timed out. Reload the form and try again.';
    }
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
  disabled = false,
  onSdkStateChange,
}, ref) {
  const containerIdRef = useRef(`tap-card-${Math.random().toString(36).slice(2, 10)}`);
  const unmountRef = useRef(null);
  const tokenizePromiseRef = useRef(null);
  const readyRef = useRef(false);
  const validRef = useRef(false);
  const failRef = useRef(null);
  const [loadError, setLoadError] = useState('');
  const [retryRequired, setRetryRequired] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const notifyState = useEffectEvent((state) => onSdkStateChange?.(state));

  useEffect(() => {
    let disposed = false;
    let terminal = false;
    let readyTimer;

    const teardownCard = () => {
      if (typeof unmountRef.current === 'function') {
        try { unmountRef.current(); } catch { /* The SDK may already have removed its frame. */ }
        unmountRef.current = null;
      }
    };

    const fail = (error) => {
      if (disposed || terminal) return;
      terminal = true;
      clearTimeout(readyTimer);
      readyRef.current = false;
      validRef.current = false;
      const message = getErrorMessage(error, locale);
      setLoadError(message);
      setRetryRequired(true);
      rejectPendingTokenization(message);
      notifyState({ ready: false, valid: false, error: message });
    };
    failRef.current = fail;

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
        notifyState({ ready: false, valid: false, error: message });
        return;
      }

      try {
        setLoadError('');
        setRetryRequired(false);
        readyRef.current = false;
        validRef.current = false;
        notifyState({ ready: false, valid: false, error: '' });
        await loadTapSdk(sdkUrl, () => window.CardSDK?.renderTapCard && window.CardSDK?.tokenize && window.CardSDK);
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

        readyTimer = setTimeout(() => fail('Card SDK readiness timed out.'), SDK_READY_TIMEOUT_MS);
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
            if (!disposed && !terminal) {
              clearTimeout(readyTimer);
              readyRef.current = true;
              setLoadError('');
              notifyState({ ready: true, valid: validRef.current, error: '' });
            }
          },
          onValidInput: () => {
            if (!disposed && !terminal) {
              validRef.current = true;
              setLoadError('');
              notifyState({ ready: readyRef.current, valid: true, error: '' });
            }
          },
          onInvalidInput: () => {
            if (!disposed && !terminal) {
              validRef.current = false;
              setLoadError('');
              rejectPendingTokenization(locale === 'ar' ? 'يرجى التحقق من بيانات البطاقة.' : 'Please check the card details.');
              notifyState({ ready: readyRef.current, valid: false, error: '' });
            }
          },
          onError: (data) => {
            if (disposed || terminal) {
              return;
            }

            fail(data);
          },
          onSuccess: (data) => {
            if (disposed || terminal || !tokenizePromiseRef.current) {
              return;
            }

            const tokenId = extractTapToken(data);
            if (!tokenId) { fail('Payment token was not returned.'); return; }
            tokenizePromiseRef.current.resolve({ ...data, id: tokenId });
            tokenizePromiseRef.current = null;
          },
        });

        if (renderResult?.unmount) {
          unmountRef.current = renderResult.unmount;
        }
      } catch (error) {
        fail(error);
      }
    };

    mountCard();

    return () => {
      disposed = true;
      clearTimeout(readyTimer);
      readyRef.current = false;
      validRef.current = false;
      failRef.current = null;
      teardownCard();
      rejectPendingTokenization('Tap card checkout was interrupted.');
    };
  }, [
    attempt,
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
    publicKey,
    sdkUrl,
  ]);

  useImperativeHandle(ref, () => ({
    tokenize: async () => {
      if (disabled || !readyRef.current || !window.CardSDK?.tokenize) {
        throw new Error(
          locale === 'ar'
            ? 'نموذج الدفع الآمن لا يزال قيد التحميل.'
            : 'The secure payment form is still loading.'
        );
      }

      if (!validRef.current) {
        throw new Error(locale === 'ar' ? 'يرجى التحقق من بيانات البطاقة.' : 'Please check the card details.');
      }

      // The SDK has no attempt identifier: never overlap tokenization requests.
      if (tokenizePromiseRef.current) {
        throw new Error(locale === 'ar' ? 'جارٍ تجهيز البطاقة بالفعل.' : 'Card tokenization is already in progress.');
      }

      return new Promise((resolve, reject) => {
        let settled = false;
        // Tap fires onSuccess/onError, but if the SDK stays silent the promise
        // would hang forever and freeze the checkout modal. Guard with a timeout.
        const timer = setTimeout(() => {
          if (settled) {
            return;
          }
          // Retire this SDK instance so late success cannot settle a later attempt.
          failRef.current?.('Card tokenization timed out.');
        }, TOKENIZE_TIMEOUT_MS);

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
        try {
          Promise.resolve(window.CardSDK.tokenize()).catch((error) => failRef.current?.(error));
        } catch (error) {
          failRef.current?.(error);
        }
      });
    },
  }), [disabled, locale]);

  return (
    <div className="space-y-3">
      <div
        id={containerIdRef.current}
        className="min-h-[200px] rounded-2xl border border-gray-200 bg-white p-3"
        inert={disabled || retryRequired}
      />
      {loadError && (
        <p role="alert" className="text-sm text-red-600">{loadError}</p>
      )}
      {retryRequired && <button type="button" disabled={disabled} className="btn-secondary" onClick={() => setAttempt((value) => value + 1)}>{locale === 'ar' ? 'إعادة تحميل نموذج البطاقة' : 'Reload card form'}</button>}
    </div>
  );
});

export default TapCardCheckout;
