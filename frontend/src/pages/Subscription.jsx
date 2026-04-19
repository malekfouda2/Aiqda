import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { subscriptionsAPI, paymentsAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import useUIStore from '../store/uiStore';
import CheckoutDisclaimerModal from '../components/CheckoutDisclaimerModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { getLocalizedField } from '../i18n/translations';
import { useLocale } from '../i18n/useLocale';
import {
  SUBSCRIPTION_DEVICE_LIMIT_DISCLAIMER,
  SUBSCRIPTION_DEVICE_LIMIT_TITLE,
} from '../content/subscriptionPolicy';
import { pageVariants, fadeInUp, staggerContainer, cardVariants } from '../utils/animations';
import {
  BILLING_TERM_LABELS,
  formatMoney,
  getActiveBillingOptions,
  getAnnualSavings,
  getBillingOption,
  getBillingTermLabel,
  getDefaultBillingTerm,
  getPackageAccessNames,
} from '../utils/subscriptions';

function Subscription() {
  const { locale, pick, formatDate, isRTL } = useLocale();
  const navigate = useNavigate();
  const { hasAcceptedCurrentPlatformNotice } = useAuthStore();
  const { showSuccess, showError } = useUIStore();
  const [packages, setPackages] = useState([]);
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [pendingSubscription, setPendingSubscription] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [selectedTerms, setSelectedTerms] = useState({});
  const [expandedPkg, setExpandedPkg] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentReference: '',
    amount: '',
    proofFile: null,
  });
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showCheckoutDisclaimer, setShowCheckoutDisclaimer] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    if (hasAcceptedCurrentPlatformNotice()) {
      fetchData();
      return;
    }

    setLoading(false);
  }, [hasAcceptedCurrentPlatformNotice]);

  const fetchData = async () => {
    try {
      const [packagesRes, subRes, bankRes, userSubsRes] = await Promise.all([
        subscriptionsAPI.getPackages(),
        subscriptionsAPI.getActiveSubscription(),
        paymentsAPI.getBankDetails(),
        subscriptionsAPI.getUserSubscriptions()
      ]);
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
      setActiveSubscription(subRes.data);
      setBankDetails(bankRes.data);
      
      const pending = userSubsRes.data.find(s => s.status === 'pending');
      setPendingSubscription(pending);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!pendingSubscription?.priceAtPurchase) {
      return;
    }

    setPaymentForm((current) => ({
      ...current,
      amount: String(pendingSubscription.priceAtPurchase),
    }));
  }, [pendingSubscription]);

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
      setPendingSubscription(response.data);
      setShowPaymentForm(true);
      showSuccess(isRTL ? 'تم طلب الاشتراك! يرجى إرسال إثبات الدفع.' : 'Subscription requested! Please submit your payment.');
    } catch (error) {
      showError(error.response?.data?.error || (isRTL ? 'تعذر طلب الاشتراك' : 'Failed to request subscription'));
    } finally {
      setRequesting(false);
    }
  };

  const handleSubmitPayment = (e) => {
    e.preventDefault();
    if (!pendingSubscription) return;
    setShowCheckoutDisclaimer(true);
  };

  const handleConfirmPayment = async () => {
    if (!pendingSubscription) return;

    setSubmittingPayment(true);
    try {
      const formData = new FormData();
      formData.append('subscriptionId', pendingSubscription._id);
      formData.append('amount', paymentForm.amount);
      formData.append('paymentReference', paymentForm.paymentReference);
      formData.append('checkoutDisclaimerAccepted', 'true');
      if (paymentForm.proofFile) {
        formData.append('proofFile', paymentForm.proofFile);
      }

      await paymentsAPI.submit(formData);
      setShowCheckoutDisclaimer(false);
      showSuccess(isRTL ? 'تم إرسال الدفع! بانتظار موافقة الإدارة.' : 'Payment submitted! Awaiting admin approval.');
      navigate('/dashboard/payments');
    } catch (error) {
      showError(error.response?.data?.error || (isRTL ? 'تعذر إرسال الدفع' : 'Failed to submit payment'));
    } finally {
      setSubmittingPayment(false);
    }
  };

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

          {activeSubscription && (
            <div className="card bg-green-50 border-green-200 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-600">{isRTL ? 'اشتراك نشط' : 'Active Subscription'}</h3>
                  <p className="text-green-600">
                    {activeSubscription.package?.name}
                    {activeSubscription.billingTerm ? ` (${getBillingTermLabel(activeSubscription.billingTerm, locale) || activeSubscription.billingTerm})` : ''}
                    {' '} - {isRTL ? 'ينتهي في' : 'Expires'} {formatDate(activeSubscription.endDate)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {pendingSubscription && !showPaymentForm && (
            <div className="card bg-yellow-50 border-yellow-200 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">⏳</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-yellow-600">{isRTL ? 'اشتراك قيد الانتظار' : 'Pending Subscription'}</h3>
                    <p className="text-yellow-600">
                      {pendingSubscription.package?.name}
                      {pendingSubscription.billingTerm ? ` (${getBillingTermLabel(pendingSubscription.billingTerm, locale) || pendingSubscription.billingTerm})` : ''}
                      {pendingSubscription.priceAtPurchase ? ` - ${formatMoney(pendingSubscription.priceAtPurchase, locale)} SAR` : ''}
                      {' '} - {isRTL ? 'بانتظار الدفع' : 'Awaiting payment'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPaymentForm(true)}
                  className="btn-primary"
                >
                  {isRTL ? 'إرسال الدفع' : 'Submit Payment'}
                </button>
              </div>
            </div>
          )}

          {showPaymentForm && pendingSubscription && (
            <div className="card mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">{isRTL ? 'إرسال الدفع' : 'Submit Payment'}</h2>
              
              <div className="rounded-2xl border border-yellow-100 bg-yellow-50/80 px-4 py-4 mb-6">
                <p className="text-sm text-yellow-800 leading-7">
                  {isRTL ? 'أنت تدفع مقابل ' : 'You are paying for '}<span className="font-semibold">{pendingSubscription.package?.name}</span>
                  {pendingSubscription.billingTerm ? ` (${getBillingTermLabel(pendingSubscription.billingTerm, locale) || pendingSubscription.billingTerm})` : ''}.
                  {pendingSubscription.priceAtPurchase
                    ? (isRTL
                      ? ` المبلغ المطلوب هو ${formatMoney(pendingSubscription.priceAtPurchase, locale)} ريال.`
                      : ` The required amount is ${formatMoney(pendingSubscription.priceAtPurchase, locale)} SAR.`)
                    : ''}
                </p>
              </div>

              <div className="bg-gray-100 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-gray-900 mb-3">{isRTL ? 'بيانات البنك' : 'Bank Details'}</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-500">{isRTL ? 'البنك:' : 'Bank:'}</span> <span className="text-gray-900">{bankDetails?.bankName}</span></p>
                  <p><span className="text-gray-500">{isRTL ? 'الحساب:' : 'Account:'}</span> <span className="text-gray-900">{bankDetails?.accountName}</span></p>
                  <p><span className="text-gray-500">{isRTL ? 'رقم الحساب:' : 'Account Number:'}</span> <span className="text-gray-900">{bankDetails?.accountNumber}</span></p>
                  <p><span className="text-gray-500">IBAN:</span> <span className="text-gray-900">{bankDetails?.iban}</span></p>
                </div>
              </div>

              <form onSubmit={handleSubmitPayment} className="space-y-4">
                <div className="rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-4">
                  <p className="text-sm leading-7 text-gray-600">
                    {isRTL
                      ? 'قبل إرسال الدفع، سيُطلب منك مراجعة إقرار الشراء المرتبط بسياسة الاسترداد وشروط الاسترداد خلال 24 ساعة وقبوله.'
                      : 'Before submitting payment, you will be asked to review and accept the purchase disclaimer tied to the Refund Policy and the 24-hour refund eligibility terms.'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    {isRTL ? 'مرجع الدفع' : 'Payment Reference'}
                  </label>
                  <input
                    type="text"
                    value={paymentForm.paymentReference}
                    onChange={(e) => setPaymentForm(f => ({ ...f, paymentReference: e.target.value }))}
                    className="input-field"
                    placeholder={isRTL ? 'أدخل مرجع التحويل البنكي' : 'Enter your bank transfer reference'}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    {isRTL ? 'المبلغ المدفوع (ريال)' : 'Amount Paid (SAR)'}
                  </label>
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                    className="input-field"
                    placeholder={isRTL ? 'أدخل المبلغ' : 'Enter amount'}
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    {isRTL ? 'إثبات الدفع' : 'Payment Proof'}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setPaymentForm(f => ({ ...f, proofFile: e.target.files?.[0] || null }))}
                    className="input-field"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="btn-primary" disabled={submittingPayment}>
                    {submittingPayment ? (isRTL ? 'جارٍ الإرسال...' : 'Submitting...') : (isRTL ? 'إرسال الدفع' : 'Submit Payment')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentForm(false);
                      setShowCheckoutDisclaimer(false);
                    }}
                    className="btn-secondary"
                    disabled={submittingPayment}
                  >
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {!activeSubscription && !pendingSubscription && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.map((pkg, index) => {
                const isContactOnly = pkg.purchaseMode === 'contact_only';
                const activeBillingOptions = getActiveBillingOptions(pkg);
                const selectedTerm = selectedTerms[pkg._id] || getDefaultBillingTerm(pkg);
                const selectedOption = getBillingOption(pkg, selectedTerm);
                const annualSavings = getAnnualSavings(pkg);
                const accessNames = getPackageAccessNames(pkg);

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
                        {isContactOnly && (
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                            {isRTL ? 'مخصص' : 'Custom'}
                          </span>
                        )}
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
                              {getBillingTermLabel(option.term, locale) || option.label || option.term}
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
                            <span className="text-3xl font-bold text-gray-900">{formatMoney(selectedOption.price, locale)}</span>
                            <span className="text-gray-500"> SAR</span>
                            <p className="text-sm text-gray-500 mt-1">
                              {selectedOption.term === 'annual' ? (isRTL ? 'سنويًا' : 'per year') : (isRTL ? 'شهريًا' : 'per month')}
                            </p>
                            {selectedOption.term === 'annual' && annualSavings && (
                              <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                                <p className="text-sm font-semibold text-emerald-700">
                                  {isRTL ? `وفّر ${formatMoney(annualSavings.savings, locale)} ريال سنويًا` : `Save ${formatMoney(annualSavings.savings, locale)} SAR each year`}
                                </p>
                                <p className="text-xs text-emerald-600 mt-1">
                                  {isRTL ? `ما يعادل ${formatMoney(annualSavings.monthlyEquivalent, locale)} ريال شهريًا.` : `Equivalent to ${formatMoney(annualSavings.monthlyEquivalent, locale)} SAR per month.`}
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

                    {isContactOnly ? (
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
                        disabled={requesting || !selectedOption}
                        className="btn-primary w-full mt-auto disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {requesting
                          ? (isRTL ? 'جارٍ المعالجة...' : 'Processing...')
                          : (isRTL
                            ? `اختر ${getBillingTermLabel(selectedOption?.term, locale) || 'الخطة'}`
                            : `Choose ${getBillingTermLabel(selectedOption?.term, locale) || 'Plan'}`)}
                      </button>
                    )}
                  </motion.div>
                );
              })}

              {packages.length === 0 && (
                <div className="col-span-full text-center py-10">
                  <p className="text-gray-500">{isRTL ? 'لا توجد باقات اشتراك متاحة بعد.' : 'No subscription packages available yet.'}</p>
                </div>
              )}
            </div>
          )}

          <CheckoutDisclaimerModal
            open={showCheckoutDisclaimer}
            onConfirm={handleConfirmPayment}
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
