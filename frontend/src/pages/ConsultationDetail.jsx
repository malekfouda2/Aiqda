import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { consultationsAPI, consultationBookingsAPI, paymentsAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import useUIStore from '../store/uiStore';
import CheckoutDisclaimerModal from '../components/CheckoutDisclaimerModal';
import LoadingSpinner from '../components/LoadingSpinner';
import TapCardCheckout from '../components/TapCardCheckout';
import TapApplePayCheckout from '../components/TapApplePayCheckout';
import { pageVariants, fadeInUp } from '../utils/animations';
import { getLocalizedArrayField, getLocalizedField } from '../i18n/translations';
import { useLocale } from '../i18n/useLocale';

const splitName = (value = '') => {
  const normalizedName = String(value).trim();
  if (!normalizedName) {
    return { firstName: 'Aiqda', lastName: 'Member' };
  }

  const [firstName, ...rest] = normalizedName.split(/\s+/);
  return {
    firstName: firstName || 'Aiqda',
    lastName: rest.join(' ') || 'Member',
  };
};

const getConsultationModeLabel = (consultation, locale) => {
  if (locale === 'ar') {
    if (typeof consultation.modeAr === 'string' && consultation.modeAr.trim()) {
      return consultation.modeAr;
    }

    if (consultation.mode === '1 to 1') {
      return 'فردي';
    }

    if (consultation.mode === '1 to many') {
      return 'جماعي';
    }
  }

  return consultation.mode;
};

const getFriendlyCheckoutMessage = (message, isRTL) => {
  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) {
    return '';
  }

  if (/tap checkout is not configured|tap is not configured/i.test(normalizedMessage)) {
    return isRTL
      ? 'الدفع الإلكتروني غير متاح حاليًا. يرجى المحاولة مرة أخرى لاحقًا.'
      : 'Electronic checkout is not available right now. Please try again later.';
  }

  if (/apple pay is not available/i.test(normalizedMessage)) {
    return isRTL
      ? 'Apple Pay غير متاح على هذا الجهاز أو النطاق حاليًا.'
      : 'Apple Pay is not available on this device or domain right now.';
  }

  if (/did not return a payment token|continuation url|card sdk|secure payment form|interrupted|card checkout/i.test(normalizedMessage)) {
    return isRTL
      ? 'تعذر تجهيز نموذج الدفع الآمن. يرجى تحديث الصفحة والمحاولة مرة أخرى.'
      : 'We could not prepare the secure payment form. Please refresh the page and try again.';
  }

  if (/consultation booking is already in progress/i.test(normalizedMessage)) {
    return isRTL
      ? 'يوجد بالفعل طلب حجز أو عملية دفع جارية لهذه الاستشارة.'
      : 'A consultation booking or payment is already in progress for this session.';
  }

  return normalizedMessage
    .replace(/\bTap\b/gi, isRTL ? 'وسيلة الدفع' : 'payment method')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

function ConsultationDetail() {
  const { locale, isRTL } = useLocale();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { showSuccess, showError } = useUIStore();
  const tapCardRef = useRef(null);
  const applePayRef = useRef(null);

  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showCheckoutDisclaimer, setShowCheckoutDisclaimer] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [tapConfig, setTapConfig] = useState(null);
  const [tapConfigError, setTapConfigError] = useState('');
  const [tapConfigLoading, setTapConfigLoading] = useState(false);
  const [tapSdkState, setTapSdkState] = useState({ ready: false, valid: false, error: '' });
  const [applePayState, setApplePayState] = useState({ ready: false, error: '' });
  const [selectedCheckoutMethod, setSelectedCheckoutMethod] = useState('card');
  const [applePayArmed, setApplePayArmed] = useState(false);
  const [phoneCountryCode, setPhoneCountryCode] = useState(user?.phone?.countryCode || '966');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone?.number || '');
  const [paymentSyncing, setPaymentSyncing] = useState(false);

  const tapChargeId = searchParams.get('tap_id');
  const checkoutCurrency = consultation?.currency || tapConfig?.currency || 'SAR';
  const applePayAvailable = Boolean(tapConfig?.applePay?.enabled);
  const fallbackTapConfigError = isRTL
    ? 'الدفع الإلكتروني غير متاح حاليًا.'
    : 'Electronic checkout is not available right now.';

  useEffect(() => {
    fetchConsultation();
  }, [id]);

  useEffect(() => {
    if (!user?.phone?.countryCode && !user?.phone?.number) {
      return;
    }

    setPhoneCountryCode((current) => current || user.phone.countryCode || '966');
    setPhoneNumber((current) => current || user.phone.number || '');
  }, [user]);

  useEffect(() => {
    if (!tapChargeId || !consultation || consultation.priceType !== 'fixed') {
      return undefined;
    }

    let cancelled = false;

    const syncTapCharge = async () => {
      setPaymentSyncing(true);
      try {
        const response = await paymentsAPI.syncTapCharge(tapChargeId);
        if (cancelled) {
          return;
        }

        const payment = response.data;
        if (payment.status === 'captured' || payment.status === 'approved') {
          setIsSubmitted(true);
          showSuccess(
            isRTL
              ? 'تم استلام الدفع وإرسال طلب الحجز للمراجعة.'
              : 'Payment received and your consultation request was sent for review.'
          );
        } else if (payment.status === 'failed' || payment.status === 'cancelled' || payment.status === 'rejected') {
          showError(
            getFriendlyCheckoutMessage(
              payment.failureReason || payment.tapResponseMessage,
              isRTL
            ) || (isRTL ? 'تعذر إكمال الدفع.' : 'The payment could not be completed.')
          );
        }
      } catch (error) {
        if (!cancelled) {
          showError(error.response?.data?.error || (isRTL ? 'تعذر التحقق من حالة الدفع الآن.' : 'We could not confirm the payment status yet.'));
        }
      } finally {
        if (!cancelled) {
          setPaymentSyncing(false);
          const nextParams = new URLSearchParams(searchParams.toString());
          nextParams.delete('tap_id');
          nextParams.delete('tap_redirect');
          nextParams.delete('consultationBookingId');
          setSearchParams(nextParams, { replace: true });
        }
      }
    };

    syncTapCharge();

    return () => {
      cancelled = true;
    };
  }, [consultation, isRTL, searchParams, setSearchParams, showError, showSuccess, tapChargeId]);

  useEffect(() => {
    if (!consultation || consultation.priceType !== 'fixed') {
      return undefined;
    }

    let cancelled = false;

    const fetchTapCheckoutConfig = async () => {
      setTapConfigLoading(true);
      try {
        const response = await paymentsAPI.getTapConfig();
        if (!cancelled) {
          setTapConfig(response.data);
          setTapConfigError('');
        }
      } catch (error) {
        if (!cancelled) {
          setTapConfig(null);
          setTapConfigError(
            getFriendlyCheckoutMessage(
              error.response?.data?.error,
              isRTL
            ) || fallbackTapConfigError
          );
        }
      } finally {
        if (!cancelled) {
          setTapConfigLoading(false);
        }
      }
    };

    fetchTapCheckoutConfig();

    return () => {
      cancelled = true;
    };
  }, [consultation, fallbackTapConfigError, isRTL]);

  useEffect(() => {
    if (!applePayArmed || !applePayState.ready || submittingPayment) {
      return;
    }

    try {
      applePayRef.current?.start();
    } catch (error) {
      setApplePayArmed(false);
      showError(
        getFriendlyCheckoutMessage(error.message, isRTL)
          || (isRTL ? 'تعذر فتح Apple Pay الآن.' : 'We could not open Apple Pay right now.')
      );
    }
  }, [applePayArmed, applePayState.ready, isRTL, showError, submittingPayment]);

  const fetchConsultation = async () => {
    setLoading(true);
    try {
      const response = await consultationsAPI.getById(id);
      setConsultation(response.data);
    } catch (error) {
      console.error('Failed to fetch consultation:', error);
      showError(isRTL ? 'تعذر تحميل تفاصيل الاستشارة' : 'Failed to load consultation details');
    } finally {
      setLoading(false);
    }
  };

  const fetchTapCheckoutConfig = async () => {
    setTapConfigLoading(true);
    try {
      const response = await paymentsAPI.getTapConfig();
      setTapConfig(response.data);
      setTapConfigError('');
      return response.data;
    } catch (error) {
      const message = getFriendlyCheckoutMessage(
        error.response?.data?.error,
        isRTL
      ) || fallbackTapConfigError;
      setTapConfig(null);
      setTapConfigError(message);
      return null;
    } finally {
      setTapConfigLoading(false);
    }
  };

  const handleSubmitInquiry = async (event) => {
    event.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/consultations/${id}` } } });
      return;
    }

    setSubmitting(true);
    try {
      await consultationBookingsAPI.submit({
        consultationId: id,
      });
      setIsSubmitted(true);
      showSuccess(isRTL ? 'تم إرسال طلب الحجز بنجاح!' : 'Your booking has been submitted successfully!');
    } catch (error) {
      showError(error.response?.data?.error || (isRTL ? 'تعذر إرسال طلب الحجز' : 'Failed to submit booking'));
    } finally {
      setSubmitting(false);
    }
  };

  const ensureCheckoutReady = async () => {
    if (!consultation || consultation.priceType !== 'fixed') {
      return null;
    }

    let activeTapConfig = tapConfig;
    if (!activeTapConfig) {
      activeTapConfig = await fetchTapCheckoutConfig();
      if (!activeTapConfig) {
        showError(
          isRTL
            ? 'تعذر تحميل نموذج الدفع الآن. يرجى المحاولة مرة أخرى خلال لحظات.'
            : 'We could not load the payment form right now. Please try again in a moment.'
        );
        return null;
      }
    }

    if (!phoneCountryCode.trim() || !phoneNumber.trim()) {
      showError(isRTL ? 'يرجى إدخال رقم الهاتف لإكمال الدفع.' : 'Please enter your phone number to complete checkout.');
      return null;
    }

    return activeTapConfig;
  };

  const handleBeginCheckout = async (method = 'card') => {
    const activeTapConfig = await ensureCheckoutReady();
    if (!activeTapConfig) {
      return;
    }

    setSelectedCheckoutMethod(method === 'apple_pay' ? 'apple_pay' : 'card');
    setApplePayState({ ready: false, error: '' });
    setShowCheckoutDisclaimer(true);
  };

  const submitTokenizedCheckout = async ({ tokenId, checkoutMethod }) => {
    const response = await consultationBookingsAPI.createCheckout({
      consultationId: id,
      tokenId,
      checkoutMethod,
      phoneCountryCode,
      phoneNumber,
      checkoutDisclaimerAccepted: true,
    });

    const payment = response.data?.payment;
    const redirectUrl = response.data?.redirectUrl;

    if (payment?.status === 'captured' || payment?.status === 'approved') {
      setShowCheckoutDisclaimer(false);
      setApplePayArmed(false);
      setIsSubmitted(true);
      showSuccess(
        isRTL
          ? 'تم استلام الدفع وإرسال طلب الحجز للمراجعة.'
          : 'Payment received and your consultation request was sent for review.'
      );
      return;
    }

    if (redirectUrl) {
      window.location.assign(redirectUrl);
      return;
    }

    throw new Error(isRTL ? 'تعذر المتابعة إلى صفحة الدفع.' : 'We could not continue to the payment page.');
  };

  const handleConfirmCheckout = async () => {
    if (selectedCheckoutMethod === 'apple_pay') {
      setApplePayArmed(true);
      setShowCheckoutDisclaimer(false);
      return;
    }

    if (!tapCardRef.current) {
      showError(isRTL ? 'نموذج البطاقة غير جاهز بعد.' : 'The card form is not ready yet.');
      return;
    }

    setSubmittingPayment(true);
    try {
      const tokenResponse = await tapCardRef.current.tokenize();
      const tokenId = tokenResponse?.id;
      if (!tokenId) {
        throw new Error(isRTL ? 'تعذر تجهيز تفاصيل الدفع الآمنة.' : 'We could not prepare your secure payment details.');
      }

      await submitTokenizedCheckout({
        tokenId,
        checkoutMethod: 'card',
      });
    } catch (error) {
      showError(
        getFriendlyCheckoutMessage(
          error.response?.data?.error || error.message,
          isRTL
        ) || (isRTL ? 'تعذر بدء الدفع الإلكتروني.' : 'Failed to start electronic checkout.')
      );
    } finally {
      setSubmittingPayment(false);
      setShowCheckoutDisclaimer(false);
    }
  };

  const handleApplePayTokenReady = async (tokenId) => {
    setSubmittingPayment(true);
    try {
      await submitTokenizedCheckout({
        tokenId,
        checkoutMethod: 'apple_pay',
      });
    } catch (error) {
      showError(
        getFriendlyCheckoutMessage(
          error.response?.data?.error || error.message,
          isRTL
        ) || (isRTL ? 'تعذر بدء الدفع الإلكتروني.' : 'Failed to start electronic checkout.')
      );
    } finally {
      setSubmittingPayment(false);
      setApplePayArmed(false);
    }
  };

  const tapCustomer = useMemo(() => {
    const { firstName, lastName } = splitName(user?.name || '');

    return {
      firstName,
      lastName,
      nameOnCard: [firstName, lastName].filter(Boolean).join(' '),
      email: user?.email || '',
      phoneCountryCode,
      phoneNumber,
    };
  }, [phoneCountryCode, phoneNumber, user?.email, user?.name]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text={isRTL ? 'جارٍ تحميل الاستشارة...' : 'Loading consultation...'} />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isRTL ? 'الاستشارة غير موجودة' : 'Consultation not found'}</h2>
          <Link to="/consultations" className="btn-primary">{isRTL ? 'تصفح الاستشارات' : 'Browse Consultations'}</Link>
        </div>
      </div>
    );
  }

  const localizedFocusPoints = getLocalizedArrayField(consultation, 'focusPoints', locale);
  const localizedMode = getConsultationModeLabel(consultation, locale);
  const localizedDuration = getLocalizedField(consultation, 'duration', locale);

  return (
    <div className="min-h-screen py-12 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-30" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb w-[400px] h-[400px] bg-cyan-100/40 top-[-100px] right-[-100px] animate-float-slow" />
        <div className="floating-orb w-[300px] h-[300px] bg-primary-100/40 bottom-[-100px] left-[-50px] animate-float" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={pageVariants}
          initial="hidden"
          animate="visible"
        >
          <Link to="/consultations" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 group transition-colors">
            <svg className={`w-5 h-5 transition-transform ${isRTL ? 'group-hover:translate-x-1 flip-in-rtl' : 'group-hover:-translate-x-1'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isRTL ? 'العودة إلى الاستشارات' : 'Back to Consultations'}
          </Link>

          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-3/5">
              <motion.div variants={fadeInUp} className="card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className={`tag ${consultation.mode === '1 to 1' ? 'tag-beginner' : 'tag-intermediate'}`}>
                    {localizedMode}
                  </span>
                  <span className="text-gray-400 font-medium">{localizedDuration}</span>
                </div>

                <h1 className="text-4xl font-bold text-gray-900 mb-6">{getLocalizedField(consultation, 'title', locale)}</h1>
                <p className="text-gray-600 text-lg leading-relaxed mb-8">
                  {getLocalizedField(consultation, 'description', locale)}
                </p>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="text-primary-500">🎯</span> {isRTL ? 'نقاط التركيز' : 'Focus Points'}
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {localizedFocusPoints.map((point, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <span className="text-primary-500 font-bold">✓</span>
                          <span className="text-gray-700 text-sm">{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="lg:w-2/5">
              <motion.div variants={fadeInUp} className="sticky top-8">
                {isSubmitted ? (
                  <div className="card p-8 text-center border-emerald-100 bg-emerald-50/30">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-emerald-100 flex items-center justify-center text-4xl">
                      🎉
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                      {isRTL ? 'تم استلام الحجز' : 'Booking Submitted'}
                    </h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                      {isRTL
                        ? 'تم استلام طلب الحجز بنجاح. سيقوم فريقنا بمراجعته ثم تأكيد الجلسة ومشاركة الرابط معك.'
                        : 'Your consultation request has been received successfully. Our team will review it, confirm the session, and share the meeting link with you.'}
                    </p>
                    <Link to="/dashboard/consultations" className="btn-primary w-full justify-center">
                      {isRTL ? 'عرض حجوزاتي' : 'View My Bookings'}
                    </Link>
                  </div>
                ) : (
                  <div className="card p-8">
                    {!user ? (
                      <div className="text-center py-6">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-50 flex items-center justify-center text-3xl">
                          🔒
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{isRTL ? 'سجّل الدخول للحجز' : 'Login to Book'}</h3>
                        <p className="text-gray-500 mb-6">{isRTL ? 'يجب تسجيل الدخول لحجز استشارة.' : 'You need to be logged in to book a consultation.'}</p>
                        <Link
                          to="/login"
                          state={{ from: { pathname: `/consultations/${id}` } }}
                          className="btn-primary w-full justify-center"
                        >
                          {isRTL ? 'سجّل الدخول الآن' : 'Login Now'}
                        </Link>
                      </div>
                    ) : consultation.priceType === 'fixed' ? (
                      <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-900">
                          {isRTL ? 'إتمام الحجز والدفع' : 'Complete Booking & Payment'}
                        </h2>

                        {paymentSyncing && (
                          <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4">
                            <p className="text-sm leading-7 text-primary-700">
                              {isRTL ? 'جارٍ التحقق من حالة الدفع...' : 'Confirming your payment status...'}
                            </p>
                          </div>
                        )}

                        <div className="p-4 rounded-2xl bg-primary-50 border border-primary-100">
                          <p className="text-sm text-primary-700 font-medium mb-1">{isRTL ? 'المبلغ المطلوب' : 'Amount Due'}</p>
                          <p className="text-3xl font-bold text-primary-900">
                            {consultation.price} <span className="text-lg">{consultation.currency || checkoutCurrency}</span>
                          </p>
                        </div>

                        <div className="rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-4">
                          <p className="text-sm leading-7 text-gray-600">
                            {isRTL
                              ? 'أكمل الحجز عبر نموذج دفع آمن. نطلب رقم الهاتف لإتمام عملية الدفع والتواصل إذا لزم الأمر.'
                              : 'Complete this booking through a secure payment form. We ask for your phone number to complete checkout and contact you if needed.'}
                          </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                          <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">
                              {isRTL ? 'رمز الدولة' : 'Country Code'}
                            </label>
                            <input
                              type="text"
                              value={phoneCountryCode}
                              onChange={(event) => setPhoneCountryCode(event.target.value)}
                              className="input-field"
                              placeholder="966"
                              inputMode="numeric"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">
                              {isRTL ? 'رقم الهاتف' : 'Phone Number'}
                            </label>
                            <input
                              type="text"
                              value={phoneNumber}
                              onChange={(event) => setPhoneNumber(event.target.value)}
                              className="input-field"
                              placeholder={isRTL ? '5xxxxxxxx' : '5xxxxxxxx'}
                              inputMode="numeric"
                            />
                          </div>
                        </div>

                        {tapConfigLoading && (
                          <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4">
                            <p className="text-sm leading-7 text-primary-700">
                              {isRTL ? 'جارٍ تجهيز نموذج الدفع الآمن...' : 'Preparing the secure payment form...'}
                            </p>
                          </div>
                        )}

                        {tapConfigError && !tapConfigLoading && (
                          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
                            <p className="text-sm leading-7 text-red-700">{tapConfigError}</p>
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => fetchTapCheckoutConfig()}
                                className="btn-secondary"
                              >
                                {isRTL ? 'إعادة المحاولة' : 'Retry'}
                              </button>
                            </div>
                          </div>
                        )}

                        {tapConfig && (
                          <div className="space-y-6">
                            <TapCardCheckout
                              ref={tapCardRef}
                              sdkUrl={tapConfig.sdkUrl}
                              publicKey={tapConfig.publicKey}
                              merchantId={tapConfig.merchantId}
                              amount={Number(consultation.price || 0)}
                              currency={consultation.currency || tapConfig.currency || checkoutCurrency}
                              locale={isRTL ? 'ar' : 'en'}
                              direction={isRTL ? 'rtl' : 'ltr'}
                              customer={tapCustomer}
                              onSdkStateChange={setTapSdkState}
                            />

                            {applePayAvailable ? (
                              <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">Apple Pay</p>
                                    <p className="mt-1 text-sm leading-7 text-gray-600">
                                      {isRTL
                                        ? 'إذا كنت تستخدم جهاز Apple ومتصفحًا يدعم Apple Pay، يمكنك إتمام الحجز مباشرة عبره.'
                                        : 'If you are using a supported Apple device and browser, you can complete this booking with Apple Pay.'}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleBeginCheckout('apple_pay')}
                                    disabled={submittingPayment || tapConfigLoading}
                                    className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {applePayArmed
                                      ? (isRTL ? 'جارٍ تجهيز Apple Pay...' : 'Preparing Apple Pay...')
                                      : (isRTL ? 'المتابعة عبر Apple Pay' : 'Continue With Apple Pay')}
                                  </button>
                                </div>

                                {applePayArmed && (
                                  <div className="mt-4">
                                    <TapApplePayCheckout
                                      ref={applePayRef}
                                      config={{
                                        ...tapConfig.applePay,
                                        publicKey: tapConfig.publicKey,
                                      }}
                                      amount={Number(consultation.price || 0)}
                                      currency={consultation.currency || tapConfig.currency || checkoutCurrency}
                                      locale={isRTL ? 'ar' : 'en'}
                                      customer={tapCustomer}
                                      onReadyStateChange={setApplePayState}
                                      onTokenReady={handleApplePayTokenReady}
                                    />
                                  </div>
                                )}

                                {applePayState.error && (
                                  <p className="mt-3 text-sm text-red-600">{applePayState.error}</p>
                                )}
                              </div>
                            ) : (
                              <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-4">
                                <p className="text-sm leading-7 text-gray-600">
                                  {isRTL
                                    ? 'سيظهر Apple Pay على النطاق الآمن المباشر وعند استخدام جهاز ومتصفح مدعومين.'
                                    : 'Apple Pay will appear on the secure live domain when using a supported Apple device and browser.'}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => handleBeginCheckout('card')}
                            disabled={!tapConfig || !tapSdkState.ready || submittingPayment || tapConfigLoading}
                            className="btn-primary flex-1 justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {submittingPayment
                              ? (isRTL ? 'جارٍ الإرسال...' : 'Submitting...')
                              : (isRTL ? 'ادفع الآن' : 'Pay Now')}
                          </button>
                        </div>

                        {tapSdkState.error && (
                          <p className="text-sm text-red-600">{tapSdkState.error}</p>
                        )}
                      </div>
                    ) : (
                      <form onSubmit={handleSubmitInquiry}>
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">
                          {isRTL ? 'أرسل استفسارًا' : 'Submit Inquiry'}
                        </h2>

                        <div className="space-y-6">
                          <div className="p-4 rounded-2xl bg-cyan-50 border border-cyan-100">
                            <p className="text-sm text-cyan-700 font-medium">{isRTL ? 'حسب الاتفاق' : 'Contract Based'}</p>
                            <p className="text-sm text-cyan-600 mt-2 italic">
                              {isRTL ? 'سيتواصل معك فريقنا لمناقشة التسعير ونطاق التعاون.' : 'Our team will contact you to discuss pricing and collaboration scope.'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={submitting}
                          className="btn-primary w-full justify-center mt-8 py-4 text-lg"
                        >
                          {submitting
                            ? (isRTL ? 'جارٍ الإرسال...' : 'Submitting...')
                            : (isRTL ? 'إرسال الاستفسار' : 'Submit Inquiry')}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>

      <CheckoutDisclaimerModal
        open={showCheckoutDisclaimer}
        onConfirm={handleConfirmCheckout}
        onCancel={() => {
          setShowCheckoutDisclaimer(false);
          setApplePayArmed(false);
        }}
        isSubmitting={submittingPayment}
      />
    </div>
  );
}

export default ConsultationDetail;
