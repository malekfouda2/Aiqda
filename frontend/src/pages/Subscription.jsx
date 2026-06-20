import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';

import { subscriptionsAPI, paymentsAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import useUIStore from '../store/uiStore';
import CheckoutDisclaimerModal from '../components/CheckoutDisclaimerModal';
import LoadingSpinner from '../components/LoadingSpinner';
import TapCardCheckout from '../components/TapCardCheckout';
import TapApplePayCheckout from '../components/TapApplePayCheckout';
import { getLocalizedField } from '../i18n/translations';
import { useLocale } from '../i18n/useLocale';
import {
  SUBSCRIPTION_DEVICE_LIMIT_DISCLAIMER,
  SUBSCRIPTION_DEVICE_LIMIT_TITLE,
} from '../content/subscriptionPolicy';
import { pageVariants, fadeInUp } from '../utils/animations';
import {
  formatMoney,
  getActiveBillingOptions,
  getAnnualSavings,
  getSixMonthSavings,
  getBillingCadenceLabel,
  getBillingOption,
  getBillingTermLabel,
  getDefaultBillingTerm,
  getEffectiveBillingPrice,
  getBillingSaleAmount,
  getBillingSalePercentage,
  getPackageAccessNames,
  getPackageSaleSummary,
  hasBillingSale,
} from '../utils/subscriptions';

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

const getFriendlyBillingMessage = (message, isRTL) => {
  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) {
    return '';
  }

  if (/no saved tap card|no saved tap billing agreement/i.test(normalizedMessage)) {
    return isRTL
      ? 'سيصبح التجديد التلقائي متاحًا بعد حفظ وسيلة دفع صالحة على حسابك.'
      : 'Automatic renewal becomes available after a valid payment method is saved to your account.';
  }

  if (/no saved payment method/i.test(normalizedMessage)) {
    return isRTL
      ? 'لا توجد وسيلة دفع محفوظة لهذا الاشتراك حاليًا.'
      : 'No saved payment method is available for this membership right now.';
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

  if (/payment already exists for this subscription/i.test(normalizedMessage)) {
    return isRTL
      ? 'توجد بالفعل عملية دفع جارية لهذا الاشتراك.'
      : 'A checkout is already in progress for this subscription.';
  }

  if (/no pending subscription found/i.test(normalizedMessage)) {
    return isRTL
      ? 'انتهت صلاحية جلسة الاشتراك هذه. يرجى اختيار الخطة مرة أخرى.'
      : 'This subscription session has expired. Please choose your plan again.';
  }

  return normalizedMessage
    .replace(/\bTap\b/gi, isRTL ? 'وسيلة الدفع' : 'payment method')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

function Subscription() {
  const { locale, pick, formatDate, isRTL } = useLocale();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, hasAcceptedCurrentPlatformNotice, refreshProfile } = useAuthStore();
  const { showSuccess, showError } = useUIStore();
  const tapCardRef = useRef(null);
  const applePayRef = useRef(null);

  const [packages, setPackages] = useState([]);
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [pendingSubscription, setPendingSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [selectedTerms, setSelectedTerms] = useState({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutPurpose, setCheckoutPurpose] = useState('subscription');
  const [showCheckoutDisclaimer, setShowCheckoutDisclaimer] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [autoChargingSavedMethod, setAutoChargingSavedMethod] = useState(false);
  const [tapConfig, setTapConfig] = useState(null);
  const [tapConfigError, setTapConfigError] = useState('');
  const [tapConfigLoading, setTapConfigLoading] = useState(false);
  const [tapSdkState, setTapSdkState] = useState({ ready: false, valid: false, error: '' });
  const [applePayState, setApplePayState] = useState({ ready: false, error: '' });
  const [phoneCountryCode, setPhoneCountryCode] = useState(user?.phone?.countryCode || '966');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone?.number || '');
  const [paymentSyncing, setPaymentSyncing] = useState(false);
  const [updatingAutoRenew, setUpdatingAutoRenew] = useState(false);
  const [removingBillingProfile, setRemovingBillingProfile] = useState(false);
  const [selectedCheckoutMethod, setSelectedCheckoutMethod] = useState('card');
  const [applePayArmed, setApplePayArmed] = useState(false);

  const displayPackages = packages.filter((pkg) => (
    pkg.publicVisibility === 'coming_soon'
    || (pkg.publicVisibility !== 'hidden' && pkg.isActive !== false)
  ));

  const tapChargeId = searchParams.get('tap_id');
  const recoverySubscription = activeSubscription?.status === 'grace_period' ? activeSubscription : null;
  const checkoutSubscription = pendingSubscription || recoverySubscription || null;
  const checkoutMode = pendingSubscription ? 'initial' : recoverySubscription ? 'recovery' : null;
  const isRecoveryCheckout = checkoutMode === 'recovery';
  const isBillingProfileSetupCheckout = checkoutPurpose === 'billing_profile';
  const checkoutAmount = isBillingProfileSetupCheckout
    ? Number(tapConfig?.billingProfileSetup?.amount || 0)
    : Number(checkoutSubscription?.priceAtPurchase || 0);
  const checkoutCurrency = isBillingProfileSetupCheckout
    ? tapConfig?.billingProfileSetup?.currency || tapConfig?.currency || 'SAR'
    : checkoutSubscription?.currency || tapConfig?.currency || 'SAR';

  const clearPaymentQueryParams = () => {
    const nextParams = new URLSearchParams(searchParams.toString());
    ['tap_id', 'tap_redirect', 'billingProfileSetup', 'data', 'subscriptionId', 'consultationBookingId'].forEach((key) => {
      nextParams.delete(key);
    });
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    if (!hasAcceptedCurrentPlatformNotice()) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      try {
        const [packagesRes, activeRes, userSubsRes] = await Promise.all([
          subscriptionsAPI.getPackages(false),
          subscriptionsAPI.getActiveSubscription(),
          subscriptionsAPI.getUserSubscriptions(),
        ]);

        if (cancelled) {
          return;
        }

        const nextPackages = packagesRes.data || [];
        setPackages(nextPackages);
        setSelectedTerms(
          nextPackages.reduce((accumulator, pkg) => {
            const defaultTerm = getDefaultBillingTerm(pkg);
            if (defaultTerm) {
              accumulator[pkg._id] = defaultTerm;
            }
            return accumulator;
          }, {})
        );
        setActiveSubscription(activeRes.data);
        const nextPending = (userSubsRes.data || []).find((subscription) => subscription.status === 'pending') || null;
        setPendingSubscription(nextPending);
        setShowCheckout(Boolean(nextPending));
      } catch (error) {
        console.error('Failed to fetch subscription data:', error);
        if (!cancelled) {
          showError(error.response?.data?.error || (isRTL ? 'تعذر تحميل الاشتراكات' : 'Failed to load subscriptions'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }

      setTapConfigLoading(true);
      try {
        const tapConfigResponse = await paymentsAPI.getTapConfig();
        if (!cancelled) {
          setTapConfig(tapConfigResponse.data);
          setTapConfigError('');
        }
      } catch (error) {
        if (!cancelled) {
          setTapConfig(null);
          setTapConfigError(
            getFriendlyBillingMessage(
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

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [hasAcceptedCurrentPlatformNotice, isRTL, showError]);

  useEffect(() => {
    if (!user?.phone?.countryCode && !user?.phone?.number) {
      return;
    }

    setPhoneCountryCode((current) => current || user.phone.countryCode || '966');
    setPhoneNumber((current) => current || user.phone.number || '');
  }, [user]);

  useEffect(() => {
    if (!tapChargeId || !hasAcceptedCurrentPlatformNotice()) {
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
          showSuccess(
            payment.paymentType === 'billing_profile_setup'
              ? (isRTL ? 'تم حفظ وسيلة الدفع بنجاح.' : 'Your payment method was saved successfully.')
              : (isRTL ? 'تم تأكيد الدفع وتفعيل الاشتراك.' : 'Payment confirmed and subscription activated.')
          );
        } else if (payment.status === 'failed' || payment.status === 'cancelled' || payment.status === 'rejected') {
          showError(
            getFriendlyBillingMessage(
              payment.failureReason || payment.tapResponseMessage,
              isRTL
            ) || (isRTL ? 'تعذر إكمال الدفع.' : 'The payment could not be completed.')
          );
        }

        await Promise.all([refreshProfile(), fetchLatestSubscriptions()]);
      } catch (error) {
        if (!cancelled) {
          showError(error.response?.data?.error || (isRTL ? 'تعذر التحقق من حالة الدفع الآن.' : 'We could not confirm the payment status yet.'));
        }
      } finally {
        if (!cancelled) {
          setPaymentSyncing(false);
          clearPaymentQueryParams();
        }
      }
    };

    syncTapCharge();

    return () => {
      cancelled = true;
    };
  }, [hasAcceptedCurrentPlatformNotice, isRTL, refreshProfile, searchParams, setSearchParams, showError, showSuccess, tapChargeId]);

  useEffect(() => {
    if (tapChargeId) {
      return;
    }

    if (!searchParams.get('billingProfileSetup') && !searchParams.get('data') && !searchParams.get('tap_redirect')) {
      return;
    }

    clearPaymentQueryParams();
  }, [searchParams, setSearchParams, tapChargeId]);

  const fetchLatestSubscriptions = async () => {
    const [activeRes, userSubsRes] = await Promise.all([
      subscriptionsAPI.getActiveSubscription(),
      subscriptionsAPI.getUserSubscriptions(),
    ]);

    const nextActiveSubscription = activeRes.data || null;
    setActiveSubscription(nextActiveSubscription);
    const nextPending = (userSubsRes.data || []).find((subscription) => subscription.status === 'pending') || null;
    setPendingSubscription(nextPending);
    setShowCheckout((current) => current && Boolean(nextPending || nextActiveSubscription?.status === 'grace_period'));
  };

  const handleAutoRenewPreference = async (enabled) => {
    if (!activeSubscription?._id) {
      return;
    }

    setUpdatingAutoRenew(true);
    try {
      const response = await subscriptionsAPI.updateAutoRenew(activeSubscription._id, enabled);
      setActiveSubscription(response.data);
      showSuccess(
        enabled
          ? (isRTL ? 'تم تفعيل التجديد التلقائي.' : 'Automatic renewal is now enabled.')
          : (isRTL ? 'تم إيقاف التجديد التلقائي.' : 'Automatic renewal is now turned off.')
      );
      await refreshProfile();
    } catch (error) {
      showError(
        getFriendlyBillingMessage(
          error.response?.data?.error,
          isRTL
        )
        || (enabled
          ? (isRTL ? 'تعذر تفعيل التجديد التلقائي.' : 'We could not enable automatic renewal.')
          : (isRTL ? 'تعذر إيقاف التجديد التلقائي.' : 'We could not turn off automatic renewal.'))
      );
    } finally {
      setUpdatingAutoRenew(false);
    }
  };

  const updateSelectedTerm = (packageId, billingTerm) => {
    setSelectedTerms((current) => ({
      ...current,
      [packageId]: billingTerm,
    }));
  };

  const handleRequestSubscription = async (packageId, billingTerm) => {
    if (!hasAcceptedCurrentPlatformNotice()) {
      showError(isRTL ? 'يرجى قبول الشروط والأحكام الخاصة بالمستخدمين قبل المتابعة.' : 'Please accept the Terms & Conditions For Users before continuing.');
      return;
    }

    setRequesting(true);
    try {
      const response = await subscriptionsAPI.requestSubscription(packageId, billingTerm);
      const nextSubscription = response.data;
      setCheckoutPurpose('subscription');
      setPendingSubscription(nextSubscription);

      if (savedBillingProfile?.hasSavedCard) {
        setShowCheckout(false);
        await startSavedPaymentMethodCharge(nextSubscription._id);
        return;
      }

      setShowCheckout(true);
      showSuccess(isRTL ? 'تم إنشاء طلب الاشتراك. أكمل الدفع الإلكتروني لتفعيل الوصول.' : 'Subscription request created. Complete electronic checkout to activate access.');
    } catch (error) {
      showError(error.response?.data?.error || (isRTL ? 'تعذر طلب الاشتراك' : 'Failed to request subscription'));
    } finally {
      setRequesting(false);
    }
  };

  const startSavedPaymentMethodCharge = async (subscriptionId) => {
    if (!subscriptionId) {
      return false;
    }

    setAutoChargingSavedMethod(true);
    try {
      const response = await paymentsAPI.createTapCharge({
        subscriptionId,
        useSavedPaymentMethod: true,
        checkoutMethod: 'saved_card',
        checkoutDisclaimerAccepted: true,
      });

      const payment = response.data?.payment;
      const redirectUrl = response.data?.redirectUrl;

      if (payment?.status === 'captured' || payment?.status === 'approved') {
        showSuccess(isRTL ? 'تم استخدام وسيلة الدفع المحفوظة وتفعيل الاشتراك.' : 'Your saved payment method was used and the subscription is now active.');
        setShowCheckout(false);
        await Promise.all([refreshProfile(), fetchLatestSubscriptions()]);
        clearPaymentQueryParams();
        return true;
      }

      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return true;
      }

      throw new Error(isRTL ? 'تعذر إكمال الدفع باستخدام وسيلة الدفع المحفوظة.' : 'We could not complete the charge using your saved payment method.');
    } catch (error) {
      showError(
        getFriendlyBillingMessage(
          error.response?.data?.error || error.message,
          isRTL
        ) || (isRTL ? 'تعذر استخدام وسيلة الدفع المحفوظة. يمكنك تحديث البطاقة أو إكمال الدفع يدويًا.' : 'We could not use your saved payment method. You can update the card or complete checkout manually.')
      );
      setShowCheckout(true);
      return false;
    } finally {
      setAutoChargingSavedMethod(false);
    }
  };

  const handleRemoveSavedPaymentMethod = async () => {
    if (!savedBillingProfile?.hasSavedCard) {
      return;
    }

    if (!window.confirm(isRTL ? 'هل تريد إزالة وسيلة الدفع المحفوظة وإيقاف التجديد التلقائي؟' : 'Remove the saved payment method and turn off automatic renewal?')) {
      return;
    }

    setRemovingBillingProfile(true);
    try {
      await paymentsAPI.removeSavedBillingProfile();
      showSuccess(
        isRTL
          ? 'تمت إزالة وسيلة الدفع المحفوظة وإيقاف التجديد التلقائي.'
          : 'Your saved payment method was removed and automatic renewal was turned off.'
      );
      await Promise.all([refreshProfile(), fetchLatestSubscriptions()]);
    } catch (error) {
      showError(
        getFriendlyBillingMessage(
          error.response?.data?.error,
          isRTL
        ) || (isRTL ? 'تعذر إزالة وسيلة الدفع المحفوظة.' : 'We could not remove the saved payment method.')
      );
    } finally {
      setRemovingBillingProfile(false);
    }
  };

  const openBillingProfileCheckout = async () => {
    if (!hasAcceptedCurrentPlatformNotice()) {
      showError(isRTL ? 'يرجى قبول الشروط والأحكام الخاصة بالمستخدمين قبل المتابعة.' : 'Please accept the Terms & Conditions For Users before continuing.');
      return;
    }

    setCheckoutPurpose('billing_profile');
    setShowCheckout(true);
    await ensureCheckoutReady('billing_profile');
  };

  const ensureCheckoutReady = async (purpose = checkoutPurpose) => {
    if (purpose !== 'billing_profile' && !checkoutSubscription) {
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
      showError(isRTL ? 'يرجى إدخال رقم الهاتف ليتم حفظ البطاقة للاشتراكات.' : 'Please enter a phone number so the card can be saved for subscriptions.');
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
    if (!isBillingProfileSetupCheckout && !checkoutSubscription) {
      return;
    }

    const response = isBillingProfileSetupCheckout
      ? await paymentsAPI.createBillingProfileSetupCharge({
          tokenId,
          checkoutMethod,
          phoneCountryCode,
          phoneNumber,
          checkoutDisclaimerAccepted: true,
        })
      : await paymentsAPI.createTapCharge({
          subscriptionId: checkoutSubscription._id,
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
      showSuccess(
        isBillingProfileSetupCheckout
          ? (isRTL ? 'تم حفظ وسيلة الدفع بنجاح.' : 'Your payment method was saved successfully.')
          : (isRTL ? 'تم تأكيد الدفع وتفعيل الاشتراك.' : 'Payment confirmed and subscription activated.')
      );
      if (isBillingProfileSetupCheckout) {
        setShowCheckout(false);
        setCheckoutPurpose('subscription');
      }
      await Promise.all([refreshProfile(), fetchLatestSubscriptions()]);
      return;
    }

    if (redirectUrl) {
      window.location.assign(redirectUrl);
      return;
    }

    throw new Error(isRTL ? 'تعذر المتابعة إلى صفحة الدفع.' : 'We could not continue to the payment page.');
  };

  const handleConfirmCheckout = async () => {
    if (!isBillingProfileSetupCheckout && !checkoutSubscription) {
      return;
    }

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
        getFriendlyBillingMessage(
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
        getFriendlyBillingMessage(
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

  const savedBillingProfile = user?.billingProfile || null;
  const savedCardSummary = savedBillingProfile?.hasSavedCard
    ? [savedBillingProfile.cardBrand, savedBillingProfile.cardLastFour ? `•••• ${savedBillingProfile.cardLastFour}` : null]
        .filter(Boolean)
        .join(' ')
    : '';
  const autoRenewSetupHint = isRTL
    ? 'يمكن تفعيل التجديد التلقائي بعد حفظ وسيلة دفع صالحة على حسابك.'
    : 'Automatic renewal can be enabled after a valid payment method is saved to your account.';
  const savedBillingUpdatedLabel = savedBillingProfile?.updatedAt
    ? formatDate(savedBillingProfile.updatedAt)
    : '';
  const applePayAvailable = Boolean(tapConfig?.applePay?.enabled);
  const isGracePeriod = activeSubscription?.status === 'grace_period';
  const isCancelScheduled = activeSubscription?.status === 'cancel_scheduled';
  const currentSubscriptionEndsLabel = activeSubscription?.status === 'grace_period'
    ? formatDate(activeSubscription.gracePeriodEndsAt)
    : formatDate(activeSubscription?.endDate);
  const fallbackTapConfigError = isRTL
    ? 'الدفع الإلكتروني غير متاح حاليًا.'
    : 'Electronic checkout is not available right now.';

  const fetchTapCheckoutConfig = async () => {
    setTapConfigLoading(true);
    try {
      const tapConfigResponse = await paymentsAPI.getTapConfig();
      setTapConfig(tapConfigResponse.data);
      setTapConfigError('');
      return tapConfigResponse.data;
    } catch (error) {
      const message = getFriendlyBillingMessage(
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

  useEffect(() => {
    if (!applePayArmed || !applePayState.ready || submittingPayment) {
      return;
    }

    try {
      applePayRef.current?.start();
    } catch (error) {
      setApplePayArmed(false);
      showError(
        getFriendlyBillingMessage(error.message, isRTL)
          || (isRTL ? 'تعذر فتح Apple Pay الآن.' : 'We could not open Apple Pay right now.')
      );
    }
  }, [applePayArmed, applePayState.ready, isRTL, showError, submittingPayment]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text={isRTL ? 'جارٍ التحميل...' : 'Loading...'} />
      </div>
    );
  }

  if (!hasAcceptedCurrentPlatformNotice()) {
    return (
      <motion.div variants={pageVariants} initial="hidden" animate="visible">
        <motion.div variants={fadeInUp} className="card text-center py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{isRTL ? 'خطط الاشتراك' : 'Subscription Plans'}</h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            {isRTL ? 'يرجى مراجعة الشروط والأحكام الخاصة بالمستخدمين وقبولها للمتابعة إلى الاشتراكات.' : 'Please review and accept the Terms & Conditions For Users to continue with subscriptions.'}
          </p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={fadeInUp} className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{isRTL ? 'خطط الاشتراك' : 'Subscription Plans'}</h1>
        <p className="text-gray-500">{isRTL ? 'اختر الخطة المناسبة لك' : 'Choose a plan that works for you'}</p>
      </motion.div>

      <motion.div
        variants={fadeInUp}
        className="mb-8 rounded-2xl border border-blue-100 bg-blue-50/80 px-5 py-4"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-semibold text-blue-700 shadow-sm">
            i
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              {pick(SUBSCRIPTION_DEVICE_LIMIT_TITLE)}
            </h2>
            <p className="mt-1 text-sm leading-7 text-blue-900/80">
              {pick(SUBSCRIPTION_DEVICE_LIMIT_DISCLAIMER)}
            </p>
          </div>
        </div>
      </motion.div>

      {paymentSyncing && (
        <div className="card border-primary-200 bg-primary-50 mb-8">
          <p className="text-sm text-primary-700">
            {isRTL ? 'جارٍ التحقق من حالة الدفع...' : 'Confirming your payment status...'}
          </p>
        </div>
      )}

      {autoChargingSavedMethod && (
        <div className="card border-primary-200 bg-primary-50 mb-8">
          <p className="text-sm text-primary-700">
            {isRTL ? 'جارٍ استخدام وسيلة الدفع المحفوظة لإكمال الاشتراك...' : 'Using your saved payment method to complete the subscription...'}
          </p>
        </div>
      )}

      {activeSubscription && (
        <div className={`card mb-8 ${
          isGracePeriod
            ? 'bg-amber-50 border-amber-200'
            : isCancelScheduled
              ? 'bg-slate-50 border-slate-200'
              : 'bg-green-50 border-green-200'
        }`}>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isGracePeriod ? 'bg-amber-100' : isCancelScheduled ? 'bg-slate-100' : 'bg-green-50'
                }`}>
                  <span className="text-2xl">{isGracePeriod ? '⚠️' : isCancelScheduled ? '🗓️' : '✅'}</span>
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${isGracePeriod ? 'text-amber-700' : isCancelScheduled ? 'text-slate-700' : 'text-green-600'}`}>
                    {isGracePeriod
                      ? (isRTL ? 'اشتراك في فترة سماح' : 'Subscription In Grace Period')
                      : isCancelScheduled
                        ? (isRTL ? 'إلغاء مجدول' : 'Cancellation Scheduled')
                      : (isRTL ? 'اشتراك نشط' : 'Active Subscription')}
                  </h3>
                  <p className={isGracePeriod ? 'text-amber-700' : isCancelScheduled ? 'text-slate-700' : 'text-green-600'}>
                    {activeSubscription.package?.name}
                    {activeSubscription.billingTerm ? ` (${getBillingTermLabel(activeSubscription.billingTerm, locale) || activeSubscription.billingTerm})` : ''}
                    {' '} - {isGracePeriod
                      ? (isRTL ? 'فترة السماح تنتهي في' : 'Grace access ends')
                      : isCancelScheduled
                        ? (isRTL ? 'الوصول يستمر حتى' : 'Access remains until')
                      : (isRTL ? 'ينتهي في' : 'Expires')} {currentSubscriptionEndsLabel}
                  </p>
                </div>
              </div>

              {isGracePeriod && (
                <div className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-4">
                  <p className="text-sm font-semibold text-amber-800">
                    {isRTL ? 'تعذر تجديد الاشتراك تلقائيًا.' : 'We could not renew this membership automatically.'}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-amber-900/80">
                    {activeSubscription.renewalFailureReason
                      ? `${isRTL ? 'السبب:' : 'Reason:'} ${getFriendlyBillingMessage(activeSubscription.renewalFailureReason, isRTL)}`
                      : (isRTL ? 'يرجى تحديث وسيلة الدفع أو إكمال عملية الدفع مرة أخرى قبل انتهاء فترة السماح.' : 'Please update your payment method or complete checkout again before the grace period ends.')}
                  </p>
                  {activeSubscription.nextRenewalRetryAt && activeSubscription.autoRenewEnabled && (
                    <p className="mt-2 text-sm text-amber-800">
                      {isRTL
                        ? `سنحاول التجديد مرة أخرى في ${formatDate(activeSubscription.nextRenewalRetryAt)}.`
                        : `We will retry the saved payment method on ${formatDate(activeSubscription.nextRenewalRetryAt)}.`}
                    </p>
                  )}
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        setCheckoutPurpose('subscription');
                        setShowCheckout(true);
                      }}
                      className="btn-primary"
                    >
                      {isRTL ? 'استعادة الاشتراك الآن' : 'Restore Subscription Now'}
                    </button>
                    {savedBillingProfile?.hasSavedCard && (
                      <button
                        type="button"
                        onClick={handleRemoveSavedPaymentMethod}
                        disabled={removingBillingProfile}
                        className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingBillingProfile
                          ? (isRTL ? 'جارٍ الإزالة...' : 'Removing...')
                          : (isRTL ? 'إزالة وسيلة الدفع المحفوظة' : 'Remove Saved Payment Method')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {isCancelScheduled && (
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-800">
                    {isRTL ? 'تم إيقاف التجديد التلقائي لهذا الاشتراك.' : 'Automatic renewal is off for this membership.'}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {isRTL
                      ? 'سيبقى الوصول متاحًا حتى نهاية الفترة الحالية، وبعدها ينتهي الاشتراك تلقائيًا ما لم تبدأ عملية دفع جديدة.'
                      : 'Access stays available until current period ends, then membership expires automatically unless you start a new checkout.'}
                  </p>
                </div>
              )}
            </div>

            <div className={`rounded-2xl border bg-white/80 px-4 py-4 ${isGracePeriod ? 'border-amber-100' : isCancelScheduled ? 'border-slate-100' : 'border-green-100'}`}>
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isGracePeriod ? 'text-amber-700' : isCancelScheduled ? 'text-slate-700' : 'text-green-700'}`}>
                {isRTL ? 'الفوترة والتجديد' : 'Billing & Renewal'}
              </p>

              <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-4">
                <p className="text-sm font-medium text-gray-900">
                  {isRTL ? 'وسيلة الدفع المحفوظة' : 'Saved Payment Method'}
                </p>
                <p className="mt-2 text-sm leading-7 text-gray-600">
                  {savedBillingProfile?.hasSavedCard
                    ? (savedCardSummary || (isRTL ? 'وسيلة دفع محفوظة وجاهزة للتجديدات القادمة.' : 'A saved payment method is ready for future renewals.'))
                    : (isRTL ? 'لا توجد وسيلة دفع محفوظة على هذا الحساب حتى الآن.' : 'No saved payment method is stored on this account yet.')}
                </p>
                {savedBillingUpdatedLabel && (
                  <p className="mt-2 text-xs text-gray-400">
                    {isRTL ? `آخر تحديث: ${savedBillingUpdatedLabel}` : `Updated: ${savedBillingUpdatedLabel}`}
                  </p>
                )}
                {savedBillingProfile?.hasSavedCard && (
                  <button
                    type="button"
                    onClick={handleRemoveSavedPaymentMethod}
                    disabled={removingBillingProfile}
                    className="btn-secondary mt-4 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {removingBillingProfile
                      ? (isRTL ? 'جارٍ الإزالة...' : 'Removing...')
                      : (isRTL ? 'إزالة وسيلة الدفع المحفوظة' : 'Remove Saved Payment Method')}
                  </button>
                )}
              </div>

              <p className="mt-4 text-sm leading-7 text-gray-600">
                {activeSubscription.autoRenewEnabled
                  ? (savedCardSummary
                    ? (isRTL
                      ? `سيتم محاولة التجديد تلقائيًا باستخدام ${savedCardSummary}.`
                      : `Renewal will be attempted automatically using ${savedCardSummary}.`)
                    : (isRTL
                      ? 'سيتم محاولة التجديد تلقائيًا باستخدام وسيلة الدفع المحفوظة.'
                      : 'Renewal will be attempted automatically using your saved payment method.'))
                  : activeSubscription.autoRenewDisabledReason === 'payment_failed'
                    ? (isRTL
                      ? 'التجديد التلقائي متوقف حاليًا إلى أن يتم حفظ وسيلة دفع صالحة أو إكمال عملية الدفع بنجاح.'
                      : 'Automatic renewal is currently off until a valid payment method is saved or checkout is completed successfully.')
                    : savedBillingProfile?.hasSavedCard
                      ? (isRTL
                        ? 'التجديد التلقائي متوقف حاليًا. يمكنك تشغيله مرة أخرى من هنا متى شئت.'
                        : 'Automatic renewal is currently off. You can turn it back on here at any time.')
                      : (isRTL
                        ? 'التجديد التلقائي غير متاح لهذا الاشتراك بعد. سيظهر هنا بمجرد حفظ وسيلة دفع صالحة على حسابك.'
                        : 'Automatic renewal is not available on this membership yet. It will appear here once a valid payment method is saved to your account.')}
              </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={openBillingProfileCheckout}
                  className="btn-secondary"
                >
                  {savedBillingProfile?.hasSavedCard
                    ? (isRTL ? 'تحديث وسيلة الدفع' : 'Update Payment Method')
                    : (isRTL ? 'إعداد وسيلة الدفع' : 'Set Up Payment Method')}
                </button>
                {activeSubscription.autoRenewEnabled ? (
                  <button
                    type="button"
                    onClick={() => handleAutoRenewPreference(false)}
                    disabled={updatingAutoRenew}
                    className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updatingAutoRenew
                      ? (isRTL ? 'جارٍ التحديث...' : 'Updating...')
                      : (isRTL ? 'إيقاف التجديد التلقائي' : 'Turn Off Auto-Renew')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAutoRenewPreference(true)}
                    disabled={updatingAutoRenew || !savedBillingProfile?.hasSavedCard}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updatingAutoRenew
                      ? (isRTL ? 'جارٍ التحديث...' : 'Updating...')
                      : (isRTL ? 'تشغيل التجديد التلقائي' : 'Turn On Auto-Renew')}
                  </button>
                )}
                {isGracePeriod && (
                  <button
                    type="button"
                    onClick={openBillingProfileCheckout}
                    className="btn-secondary"
                  >
                    {isRTL ? 'تحديث وسيلة الدفع' : 'Update Payment Method'}
                  </button>
                )}
              </div>

              {!activeSubscription.autoRenewEnabled && !savedBillingProfile?.hasSavedCard && (
                <p className="mt-3 text-sm text-gray-500">
                  {autoRenewSetupHint}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingSubscription && !showCheckout && (
        <div className="card bg-yellow-50 border-yellow-200 mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center">
                <span className="text-2xl">⏳</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-yellow-600">{isRTL ? 'اشتراك قيد الانتظار' : 'Pending Subscription'}</h3>
                <p className="text-yellow-600">
                  {pendingSubscription.package?.name}
                  {pendingSubscription.billingTerm ? ` (${getBillingTermLabel(pendingSubscription.billingTerm, locale) || pendingSubscription.billingTerm})` : ''}
                  {pendingSubscription.priceAtPurchase ? ` - ${formatMoney(pendingSubscription.priceAtPurchase, locale)} ${pendingSubscription.currency || checkoutCurrency}` : ''}
                  {' '} - {isRTL ? 'بانتظار إتمام الدفع' : 'Awaiting checkout completion'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (savedBillingProfile?.hasSavedCard && pendingSubscription?._id) {
                  void startSavedPaymentMethodCharge(pendingSubscription._id);
                  return;
                }
                setCheckoutPurpose('subscription');
                setShowCheckout(true);
              }}
              className="btn-primary"
            >
              {savedBillingProfile?.hasSavedCard
                ? (isRTL ? 'استخدم وسيلة الدفع المحفوظة' : 'Use Saved Payment Method')
                : (isRTL ? 'متابعة الدفع' : 'Continue Checkout')}
            </button>
          </div>
        </div>
      )}

      {!activeSubscription && !pendingSubscription && user && !showCheckout && (
        <div className="card mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {isRTL ? 'وسيلة الدفع المحفوظة' : 'Saved Payment Method'}
              </h2>
              <p className="mt-2 text-sm leading-7 text-gray-600">
                {savedBillingProfile?.hasSavedCard
                  ? (savedCardSummary || (isRTL ? 'توجد وسيلة دفع محفوظة على هذا الحساب.' : 'A saved payment method is stored on this account.'))
                  : (isRTL ? 'لا توجد وسيلة دفع محفوظة على هذا الحساب حتى الآن.' : 'No saved payment method is stored on this account yet.')}
              </p>
              {savedBillingUpdatedLabel && (
                <p className="mt-2 text-xs text-gray-400">
                  {isRTL ? `آخر تحديث: ${savedBillingUpdatedLabel}` : `Updated: ${savedBillingUpdatedLabel}`}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openBillingProfileCheckout}
                className="btn-primary"
              >
                {savedBillingProfile?.hasSavedCard
                  ? (isRTL ? 'تحديث وسيلة الدفع' : 'Update Payment Method')
                  : (isRTL ? 'إعداد وسيلة الدفع' : 'Set Up Payment Method')}
              </button>
              {savedBillingProfile?.hasSavedCard && (
                <button
                  type="button"
                  onClick={handleRemoveSavedPaymentMethod}
                  disabled={removingBillingProfile}
                  className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {removingBillingProfile
                    ? (isRTL ? 'جارٍ الإزالة...' : 'Removing...')
                    : (isRTL ? 'إزالة وسيلة الدفع المحفوظة' : 'Remove Saved Payment Method')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCheckout && (checkoutSubscription || isBillingProfileSetupCheckout) && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {isBillingProfileSetupCheckout
              ? (isRTL ? 'إعداد وسيلة الدفع' : 'Saved Payment Method Setup')
              : (isRTL ? 'الدفع الإلكتروني' : 'Electronic Checkout')}
          </h2>

          <div className="rounded-2xl border border-yellow-100 bg-yellow-50/80 px-4 py-4 mb-6">
            <p className="text-sm text-yellow-800 leading-7">
              {isBillingProfileSetupCheckout ? (
                <>
                  {isRTL
                    ? 'سيتم استخدام هذه العملية لحفظ أو تحديث وسيلة الدفع الخاصة بك للتجديدات المستقبلية.'
                    : 'This checkout will save or update your payment method for future renewals.'}
                  {checkoutAmount > 0 && (
                    <>
                      {isRTL
                        ? ` مبلغ التحقق المطلوب هو ${formatMoney(checkoutAmount, locale)} ${checkoutCurrency}.`
                        : ` The verification amount is ${formatMoney(checkoutAmount, locale)} ${checkoutCurrency}.`}
                    </>
                  )}
                </>
              ) : (
                <>
                  {isRecoveryCheckout
                    ? (isRTL ? 'أنت تكمل دفعة استعادة الاشتراك من أجل ' : 'You are completing a subscription recovery payment for ')
                    : (isRTL ? 'أنت تدفع مقابل ' : 'You are paying for ')}
                  <span className="font-semibold">{checkoutSubscription.package?.name}</span>
                  {checkoutSubscription.billingTerm ? ` (${getBillingTermLabel(checkoutSubscription.billingTerm, locale) || checkoutSubscription.billingTerm})` : ''}.
                  {checkoutSubscription.priceAtPurchase
                    ? (isRTL
                      ? ` المبلغ المطلوب هو ${formatMoney(checkoutSubscription.priceAtPurchase, locale)} ${checkoutSubscription.currency || checkoutCurrency}.`
                      : ` The required amount is ${formatMoney(checkoutSubscription.priceAtPurchase, locale)} ${checkoutSubscription.currency || checkoutCurrency}.`)
                    : ''}
                </>
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-4 mb-6">
            <p className="text-sm leading-7 text-gray-600">
              {isRTL
                ? 'تتم معالجة البطاقة عبر نموذج دفع آمن. نحتاج إلى رقم الهاتف حتى يمكن حفظ وسيلة الدفع للاشتراكات والتجديدات المستقبلية.'
                : 'Your card is processed through a secure payment form. We need your phone number so your payment method can be saved for subscriptions and future renewals.'}
            </p>
          </div>

          {!isBillingProfileSetupCheckout && isRecoveryCheckout && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-4 mb-6">
              <p className="text-sm leading-7 text-amber-900/80">
                {isRTL
                  ? 'إتمام هذه العملية سيستعيد الوصول ويحدّث وسيلة الدفع المحفوظة للتجديدات القادمة.'
                  : 'Completing this checkout will restore access and update the saved payment method for future renewals.'}
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] mb-6">
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
            <div className="mb-6 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4">
              <p className="text-sm leading-7 text-primary-700">
                {isRTL ? 'جارٍ تجهيز نموذج الدفع الآمن...' : 'Preparing the secure payment form...'}
              </p>
            </div>
          )}

          {tapConfigError && !tapConfigLoading && (
            <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
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
            <div className="mb-6 space-y-6">
              <TapCardCheckout
                ref={tapCardRef}
                sdkUrl={tapConfig.sdkUrl}
                publicKey={tapConfig.publicKey}
                merchantId={tapConfig.merchantId}
                amount={checkoutAmount}
                currency={checkoutCurrency}
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
                          ? 'إذا كنت تستخدم جهاز Apple ومتصفحًا يدعم Apple Pay، يمكنك استخدامه لحفظ وسيلة الدفع وتجديد الاشتراك لاحقًا.'
                          : 'If you are using a supported Apple device and browser, you can use Apple Pay to save the payment method for future renewals.'}
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
                        amount={checkoutAmount}
                        currency={checkoutCurrency}
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
              className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submittingPayment
                ? (isRTL ? 'جارٍ الإرسال...' : 'Submitting...')
                : (isRTL ? 'ادفع الآن' : 'Pay Now')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCheckout(false);
                setCheckoutPurpose('subscription');
                setShowCheckoutDisclaimer(false);
                setApplePayArmed(false);
                setApplePayState({ ready: false, error: '' });
              }}
              className="btn-secondary"
              disabled={submittingPayment}
            >
              {isRTL ? 'إغلاق' : 'Close'}
            </button>
          </div>

          {tapSdkState.error && (
            <p className="mt-4 text-sm text-red-600">{tapSdkState.error}</p>
          )}
        </div>
      )}

      {!activeSubscription && !pendingSubscription && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayPackages.map((pkg, index) => {
            const isContactOnly = pkg.purchaseMode === 'contact_only';
            const isComingSoon = pkg.publicVisibility === 'coming_soon';
            const activeBillingOptions = getActiveBillingOptions(pkg);
            const selectedTerm = selectedTerms[pkg._id] || getDefaultBillingTerm(pkg);
            const selectedOption = getBillingOption(pkg, selectedTerm);
            const selectedCurrency = selectedOption?.currency || pkg.currency || 'SAR';
            const annualSavings = getAnnualSavings(pkg);
            const sixMonthSavings = getSixMonthSavings(pkg);
            const accessNames = getPackageAccessNames(pkg);
            const packageSaleSummary = getPackageSaleSummary(pkg);
            const selectedOptionOnSale = hasBillingSale(selectedOption);

            return (
              <motion.div
                key={pkg._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="card-hover flex flex-col"
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-1">{pkg.name}</h3>
                      {accessNames.length > 1 && (
                        <p className="text-sm text-primary-600">
                          {isRTL ? `يشمل الوصول إلى ${accessNames.slice(1).join('، ')}` : `Includes access to ${accessNames.slice(1).join(', ')}`}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isComingSoon && (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-100">
                          {isRTL ? 'قريبًا' : 'Coming Soon'}
                        </span>
                      )}
                      {packageSaleSummary && !isContactOnly && (
                        <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 border border-rose-100">
                          {isRTL ? `خصم حتى ${packageSaleSummary.bestSalePercentage}%` : `Up to ${packageSaleSummary.bestSalePercentage}% Off`}
                        </span>
                      )}
                      {isContactOnly && (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                          {isRTL ? 'مخصص' : 'Custom'}
                        </span>
                      )}
                    </div>
                  </div>

                  {!isContactOnly && activeBillingOptions.length > 1 && (
                    <div className="mb-4 rounded-2xl bg-gray-100 p-1 flex gap-1">
                      {activeBillingOptions.map((option) => (
                        <button
                          key={option.term}
                          type="button"
                          onClick={() => updateSelectedTerm(pkg._id, option.term)}
                          className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                            selectedOption?.term === option.term
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <span className="block">{getBillingTermLabel(option.term, locale) || option.label || option.term}</span>
                          {hasBillingSale(option) && (
                            <span className="mt-1 block text-[11px] font-semibold text-rose-500">
                              {isRTL ? `${getBillingSalePercentage(option)}% خصم` : `${getBillingSalePercentage(option)}% OFF`}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mb-4">
                    {isContactOnly ? (
                      <>
                        <span className="text-3xl font-bold text-gray-900">{isRTL ? 'مخصص' : 'Custom'}</span>
                        <p className="text-sm text-gray-500 mt-2">
                          {isRTL ? 'يتم ترتيب الوصول المؤسسي عبر جلسة استكشافية ونطاق مخصص.' : 'Enterprise access is arranged through a discovery call and tailored scope.'}
                        </p>
                      </>
                    ) : selectedOption ? (
                      <>
                        {selectedOptionOnSale && (
                          <div className="mb-2 flex items-center gap-2">
                            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 border border-rose-100">
                              {isRTL ? `وفّر ${formatMoney(getBillingSaleAmount(selectedOption), locale)} ${selectedCurrency}` : `Save ${formatMoney(getBillingSaleAmount(selectedOption), locale)} ${selectedCurrency}`}
                            </span>
                          </div>
                        )}
                        {selectedOptionOnSale && (
                          <p className="text-sm text-gray-400 line-through">
                            {formatMoney(selectedOption.price, locale)} {selectedCurrency}
                          </p>
                        )}
                        <span className="text-3xl font-bold text-gray-900">{formatMoney(getEffectiveBillingPrice(selectedOption), locale)}</span>
                        <span className="text-gray-500"> {selectedCurrency}</span>
                        <p className="text-sm text-gray-500 mt-1">
                          {getBillingCadenceLabel(selectedOption.term, locale)}
                        </p>
                        {selectedOption.term === 'six_months' && sixMonthSavings && (
                          <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                            <p className="text-sm font-semibold text-emerald-700">
                              {isRTL ? `وفّر ${formatMoney(sixMonthSavings.savings, locale)} ${selectedCurrency} خلال 6 أشهر` : `Save ${formatMoney(sixMonthSavings.savings, locale)} ${selectedCurrency} over 6 months`}
                            </p>
                            <p className="text-xs text-emerald-600 mt-1">
                              {isRTL ? `ما يعادل ${formatMoney(sixMonthSavings.monthlyEquivalent, locale)} ${selectedCurrency} شهريًا.` : `Equivalent to ${formatMoney(sixMonthSavings.monthlyEquivalent, locale)} ${selectedCurrency} per month.`}
                            </p>
                          </div>
                        )}
                        {selectedOption.term === 'annual' && annualSavings && (
                          <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                            <p className="text-sm font-semibold text-emerald-700">
                              {isRTL ? `وفّر ${formatMoney(annualSavings.savings, locale)} ${selectedCurrency} سنويًا` : `Save ${formatMoney(annualSavings.savings, locale)} ${selectedCurrency} each year`}
                            </p>
                            <p className="text-xs text-emerald-600 mt-1">
                              {isRTL ? `ما يعادل ${formatMoney(annualSavings.monthlyEquivalent, locale)} ${selectedCurrency} شهريًا.` : `Equivalent to ${formatMoney(annualSavings.monthlyEquivalent, locale)} ${selectedCurrency} per month.`}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">
                        {isRTL ? 'سيظهر السعر عند اكتمال إعداد هذه الباقة.' : 'Pricing will appear once this package is fully configured.'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 mb-6">
                    <DetailRow icon="📅" label={isRTL ? 'المدة' : 'Schedule'} value={getLocalizedField(pkg, 'scheduleDuration', locale)} />
                    <DetailRow icon="💻" label={isRTL ? 'النمط' : 'Mode'} value={getLocalizedField(pkg, 'learningMode', locale)} />
                    <DetailRow icon="🎯" label={isRTL ? 'التركيز' : 'Focus'} value={getLocalizedField(pkg, 'focus', locale)} />

                    {pkg.courses?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{isRTL ? 'الفصول / الأنشطة' : 'Chapters / Activities'}</p>
                        <ul className="space-y-1">
                          {pkg.courses.map((course, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                              <span className="text-primary-500 mt-0.5">✓</span>
                              {typeof course === 'object' ? getLocalizedField(course, 'title', locale) : course}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {pkg.softwareExposure?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{isRTL ? 'البرامج المشمولة' : 'Software Exposure'}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {pkg.softwareExposure.map((sw, i) => (
                            <span key={i} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                              {sw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {pkg.outcome && (
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{isRTL ? 'النتيجة' : 'Outcome'}</p>
                        <p className="text-sm text-gray-600">{getLocalizedField(pkg, 'outcome', locale)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {isComingSoon ? (
                  <div className="mt-auto rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-center">
                    <p className="text-sm font-semibold text-amber-700">
                      {isRTL ? 'هذه الباقة ستتوفر قريبًا.' : 'This package will be available soon.'}
                    </p>
                  </div>
                ) : isContactOnly ? (
                  <button
                    type="button"
                    onClick={() => navigate('/contact-us')}
                    className="btn-secondary w-full mt-auto"
                  >
                    {isRTL ? 'احجز موعدًا' : 'Book Appointment'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleRequestSubscription(pkg._id, selectedOption?.term)}
                    disabled={requesting || autoChargingSavedMethod || !selectedOption}
                    className="btn-primary w-full mt-auto disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {(requesting || autoChargingSavedMethod)
                      ? (isRTL ? 'جارٍ المعالجة...' : 'Processing...')
                      : (isRTL
                        ? `اختر ${getBillingTermLabel(selectedOption?.term, locale) || 'الخطة'}`
                        : `Choose ${getBillingTermLabel(selectedOption?.term, locale) || 'Plan'}`)}
                  </button>
                )}
              </motion.div>
            );
          })}

          {displayPackages.length === 0 && (
            <div className="col-span-full text-center py-10">
              <p className="text-gray-500">{isRTL ? 'لا توجد باقات اشتراك متاحة للعرض حاليًا.' : 'No subscription packages are currently available for display.'}</p>
            </div>
          )}
        </div>
      )}

      <CheckoutDisclaimerModal
        open={showCheckoutDisclaimer}
        onConfirm={handleConfirmCheckout}
        onCancel={() => setShowCheckoutDisclaimer(false)}
        isSubmitting={submittingPayment}
      />
    </motion.div>
  );
}

function DetailRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span>{icon}</span>
      <span className="text-gray-400">{label}:</span>
      <span className="text-gray-700 font-medium">{value}</span>
    </div>
  );
}

export default Subscription;
